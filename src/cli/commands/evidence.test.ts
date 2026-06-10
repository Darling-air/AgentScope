import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { evidenceShowCommand, evidenceClearCommand } from "./evidence.js";
import { reportCommand } from "./report.js";
import { getProjectPaths } from "../../core/fs/project-paths.js";
import {
  buildEvidenceEvent,
  recordEvidence,
} from "../../core/evidence/index.js";
import type { ScopeContract } from "../../core/schema/scope-contract.js";
import type { ToolEvent } from "../../core/events/tool-event.js";

const tmpDirs: string[] = [];
let originalCwd: string;
let logSpy: ReturnType<typeof vi.spyOn>;

function makeDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "agentscope-evidence-cli-"));
  tmpDirs.push(dir);
  return dir;
}

function output(): string {
  return logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
}

const scope: ScopeContract = {
  version: "0.1",
  task: { id: "fix-login-redirect", title: "Fix login redirect bug", raw_input: "Fix login redirect bug" },
  confidence: 0.8,
  allowed_paths: ["src/auth/**"],
  blocked_paths: [".env*"],
  allowed_commands: ["npm test"],
  high_risk: ["package.json"],
  rationale: [],
  created_at: "2026-06-10T10:00:00.000Z",
};

function seedEvidence(dir: string): void {
  const paths = getProjectPaths(dir);
  mkdirSync(paths.evidenceDir, { recursive: true });
  const toolEvent: ToolEvent = {
    id: "evt-1",
    timestamp: "2026-06-10T10:00:00.000Z",
    agent: "claude-code",
    event_type: "tool_call",
    tool_source: "builtin",
    tool_name: "Read",
    action: "read",
    target: ".env.local",
  };
  const event = buildEvidenceEvent({
    id: "evt-1",
    timestamp: toolEvent.timestamp,
    agent: { name: "claude-code" },
    toolEvent,
    decision: { decision: "deny", reason: ".env.local matches blocked path .env*", matched_rule: "blocked_paths:.env*" },
  });
  recordEvidence({
    latestFile: paths.evidenceLatestFile,
    scope,
    event,
    now: "2026-06-10T10:00:00.000Z",
  });
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

describe("evidence show command", () => {
  it("shows a summary when evidence exists", () => {
    const dir = makeDir();
    seedEvidence(dir);
    process.chdir(dir);
    evidenceShowCommand();
    const out = output();
    expect(out).toContain("AgentScope Evidence");
    expect(out).toContain("fix-login-redirect");
    expect(out).toContain("sha256:");
    expect(out).toContain("deny");
  });

  it("prints raw JSON with --json", () => {
    const dir = makeDir();
    seedEvidence(dir);
    process.chdir(dir);
    evidenceShowCommand({ json: true });
    const out = output();
    expect(out).toContain('"version": "0.1"');
    expect(out).toContain('"scope_hash"');
  });

  it("handles missing evidence gracefully", () => {
    const dir = makeDir();
    process.chdir(dir);
    evidenceShowCommand();
    expect(output()).toContain("No evidence recorded yet");
  });
});

describe("evidence clear command", () => {
  it("removes existing evidence", () => {
    const dir = makeDir();
    seedEvidence(dir);
    process.chdir(dir);
    evidenceClearCommand();
    expect(output()).toContain("Removed");
    expect(existsSync(getProjectPaths(dir).evidenceLatestFile)).toBe(false);
  });

  it("is a friendly no-op when there is nothing to clear", () => {
    const dir = makeDir();
    process.chdir(dir);
    evidenceClearCommand();
    expect(output()).toContain("No evidence to clear");
  });
});

describe("report command", () => {
  it("prints an audit summary when evidence exists", () => {
    const dir = makeDir();
    seedEvidence(dir);
    process.chdir(dir);
    reportCommand();
    const out = output();
    expect(out).toContain("AgentScope Report");
    expect(out).toContain("Denied actions:");
    expect(out).toContain(".env.local");
    // V1.4: report now includes a risk score and no longer disclaims it.
    expect(out).toContain("Risk score:");
    expect(out).not.toContain("Risk Scoring is not implemented yet");
  });

  it("handles missing evidence gracefully", () => {
    const dir = makeDir();
    process.chdir(dir);
    reportCommand();
    expect(output()).toContain("No evidence to report on yet");
  });
});
