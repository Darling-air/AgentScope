import { describe, it, expect, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  resolveClaudeSettingsPath,
  installClaudeHook,
  uninstallClaudeHook,
  readSettings,
  SettingsParseError,
} from "./settings.js";
import {
  hasAgentScopeHook,
  type ClaudeSettings,
} from "./settings-transform.js";
import { backupPathFor } from "./settings-backup.js";

const tmpDirs: string[] = [];

function makeDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "agentscope-install-"));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tmpDirs.length) {
    const dir = tmpDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("resolveClaudeSettingsPath", () => {
  it("defaults to .claude/settings.local.json", () => {
    const p = resolveClaudeSettingsPath({ cwd: "/proj" });
    expect(p.split(path.sep).join("/")).toBe("/proj/.claude/settings.local.json");
  });

  it("targets .claude/settings.json with --shared", () => {
    const p = resolveClaudeSettingsPath({ cwd: "/proj", shared: true });
    expect(p.split(path.sep).join("/")).toBe("/proj/.claude/settings.json");
  });

  it("handles a Windows-style cwd without breaking", () => {
    const p = resolveClaudeSettingsPath({ cwd: "C:\\Users\\dev\\proj" });
    expect(p).toContain(".claude");
    expect(p).toContain("settings.local.json");
  });
});

describe("installClaudeHook — file behavior", () => {
  it("creates .claude/ and writes settings.local.json by default", () => {
    const dir = makeDir();
    const result = installClaudeHook({ cwd: dir });
    expect(existsSync(result.settingsPath)).toBe(true);
    expect(result.settingsPath.endsWith("settings.local.json")).toBe(true);
    const written = readSettings(result.settingsPath);
    expect(hasAgentScopeHook(written)).toBe(true);
  });

  it("writes the shared settings.json with --shared", () => {
    const dir = makeDir();
    const result = installClaudeHook({ cwd: dir, shared: true });
    expect(result.settingsPath.endsWith("settings.json")).toBe(true);
    expect(existsSync(result.settingsPath)).toBe(true);
  });

  it("creates a backup before writing when a settings file existed", () => {
    const dir = makeDir();
    const settingsPath = resolveClaudeSettingsPath({ cwd: dir });
    mkdirSync(path.dirname(settingsPath), { recursive: true });
    writeFileSync(settingsPath, JSON.stringify({ model: "opus" }), "utf8");

    const result = installClaudeHook({ cwd: dir });
    expect(result.backup?.created).toBe(true);
    expect(existsSync(backupPathFor(settingsPath))).toBe(true);
    // Backup holds the ORIGINAL content.
    const backup = JSON.parse(readFileSync(backupPathFor(settingsPath), "utf8"));
    expect(backup).toEqual({ model: "opus" });
  });

  it("does not overwrite an existing backup on repeated install", () => {
    const dir = makeDir();
    const settingsPath = resolveClaudeSettingsPath({ cwd: dir });
    mkdirSync(path.dirname(settingsPath), { recursive: true });
    writeFileSync(settingsPath, JSON.stringify({ original: true }), "utf8");

    installClaudeHook({ cwd: dir }); // creates backup of {original:true}
    installClaudeHook({ cwd: dir }); // must NOT overwrite backup with hooked file

    const backup = JSON.parse(readFileSync(backupPathFor(settingsPath), "utf8"));
    expect(backup).toEqual({ original: true });
  });

  it("does not create a backup when no settings file existed", () => {
    const dir = makeDir();
    const result = installClaudeHook({ cwd: dir });
    expect(result.backup?.created).toBe(false);
    expect(existsSync(backupPathFor(result.settingsPath))).toBe(false);
  });

  it("is idempotent: installing twice yields a single AgentScope entry", () => {
    const dir = makeDir();
    installClaudeHook({ cwd: dir });
    const result = installClaudeHook({ cwd: dir });
    expect(result.updatedExisting).toBe(true);
    const written = readSettings(result.settingsPath) as ClaudeSettings;
    const entries = (written.hooks as Record<string, unknown>)
      .PreToolUse as unknown[];
    expect(entries).toHaveLength(1);
  });
});

describe("installClaudeHook — dry-run", () => {
  it("writes nothing and creates no backup", () => {
    const dir = makeDir();
    const settingsPath = resolveClaudeSettingsPath({ cwd: dir });
    mkdirSync(path.dirname(settingsPath), { recursive: true });
    writeFileSync(settingsPath, JSON.stringify({ model: "opus" }), "utf8");

    const result = installClaudeHook({ cwd: dir, dryRun: true });
    expect(result.dryRun).toBe(true);
    // Original unchanged, no hook, no backup.
    expect(JSON.parse(readFileSync(settingsPath, "utf8"))).toEqual({
      model: "opus",
    });
    expect(existsSync(backupPathFor(settingsPath))).toBe(false);
    // But the computed "after" contains the hook.
    expect(result.after).toContain("agentscope hook claude-code pre-tool-use");
  });

  it("does not create .claude/ when dry-running a fresh project", () => {
    const dir = makeDir();
    const result = installClaudeHook({ cwd: dir, dryRun: true });
    expect(existsSync(path.dirname(result.settingsPath))).toBe(false);
  });
});

describe("readSettings — malformed JSON", () => {
  it("throws SettingsParseError and the install refuses to overwrite", () => {
    const dir = makeDir();
    const settingsPath = resolveClaudeSettingsPath({ cwd: dir });
    mkdirSync(path.dirname(settingsPath), { recursive: true });
    writeFileSync(settingsPath, "{ not valid json", "utf8");

    expect(() => installClaudeHook({ cwd: dir })).toThrow(SettingsParseError);
    // Original file is untouched.
    expect(readFileSync(settingsPath, "utf8")).toBe("{ not valid json");
  });

  it("treats an empty file as empty settings", () => {
    const dir = makeDir();
    const settingsPath = resolveClaudeSettingsPath({ cwd: dir });
    mkdirSync(path.dirname(settingsPath), { recursive: true });
    writeFileSync(settingsPath, "   \n", "utf8");
    expect(readSettings(settingsPath)).toEqual({});
  });
});

describe("uninstallClaudeHook", () => {
  it("removes the AgentScope hook and reports removed", () => {
    const dir = makeDir();
    installClaudeHook({ cwd: dir });
    const result = uninstallClaudeHook({ cwd: dir });
    expect(result.removed).toBe(true);
    expect(hasAgentScopeHook(readSettings(result.settingsPath))).toBe(false);
  });

  it("is a no-op when the settings file does not exist", () => {
    const dir = makeDir();
    const result = uninstallClaudeHook({ cwd: dir });
    expect(result.noop).toBe(true);
    expect(result.removed).toBe(false);
  });

  it("is a no-op when no AgentScope hook is present, leaving other hooks", () => {
    const dir = makeDir();
    const settingsPath = resolveClaudeSettingsPath({ cwd: dir });
    mkdirSync(path.dirname(settingsPath), { recursive: true });
    writeFileSync(
      settingsPath,
      JSON.stringify({
        hooks: {
          PreToolUse: [
            { matcher: "Bash", hooks: [{ type: "command", command: "echo x" }] },
          ],
        },
      }),
      "utf8",
    );
    const result = uninstallClaudeHook({ cwd: dir });
    expect(result.noop).toBe(true);
    const after = readSettings(settingsPath) as ClaudeSettings;
    const entries = (after.hooks as Record<string, unknown>)
      .PreToolUse as unknown[];
    expect(entries).toHaveLength(1);
  });

  it("targets the shared file with --shared", () => {
    const dir = makeDir();
    installClaudeHook({ cwd: dir, shared: true });
    const result = uninstallClaudeHook({ cwd: dir, shared: true });
    expect(result.removed).toBe(true);
    expect(result.settingsPath.endsWith("settings.json")).toBe(true);
  });
});
