import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runClaudePreToolUseHook } from "./hook-entrypoint.js";
import { getProjectPaths } from "../../fs/project-paths.js";
import { writeScope } from "../../scope/scope-io.js";
import { createScope } from "../../scope/create-scope.js";
import { defaultConfig } from "../../config/default-config.js";

const tmpDirs: string[] = [];

/** Creates a project with an active scope and a custom config.yaml body. */
function makeProject(configYaml: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), "agentscope-hook-cfg-"));
  tmpDirs.push(dir);
  const paths = getProjectPaths(dir);
  mkdirSync(paths.scopesDir, { recursive: true });
  mkdirSync(paths.evidenceDir, { recursive: true });
  writeFileSync(paths.configFile, configYaml, "utf8");

  const scope = createScope({
    rawInput: "Fix login redirect bug",
    config: defaultConfig(),
    createdAt: "2026-06-09T10:00:00.000Z",
  });
  writeScope(paths.currentScopeFile, scope);
  return dir;
}

function bash(command: string) {
  return {
    hook_event_name: "PreToolUse",
    tool_name: "Bash",
    tool_input: { command },
  };
}

afterEach(() => {
  while (tmpDirs.length) {
    const dir = tmpDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("hook + effective dangerous_commands (V2.1)", () => {
  it("denies a custom dangerous command added via config", async () => {
    const dir = makeProject(
      `version: 1
policy:
  dangerous_commands:
    add:
      - gh secret *
`,
    );
    const r = await runClaudePreToolUseHook(bash("gh secret set FOO"), dir);
    expect(r.hookSpecificOutput.permissionDecision).toBe("deny");
  });

  it("no longer denies a default dangerous command that config removed", async () => {
    const dir = makeProject(
      `version: 1
policy:
  dangerous_commands:
    remove:
      - sudo *
`,
    );
    const r = await runClaudePreToolUseHook(bash("sudo apt install foo"), dir);
    // Not matched as dangerous anymore; falls through to the normal command
    // path (unknown command -> ask). The key assertion: it is NOT denied.
    expect(r.hookSpecificOutput.permissionDecision).not.toBe("deny");
  });

  it("still denies a built-in dangerous command with a default config", async () => {
    const dir = makeProject("version: 1\n");
    const r = await runClaudePreToolUseHook(bash("rm -rf node_modules"), dir);
    expect(r.hookSpecificOutput.permissionDecision).toBe("deny");
  });

  it("does not crash on invalid config and keeps enforcing built-in dangerous commands", async () => {
    // version 99 is invalid; the hook must degrade safely, not crash, and must
    // still deny built-in dangerous commands using the safe fallback list.
    const dir = makeProject("version: 99\n");
    const r = await runClaudePreToolUseHook(bash("rm -rf /"), dir);
    expect(r.hookSpecificOutput.permissionDecision).toBe("deny");
  });

  it("returns a well-formed hook response shape", async () => {
    const dir = makeProject("version: 1\n");
    const r = await runClaudePreToolUseHook(bash("rm -rf node_modules"), dir);
    expect(r.hookSpecificOutput.hookEventName).toBe("PreToolUse");
    expect(typeof r.hookSpecificOutput.permissionDecision).toBe("string");
    expect(typeof r.hookSpecificOutput.permissionDecisionReason).toBe("string");
  });
});
