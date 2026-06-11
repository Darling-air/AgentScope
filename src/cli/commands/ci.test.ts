import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { mkdtempSync } from "node:fs";
import {
  ciDoctorCommand,
  ciInitGithubActionsCommand,
} from "./ci.js";
import { gateCommand } from "./gate.js";
import { riskCommand } from "./risk.js";
import { reportCommand } from "./report.js";
import { evidenceShowCommand } from "./evidence.js";
import { scopeListCommand } from "./scope-history.js";
import { configShowCommand } from "./config.js";
import { getProjectPaths } from "../../core/fs/project-paths.js";
import { DEFAULT_CONFIG_YAML } from "../../core/config/default-config.js";
import {
  buildEvidenceEvent,
  recordEvidence,
} from "../../core/evidence/index.js";
import type { ScopeContract } from "../../core/schema/scope-contract.js";
import type { ToolEvent } from "../../core/events/tool-event.js";
import type { PolicyDecision } from "../../core/policy/policy-decision.js";

const tmpDirs: string[] = [];
let originalCwd: string;
let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;
let idCounter = 0;

const scope: ScopeContract = {
  version: "0.1",
  task: {
    id: "fix-login-redirect",
    title: "Fix login redirect bug",
    raw_input: "Fix login redirect bug",
  },
  confidence: 0.8,
  allowed_paths: ["src/auth/**"],
  blocked_paths: [".env*"],
  allowed_commands: ["npm test"],
  high_risk: ["package.json"],
  rationale: [],
  created_at: "2026-06-10T10:00:00.000Z",
};

function makeProject(options: { config?: boolean; packageJson?: boolean } = {}): string {
  const dir = mkdtempSync(path.join(tmpdir(), "agentscope-ci-cli-"));
  tmpDirs.push(dir);
  const paths = getProjectPaths(dir);
  mkdirSync(paths.agentscopeDir, { recursive: true });
  if (options.config ?? true) {
    writeFileSync(paths.configFile, DEFAULT_CONFIG_YAML, "utf8");
  }
  if (options.packageJson ?? true) {
    writeFileSync(path.join(dir, "package.json"), '{"name":"test"}\n', "utf8");
  }
  return dir;
}

function workflowPath(dir: string): string {
  return path.join(dir, ".github", "workflows", "agentscope-gate.yml");
}

function record(
  dir: string,
  decision: PolicyDecision["decision"],
  target: string,
  matchedRule?: string,
  action: ToolEvent["action"] = "read",
): void {
  idCounter += 1;
  const id = `evt-${idCounter}`;
  const toolEvent: ToolEvent = {
    id,
    timestamp: "2026-06-10T10:00:00.000Z",
    agent: "claude-code",
    event_type: "tool_call",
    tool_source: "builtin",
    tool_name: action === "read" ? "Read" : "Edit",
    action,
    target,
  };
  const event = buildEvidenceEvent({
    id,
    timestamp: toolEvent.timestamp,
    agent: { name: "claude-code" },
    toolEvent,
    decision: {
      decision,
      reason: `${decision} ${target}`,
      matched_rule: matchedRule,
    },
  });
  recordEvidence({
    latestFile: getProjectPaths(dir).evidenceLatestFile,
    scope,
    event,
    now: "2026-06-10T10:00:00.000Z",
  });
}

function seedSafeEvidence(dir: string): void {
  record(dir, "allow", "src/auth/login.ts", "allowed_paths:src/auth/**", "edit");
}

function seedBlockedEvidence(dir: string): void {
  record(dir, "deny", ".env.local", "blocked_paths:.env*", "read");
}

function logOut(): string {
  return logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
}

function allOut(): string {
  return [...logSpy.mock.calls, ...errSpy.mock.calls]
    .map((c) => c.join(" "))
    .join("\n");
}

beforeEach(() => {
  originalCwd = process.cwd();
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  process.exitCode = 0;
  idCounter = 0;
});

afterEach(() => {
  process.chdir(originalCwd);
  logSpy.mockRestore();
  errSpy.mockRestore();
  process.exitCode = 0;
  while (tmpDirs.length) {
    const dir = tmpDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("ci init github-actions", () => {
  it("writes workflow", () => {
    const dir = makeProject();
    process.chdir(dir);

    ciInitGithubActionsCommand();

    expect(existsSync(workflowPath(dir))).toBe(true);
    expect(readFileSync(workflowPath(dir), "utf8")).toContain(
      "pnpm exec agentscope gate --json",
    );
    expect(process.exitCode).toBe(0);
  });

  it("--mode direct works", () => {
    const dir = makeProject();
    process.chdir(dir);

    ciInitGithubActionsCommand({ mode: "direct" });

    const workflow = readFileSync(workflowPath(dir), "utf8");
    expect(workflow).toContain("pnpm exec agentscope gate --json");
    expect(workflow).not.toContain("uses: ./");
    expect(process.exitCode).toBe(0);
  });

  it("--mode action works", () => {
    const dir = makeProject();
    process.chdir(dir);

    ciInitGithubActionsCommand({ mode: "action" });

    const workflow = readFileSync(workflowPath(dir), "utf8");
    expect(workflow).toContain("uses: ./");
    expect(workflow).toContain("package-manager: pnpm");
    expect(process.exitCode).toBe(0);
  });

  it("refuses to overwrite existing file without --force", () => {
    const dir = makeProject();
    mkdirSync(path.dirname(workflowPath(dir)), { recursive: true });
    writeFileSync(workflowPath(dir), "existing", "utf8");
    process.chdir(dir);

    ciInitGithubActionsCommand();

    expect(readFileSync(workflowPath(dir), "utf8")).toBe("existing");
    expect(allOut()).toContain("already exists");
    expect(process.exitCode).toBe(1);
  });

  it("--force overwrites", () => {
    const dir = makeProject();
    mkdirSync(path.dirname(workflowPath(dir)), { recursive: true });
    writeFileSync(workflowPath(dir), "existing", "utf8");
    process.chdir(dir);

    ciInitGithubActionsCommand({ force: true });

    expect(readFileSync(workflowPath(dir), "utf8")).toContain("AgentScope Gate");
    expect(process.exitCode).toBe(0);
  });

  it("--package-manager pnpm works", () => {
    const dir = makeProject();
    process.chdir(dir);

    ciInitGithubActionsCommand({ packageManager: "pnpm" });

    const workflow = readFileSync(workflowPath(dir), "utf8");
    expect(workflow).toContain("pnpm install --frozen-lockfile");
    expect(workflow).toContain("pnpm exec agentscope gate --json");
  });

  it("--package-manager npm works", () => {
    const dir = makeProject();
    process.chdir(dir);

    ciInitGithubActionsCommand({ packageManager: "npm" });

    const workflow = readFileSync(workflowPath(dir), "utf8");
    expect(workflow).toContain("npm ci");
    expect(workflow).toContain("npx agentscope gate --json");
  });

  it("--allow-missing-evidence works", () => {
    const dir = makeProject();
    process.chdir(dir);

    ciInitGithubActionsCommand({ allowMissingEvidence: true });

    expect(readFileSync(workflowPath(dir), "utf8")).toContain(
      "agentscope gate --json --allow-missing-evidence",
    );
  });

  it("--allow-missing-evidence works with action mode", () => {
    const dir = makeProject();
    process.chdir(dir);

    ciInitGithubActionsCommand({ mode: "action", allowMissingEvidence: true });

    expect(readFileSync(workflowPath(dir), "utf8")).toContain(
      "allow-missing-evidence: true",
    );
  });

  it("--package-manager npm works with action mode", () => {
    const dir = makeProject();
    process.chdir(dir);

    ciInitGithubActionsCommand({ mode: "action", packageManager: "npm" });

    const workflow = readFileSync(workflowPath(dir), "utf8");
    expect(workflow).toContain("npm ci");
    expect(workflow).toContain("package-manager: npm");
  });

  it("--summary adds a ci-summary step in direct mode", () => {
    const dir = makeProject();
    process.chdir(dir);

    ciInitGithubActionsCommand({ summary: ".agentscope/ci/summary.md" });

    const workflow = readFileSync(workflowPath(dir), "utf8");
    expect(workflow).toContain(
      "agentscope ci-summary --output .agentscope/ci/summary.md",
    );
  });

  it("--summary passes summary-path input in action mode", () => {
    const dir = makeProject();
    process.chdir(dir);

    ciInitGithubActionsCommand({
      mode: "action",
      summary: ".agentscope/ci/summary.md",
    });

    const workflow = readFileSync(workflowPath(dir), "utf8");
    expect(workflow).toContain("summary-path: .agentscope/ci/summary.md");
  });

  it("invalid package manager errors clearly", () => {
    const dir = makeProject();
    process.chdir(dir);

    ciInitGithubActionsCommand({ packageManager: "yarn" });

    expect(allOut()).toContain("Invalid package manager");
    expect(process.exitCode).toBe(1);
    expect(existsSync(workflowPath(dir))).toBe(false);
  });

  it("invalid mode errors clearly", () => {
    const dir = makeProject();
    process.chdir(dir);

    ciInitGithubActionsCommand({ mode: "marketplace" });

    expect(allOut()).toContain("Invalid CI mode");
    expect(process.exitCode).toBe(1);
    expect(existsSync(workflowPath(dir))).toBe(false);
  });
});

describe("ci doctor", () => {
  it("works with missing workflow", () => {
    const dir = makeProject();
    process.chdir(dir);

    ciDoctorCommand();

    expect(logOut()).toContain("Workflow: missing");
    expect(logOut()).toContain("Run agentscope ci init github-actions.");
    expect(process.exitCode).toBe(0);
  });

  it("works with missing evidence", () => {
    const dir = makeProject();
    process.chdir(dir);

    ciDoctorCommand();

    expect(logOut()).toContain("Evidence: missing");
    expect(logOut()).toContain("Generate evidence");
    expect(process.exitCode).toBe(0);
  });

  it("reports workflow found", () => {
    const dir = makeProject();
    process.chdir(dir);
    ciInitGithubActionsCommand();
    logSpy.mockClear();

    ciDoctorCommand();

    expect(logOut()).toContain("Workflow: found");
    expect(process.exitCode).toBe(0);
  });

  it("reports action.yml found", () => {
    const dir = makeProject();
    writeFileSync(path.join(dir, "action.yml"), "name: test\n", "utf8");
    process.chdir(dir);

    ciDoctorCommand();

    expect(logOut()).toContain("Action: found");
    expect(process.exitCode).toBe(0);
  });

  it("reports action.yml missing", () => {
    const dir = makeProject();
    process.chdir(dir);

    ciDoctorCommand();

    expect(logOut()).toContain("Action: missing");
    expect(process.exitCode).toBe(0);
  });

  it("reports config found", () => {
    const dir = makeProject();
    process.chdir(dir);

    ciDoctorCommand();

    expect(logOut()).toContain("Config: found");
  });

  it("reports package found", () => {
    const dir = makeProject();
    process.chdir(dir);

    ciDoctorCommand();

    expect(logOut()).toContain("Package: found");
  });

  it("--json outputs parseable JSON", () => {
    const dir = makeProject();
    process.chdir(dir);

    ciDoctorCommand({ json: true });

    const parsed = JSON.parse(logOut());
    expect(parsed.config.status).toBe("found");
    expect(parsed.evidence.status).toBe("missing");
    expect(parsed.workflow.status).toBe("missing");
    expect(parsed.action.status).toBe("missing");
    expect(parsed.package.status).toBe("found");
  });

  it("recommends action.yml when workflow uses local action but action is missing", () => {
    const dir = makeProject();
    mkdirSync(path.dirname(workflowPath(dir)), { recursive: true });
    writeFileSync(
      workflowPath(dir),
      "steps:\n  - name: Run AgentScope Gate\n    uses: ./\n",
      "utf8",
    );
    process.chdir(dir);

    ciDoctorCommand();

    expect(logOut()).toContain(
      "Workflow appears to use the local AgentScope action, but action.yml is missing.",
    );
    expect(process.exitCode).toBe(0);
  });

  it("exit code remains 0 for diagnostic missing items", () => {
    const dir = makeProject({ config: false, packageJson: false });
    process.chdir(dir);

    ciDoctorCommand();

    expect(logOut()).toContain("Config: missing");
    expect(logOut()).toContain("Package: missing");
    expect(process.exitCode).toBe(0);
  });
});

describe("ci regression boundaries", () => {
  it("gate fail still exits 1", () => {
    const dir = makeProject();
    seedBlockedEvidence(dir);
    process.chdir(dir);

    gateCommand({ json: true });

    expect(JSON.parse(logOut()).status).toBe("fail");
    expect(process.exitCode).toBe(1);
  });

  it("gate pass still exits 0", () => {
    const dir = makeProject();
    seedSafeEvidence(dir);
    process.chdir(dir);

    gateCommand({ json: true });

    expect(JSON.parse(logOut()).status).toBe("pass");
    expect(process.exitCode).toBe(0);
  });

  it("risk/report/evidence behavior remains unchanged", () => {
    const dir = makeProject();
    seedSafeEvidence(dir);
    process.chdir(dir);

    riskCommand();
    reportCommand();
    evidenceShowCommand();

    const out = logOut();
    expect(out).toContain("AgentScope Risk");
    expect(out).toContain("AgentScope Report");
    expect(out).toContain("AgentScope Evidence");
    expect(process.exitCode).toBe(0);
  });

  it("scope history commands remain unchanged", () => {
    const dir = makeProject();
    process.chdir(dir);

    scopeListCommand({ json: true });

    expect(JSON.parse(logOut()).scopes).toEqual([]);
    expect(process.exitCode).toBe(0);
  });

  it("config commands still work", () => {
    const dir = makeProject();
    process.chdir(dir);

    configShowCommand({ json: true });

    expect(JSON.parse(logOut()).config.gate.enabled).toBe(true);
    expect(process.exitCode).toBe(0);
  });
});
