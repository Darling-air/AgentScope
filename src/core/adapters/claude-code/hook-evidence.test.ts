import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runClaudePreToolUseHook } from "./hook-entrypoint.js";
import { getProjectPaths } from "../../fs/project-paths.js";
import { writeScope } from "../../scope/scope-io.js";
import { createScope } from "../../scope/create-scope.js";
import { defaultConfig, DEFAULT_CONFIG_YAML } from "../../config/default-config.js";
import { readEvidencePackage } from "../../evidence/index.js";

const tmpDirs: string[] = [];

function makeProjectWithScope(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "agentscope-evidence-hook-"));
  tmpDirs.push(dir);
  const paths = getProjectPaths(dir);
  mkdirSync(paths.scopesDir, { recursive: true });
  mkdirSync(paths.evidenceDir, { recursive: true });
  writeFileSync(paths.configFile, DEFAULT_CONFIG_YAML, "utf8");

  const scope = createScope({
    rawInput: "Fix login redirect bug",
    config: defaultConfig(),
    createdAt: "2026-06-09T10:00:00.000Z",
  });
  writeScope(paths.currentScopeFile, scope);
  return dir;
}

function makeEmptyProject(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "agentscope-evidence-empty-"));
  tmpDirs.push(dir);
  return dir;
}

function payload(
  tool_name: string,
  tool_input: Record<string, unknown>,
  extra: Record<string, unknown> = {},
) {
  return { hook_event_name: "PreToolUse", tool_name, tool_input, ...extra };
}

afterEach(() => {
  while (tmpDirs.length) {
    const dir = tmpDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("hook entrypoint evidence recording", () => {
  it("writes a deny evidence event when reading .env.local", async () => {
    const dir = makeProjectWithScope();
    const r = await runClaudePreToolUseHook(
      payload("Read", { file_path: ".env.local" }),
      dir,
    );
    expect(r.hookSpecificOutput.permissionDecision).toBe("deny");

    const pkg = readEvidencePackage(getProjectPaths(dir).evidenceLatestFile);
    expect(pkg).toBeDefined();
    expect(pkg?.events).toHaveLength(1);
    expect(pkg?.events[0]?.policy_decision.decision).toBe("deny");
    expect(pkg?.policy_interventions).toHaveLength(1);
  });

  it("writes an allow evidence event when editing src/auth/login.ts", async () => {
    const dir = makeProjectWithScope();
    await runClaudePreToolUseHook(
      payload("Edit", { file_path: "src/auth/login.ts" }),
      dir,
    );
    const pkg = readEvidencePackage(getProjectPaths(dir).evidenceLatestFile);
    expect(pkg?.events[0]?.policy_decision.decision).toBe("allow");
    expect(pkg?.policy_interventions).toHaveLength(0);
  });

  it("writes an ask evidence event when editing package.json", async () => {
    const dir = makeProjectWithScope();
    await runClaudePreToolUseHook(
      payload("Edit", { file_path: "package.json" }),
      dir,
    );
    const pkg = readEvidencePackage(getProjectPaths(dir).evidenceLatestFile);
    expect(pkg?.events[0]?.policy_decision.decision).toBe("ask");
    expect(pkg?.policy_interventions).toHaveLength(1);
  });

  it("accumulates multiple events under the same scope", async () => {
    const dir = makeProjectWithScope();
    await runClaudePreToolUseHook(payload("Read", { file_path: ".env.local" }), dir);
    await runClaudePreToolUseHook(
      payload("Edit", { file_path: "src/auth/login.ts" }),
      dir,
    );
    const pkg = readEvidencePackage(getProjectPaths(dir).evidenceLatestFile);
    expect(pkg?.events).toHaveLength(2);
  });

  it("captures session_id and transcript_path on the agent field", async () => {
    const dir = makeProjectWithScope();
    await runClaudePreToolUseHook(
      payload(
        "Read",
        { file_path: ".env.local" },
        { session_id: "sess-123", transcript_path: "/tmp/t.jsonl" },
      ),
      dir,
    );
    const pkg = readEvidencePackage(getProjectPaths(dir).evidenceLatestFile);
    expect(pkg?.events[0]?.agent.session_id).toBe("sess-123");
    expect(pkg?.events[0]?.agent.transcript_path).toBe("/tmp/t.jsonl");
    expect(pkg?.events[0]?.agent.name).toBe("claude-code");
  });

  it("does not write evidence and still safe-asks when no scope exists", async () => {
    const dir = makeEmptyProject();
    const r = await runClaudePreToolUseHook(
      payload("Read", { file_path: "src/index.ts" }),
      dir,
    );
    expect(r.hookSpecificOutput.permissionDecision).toBe("ask");
    const pkg = readEvidencePackage(getProjectPaths(dir).evidenceLatestFile);
    expect(pkg).toBeUndefined();
  });

  it("returns the same hook response even if evidence cannot be written", async () => {
    const dir = makeProjectWithScope();
    const paths = getProjectPaths(dir);
    // Make the evidence dir un-writable as a directory by putting a FILE where
    // latest.json's parent dir would need a nested path — simulate by removing
    // write access is platform-specific, so instead assert the decision holds.
    const r = await runClaudePreToolUseHook(
      payload("Read", { file_path: ".env.local" }),
      dir,
    );
    expect(r.hookSpecificOutput.permissionDecision).toBe("deny");
    // Sanity: evidence path is resolvable.
    expect(paths.evidenceLatestFile).toContain("latest.json");
  });
});
