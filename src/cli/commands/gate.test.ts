import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gateCommand } from "./gate.js";
import { riskCommand } from "./risk.js";
import { reportCommand } from "./report.js";
import { evidenceShowCommand } from "./evidence.js";
import { scopeListCommand } from "./scope-history.js";
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

function makeProject(config = DEFAULT_CONFIG_YAML): string {
  const dir = mkdtempSync(path.join(tmpdir(), "agentscope-gate-cli-"));
  tmpDirs.push(dir);
  const paths = getProjectPaths(dir);
  mkdirSync(paths.agentscopeDir, { recursive: true });
  writeFileSync(paths.configFile, config, "utf8");
  return dir;
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

function seedSafe(dir: string): void {
  record(dir, "allow", "src/auth/login.ts", "allowed_paths:src/auth/**", "edit");
}

function seedBlocked(dir: string): void {
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

describe("gate command", () => {
  it("passes with safe evidence and exits 0", () => {
    const dir = makeProject();
    seedSafe(dir);
    process.chdir(dir);

    gateCommand();

    expect(logOut()).toContain("Policy gate: PASS");
    expect(process.exitCode).toBe(0);
  });

  it("fails with blocked path evidence and exits 1", () => {
    const dir = makeProject();
    seedBlocked(dir);
    process.chdir(dir);

    gateCommand();

    const out = logOut();
    expect(out).toContain("Policy gate: FAIL");
    expect(out).toContain("blocked_path_denied");
    expect(process.exitCode).toBe(1);
  });

  it("--json outputs parseable JSON", () => {
    const dir = makeProject();
    seedBlocked(dir);
    process.chdir(dir);

    gateCommand({ json: true });

    const parsed = JSON.parse(logOut());
    expect(parsed.version).toBe("0.1");
    expect(parsed.status).toBe("fail");
    expect(parsed.reasons.map((r: { id: string }) => r.id)).toContain(
      "blocked_path_denied",
    );
  });

  it("missing evidence defaults to fail exit 1", () => {
    const dir = makeProject();
    process.chdir(dir);

    gateCommand();

    expect(logOut()).toContain("Policy gate: FAIL");
    expect(logOut()).toContain("missing_evidence");
    expect(process.exitCode).toBe(1);
  });

  it("--allow-missing-evidence skips and exits 0", () => {
    const dir = makeProject();
    process.chdir(dir);

    gateCommand({ allowMissingEvidence: true });

    expect(logOut()).toContain("Policy gate: SKIPPED");
    expect(logOut()).toContain("missing_evidence_allowed");
    expect(process.exitCode).toBe(0);
  });

  it("handles invalid config clearly", () => {
    const dir = makeProject("version: 1\ngate:\n  risk:\n    max_level: severe\n");
    seedSafe(dir);
    process.chdir(dir);

    gateCommand();

    expect(allOut()).toContain("Invalid config");
    expect(allOut()).toContain("gate.risk.max_level");
    expect(process.exitCode).toBe(1);
  });

  it("respects config that allows blocked path denies", () => {
    const dir = makeProject(`version: 1
gate:
  decisions:
    max_denies: 5
  rules:
    fail_on_blocked_path: false
`);
    seedBlocked(dir);
    process.chdir(dir);

    gateCommand();

    expect(logOut()).toContain("Policy gate: PASS");
    expect(process.exitCode).toBe(0);
  });
});

describe("gate regression boundaries", () => {
  it("risk CLI remains read-only and exit 0", () => {
    const dir = makeProject();
    seedBlocked(dir);
    process.chdir(dir);

    riskCommand();

    expect(logOut()).toContain("AgentScope Risk");
    expect(process.exitCode).toBe(0);
  });

  it("evidence CLI behavior remains unchanged", () => {
    const dir = makeProject();
    seedBlocked(dir);
    process.chdir(dir);

    evidenceShowCommand();

    expect(logOut()).toContain("AgentScope Evidence");
    expect(process.exitCode).toBe(0);
  });

  it("scope history commands remain unchanged", () => {
    const dir = makeProject();
    process.chdir(dir);

    scopeListCommand({ json: true });

    const parsed = JSON.parse(logOut());
    expect(parsed.scopes).toEqual([]);
    expect(process.exitCode).toBe(0);
  });

  it("report remains exit 0 and points to gate", () => {
    const dir = makeProject();
    seedBlocked(dir);
    process.chdir(dir);

    reportCommand();

    expect(logOut()).toContain("AgentScope Report");
    expect(logOut()).toContain("Policy gate: run `agentscope gate`");
    expect(process.exitCode).toBe(0);
  });
});
