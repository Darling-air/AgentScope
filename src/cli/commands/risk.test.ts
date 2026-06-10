import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { riskCommand } from "./risk.js";
import { reportCommand } from "./report.js";
import { getProjectPaths } from "../../core/fs/project-paths.js";
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

function makeDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "agentscope-risk-cli-"));
  tmpDirs.push(dir);
  return dir;
}

function output(): string {
  return logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
}

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

let idCounter = 0;
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
    decision: { decision, reason: `${decision} ${target}`, matched_rule: matchedRule },
  });
  recordEvidence({
    latestFile: getProjectPaths(dir).evidenceLatestFile,
    scope,
    event,
    now: "2026-06-10T10:00:00.000Z",
  });
}

function seed(dir: string): void {
  mkdirSync(getProjectPaths(dir).evidenceDir, { recursive: true });
  record(dir, "deny", ".env.local", "blocked_paths:.env*", "read");
  record(dir, "ask", "package.json", "high_risk:package.json", "write");
  record(dir, "allow", "src/auth/login.ts", "allowed_paths:src/auth/**", "edit");
}

beforeEach(() => {
  originalCwd = process.cwd();
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  process.exitCode = 0;
});

afterEach(() => {
  process.chdir(originalCwd);
  logSpy.mockRestore();
  process.exitCode = 0;
  while (tmpDirs.length) {
    const dir = tmpDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("risk command", () => {
  it("prints a human-readable risk report with existing evidence", () => {
    const dir = makeDir();
    seed(dir);
    process.chdir(dir);
    riskCommand();
    const out = output();
    expect(out).toContain("AgentScope Risk");
    expect(out).toContain("Risk score:");
    expect(out).toContain("Risk level:");
    expect(out).toContain("Top risk factors:");
    expect(out).toContain("Recommendations:");
    expect(out).toContain("fix-login-redirect");
  });

  it("prints full RiskScoreV1 JSON with --json", () => {
    const dir = makeDir();
    seed(dir);
    process.chdir(dir);
    riskCommand({ json: true });
    const out = output();
    const parsed = JSON.parse(out);
    expect(parsed.version).toBe("0.1");
    expect(typeof parsed.score).toBe("number");
    expect(parsed.score).toBeGreaterThanOrEqual(0);
    expect(parsed.score).toBeLessThanOrEqual(100);
    expect(["low", "medium", "high", "critical"]).toContain(parsed.level);
    expect(parsed.factors.map((f: { id: string }) => f.id)).toContain(
      "blocked_path_denied",
    );
  });

  it("handles missing evidence gracefully (no crash)", () => {
    const dir = makeDir();
    process.chdir(dir);
    riskCommand();
    expect(output()).toContain("No evidence to score yet");
    expect(process.exitCode).toBe(0);
  });

  it("returns structured JSON error for missing evidence with --json", () => {
    const dir = makeDir();
    process.chdir(dir);
    riskCommand({ json: true });
    const parsed = JSON.parse(output());
    expect(parsed.error).toBe("no_evidence");
  });

  it("does not set a failing exit code even at high risk", () => {
    const dir = makeDir();
    seed(dir);
    process.chdir(dir);
    riskCommand();
    expect(process.exitCode).toBe(0);
  });
});

describe("report command with risk (V1.4)", () => {
  it("includes the risk score and level", () => {
    const dir = makeDir();
    seed(dir);
    process.chdir(dir);
    reportCommand();
    const out = output();
    expect(out).toContain("Risk score:");
    expect(out).toContain("Risk level:");
  });

  it("no longer says Risk Scoring is not implemented", () => {
    const dir = makeDir();
    seed(dir);
    process.chdir(dir);
    reportCommand();
    expect(output()).not.toContain("Risk Scoring is not implemented");
  });

  it("does not behave like a policy gate (exit code stays 0)", () => {
    const dir = makeDir();
    seed(dir);
    process.chdir(dir);
    reportCommand();
    expect(process.exitCode).toBe(0);
  });

  it("still shows denied and asked actions", () => {
    const dir = makeDir();
    seed(dir);
    process.chdir(dir);
    reportCommand();
    const out = output();
    expect(out).toContain("Denied actions:");
    expect(out).toContain("Asked actions:");
    expect(out).toContain(".env.local");
  });

  it("handles missing evidence gracefully", () => {
    const dir = makeDir();
    process.chdir(dir);
    reportCommand();
    expect(output()).toContain("No evidence to report on yet");
  });
});
