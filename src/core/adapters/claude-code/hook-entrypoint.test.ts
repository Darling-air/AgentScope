import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runClaudePreToolUseHook } from "./hook-entrypoint.js";
import { getProjectPaths } from "../../fs/project-paths.js";
import { writeScope } from "../../scope/scope-io.js";
import { createScope } from "../../scope/create-scope.js";
import { defaultConfig } from "../../config/default-config.js";
import { DEFAULT_CONFIG_YAML } from "../../config/default-config.js";

const tmpDirs: string[] = [];

function makeProjectWithScope(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "agentscope-hook-"));
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
  const dir = mkdtempSync(path.join(tmpdir(), "agentscope-hook-empty-"));
  tmpDirs.push(dir);
  return dir;
}

function payload(
  tool_name: string,
  tool_input: Record<string, unknown>,
  cwd?: string,
) {
  return { hook_event_name: "PreToolUse", tool_name, tool_input, cwd };
}

/** Forward-slash absolute path under `dir`. */
function abs(dir: string, rel: string): string {
  return `${dir.replace(/\\/g, "/")}/${rel}`;
}

/** Backslash absolute path under `dir` (Windows-style). */
function absWin(dir: string, rel: string): string {
  return `${dir.replace(/\//g, "\\")}\\${rel.replace(/\//g, "\\")}`;
}

afterEach(() => {
  while (tmpDirs.length) {
    const dir = tmpDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("runClaudePreToolUseHook", () => {
  it("denies reading .env.local", async () => {
    const dir = makeProjectWithScope();
    const r = await runClaudePreToolUseHook(
      payload("Read", { file_path: ".env.local" }),
      dir,
    );
    expect(r.hookSpecificOutput.permissionDecision).toBe("deny");
  });

  it("allows editing src/auth/login.ts", async () => {
    const dir = makeProjectWithScope();
    const r = await runClaudePreToolUseHook(
      payload("Edit", { file_path: "src/auth/login.ts" }),
      dir,
    );
    expect(r.hookSpecificOutput.permissionDecision).toBe("allow");
  });

  it("asks before editing package.json", async () => {
    const dir = makeProjectWithScope();
    const r = await runClaudePreToolUseHook(
      payload("Edit", { file_path: "package.json" }),
      dir,
    );
    expect(r.hookSpecificOutput.permissionDecision).toBe("ask");
  });

  it("allows npm test", async () => {
    const dir = makeProjectWithScope();
    const r = await runClaudePreToolUseHook(
      payload("Bash", { command: "npm test" }),
      dir,
    );
    expect(r.hookSpecificOutput.permissionDecision).toBe("allow");
  });

  it("denies rm -rf node_modules", async () => {
    const dir = makeProjectWithScope();
    const r = await runClaudePreToolUseHook(
      payload("Bash", { command: "rm -rf node_modules" }),
      dir,
    );
    expect(r.hookSpecificOutput.permissionDecision).toBe("deny");
  });

  it("returns a safe ask when no scope exists", async () => {
    const dir = makeEmptyProject();
    const r = await runClaudePreToolUseHook(
      payload("Read", { file_path: "src/index.ts" }),
      dir,
    );
    expect(r.hookSpecificOutput.permissionDecision).toBe("ask");
    expect(r.hookSpecificOutput.permissionDecisionReason).toContain(
      "no active scope",
    );
  });

  it("returns a safe ask on an invalid payload", async () => {
    const dir = makeProjectWithScope();
    const r = await runClaudePreToolUseHook({ nonsense: true }, dir);
    expect(r.hookSpecificOutput.permissionDecision).toBe("ask");
  });

  it("returns a safe ask on undefined input (invalid JSON upstream)", async () => {
    const dir = makeProjectWithScope();
    const r = await runClaudePreToolUseHook(undefined, dir);
    expect(r.hookSpecificOutput.permissionDecision).toBe("ask");
  });

  it("asks for an unknown tool with an active scope", async () => {
    const dir = makeProjectWithScope();
    const r = await runClaudePreToolUseHook(
      payload("WebFetch", { url: "https://example.com" }),
      dir,
    );
    expect(r.hookSpecificOutput.permissionDecision).toBe("ask");
  });

  describe("absolute path normalization", () => {
    it("denies reading an absolute (POSIX) .env.local under cwd", async () => {
      const dir = makeProjectWithScope();
      const cwd = dir.replace(/\\/g, "/");
      const r = await runClaudePreToolUseHook(
        payload("Read", { file_path: abs(dir, ".env.local") }, cwd),
        dir,
      );
      expect(r.hookSpecificOutput.permissionDecision).toBe("deny");
    });

    it("denies reading an absolute (Windows) .env.local under cwd", async () => {
      const dir = makeProjectWithScope();
      const r = await runClaudePreToolUseHook(
        payload("Read", { file_path: absWin(dir, ".env.local") }, absWin(dir, "")),
        dir,
      );
      expect(r.hookSpecificOutput.permissionDecision).toBe("deny");
    });

    it("allows editing an absolute (POSIX) src/auth/login.ts under cwd", async () => {
      const dir = makeProjectWithScope();
      const cwd = dir.replace(/\\/g, "/");
      const r = await runClaudePreToolUseHook(
        payload("Edit", { file_path: abs(dir, "src/auth/login.ts") }, cwd),
        dir,
      );
      expect(r.hookSpecificOutput.permissionDecision).toBe("allow");
    });

    it("asks before editing an absolute (Windows) package.json under cwd", async () => {
      const dir = makeProjectWithScope();
      const r = await runClaudePreToolUseHook(
        payload("Edit", { file_path: absWin(dir, "package.json") }, absWin(dir, "")),
        dir,
      );
      expect(r.hookSpecificOutput.permissionDecision).toBe("ask");
    });
  });
});
