import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { installClaudeCodeCommand } from "./install.js";
import { uninstallClaudeCodeCommand } from "./uninstall.js";
import {
  resolveClaudeSettingsPath,
  readSettings,
} from "../../core/adapters/claude-code/settings.js";
import { hasAgentScopeHook } from "../../core/adapters/claude-code/settings-transform.js";
import { backupPathFor } from "../../core/adapters/claude-code/settings-backup.js";

const tmpDirs: string[] = [];
let originalCwd: string;
let logSpy: ReturnType<typeof vi.spyOn>;

function makeDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "agentscope-cli-"));
  tmpDirs.push(dir);
  return dir;
}

function output(): string {
  return logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
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

describe("install claude-code CLI", () => {
  it("--dry-run writes nothing and exits 0", () => {
    const dir = makeDir();
    process.chdir(dir);
    installClaudeCodeCommand({ dryRun: true });

    const settingsPath = resolveClaudeSettingsPath({ cwd: dir });
    expect(existsSync(settingsPath)).toBe(false);
    expect(existsSync(path.dirname(settingsPath))).toBe(false);
    expect(process.exitCode).toBe(0);
    expect(output()).toContain("dry-run");
    expect(output()).toContain("No files were modified.");
  });

  it("installs into settings.local.json by default", () => {
    const dir = makeDir();
    process.chdir(dir);
    installClaudeCodeCommand({});

    const settingsPath = resolveClaudeSettingsPath({ cwd: dir });
    expect(existsSync(settingsPath)).toBe(true);
    expect(hasAgentScopeHook(readSettings(settingsPath))).toBe(true);
    expect(output()).toContain("installed");
    expect(output()).toContain("settings.local.json");
  });

  it("installs into settings.json with --shared", () => {
    const dir = makeDir();
    process.chdir(dir);
    installClaudeCodeCommand({ shared: true });

    const shared = resolveClaudeSettingsPath({ cwd: dir, shared: true });
    const local = resolveClaudeSettingsPath({ cwd: dir });
    expect(existsSync(shared)).toBe(true);
    expect(existsSync(local)).toBe(false);
  });
});

describe("uninstall claude-code CLI", () => {
  it("removes the hook after install", () => {
    const dir = makeDir();
    process.chdir(dir);
    installClaudeCodeCommand({});
    uninstallClaudeCodeCommand({});

    const settingsPath = resolveClaudeSettingsPath({ cwd: dir });
    expect(hasAgentScopeHook(readSettings(settingsPath))).toBe(false);
    expect(output()).toContain("removed");
  });

  it("--shared removes from settings.json", () => {
    const dir = makeDir();
    process.chdir(dir);
    installClaudeCodeCommand({ shared: true });
    uninstallClaudeCodeCommand({ shared: true });

    const shared = resolveClaudeSettingsPath({ cwd: dir, shared: true });
    expect(hasAgentScopeHook(readSettings(shared))).toBe(false);
  });

  it("is a friendly no-op when nothing is installed", () => {
    const dir = makeDir();
    process.chdir(dir);
    uninstallClaudeCodeCommand({});
    expect(process.exitCode).toBe(0);
    expect(output()).toContain("nothing to remove");
  });

  it("install then real run leaves a backup only when a prior file existed", () => {
    const dir = makeDir();
    process.chdir(dir);
    installClaudeCodeCommand({});
    const settingsPath = resolveClaudeSettingsPath({ cwd: dir });
    // No prior file existed, so no backup.
    expect(existsSync(backupPathFor(settingsPath))).toBe(false);
  });
});
