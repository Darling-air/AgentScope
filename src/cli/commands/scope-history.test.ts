import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  scopeHistoryDiffCommand,
  scopeListCommand,
  scopeUseCommand,
} from "./scope-history.js";
import { scopeApplyCommand } from "./scope.js";
import { startCommand } from "./start.js";
import { getProjectPaths } from "../../core/fs/project-paths.js";
import { DEFAULT_CONFIG_YAML, defaultConfig } from "../../core/config/default-config.js";
import { createScope } from "../../core/scope/create-scope.js";
import { saveScope } from "../../core/scope/history.js";
import { readScope, writeScope } from "../../core/scope/scope-io.js";
import * as promptModule from "../prompt.js";

const tmpDirs: string[] = [];
let originalCwd: string;
let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;

function makeProject(): ReturnType<typeof getProjectPaths> {
  const dir = mkdtempSync(path.join(tmpdir(), "agentscope-scope-history-cli-"));
  tmpDirs.push(dir);
  const paths = getProjectPaths(dir);
  mkdirSync(paths.agentscopeDir, { recursive: true });
  writeFileSync(paths.configFile, DEFAULT_CONFIG_YAML, "utf8");
  return paths;
}

function scopeFor(task: string, createdAt: string) {
  return createScope({ rawInput: task, config: defaultConfig(), createdAt });
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
});

afterEach(() => {
  process.chdir(originalCwd);
  logSpy.mockRestore();
  errSpy.mockRestore();
  vi.restoreAllMocks();
  process.exitCode = 0;
  while (tmpDirs.length) {
    const dir = tmpDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("scope history CLI", () => {
  it("scope list shows task-id, title, and confidence", () => {
    const paths = makeProject();
    process.chdir(paths.root);
    saveScope(scopeFor("Fix login redirect bug", "2026-06-10T10:00:00.000Z"), paths);

    scopeListCommand();

    const out = logOut();
    expect(out).toContain("fix-login-redirect-bug");
    expect(out).toContain("Fix login redirect bug");
    expect(out).toContain("confidence:");
  });

  it("scope list --json is parseable", () => {
    const paths = makeProject();
    process.chdir(paths.root);
    saveScope(scopeFor("Fix login redirect bug", "2026-06-10T10:00:00.000Z"), paths);

    scopeListCommand({ json: true });

    const parsed = JSON.parse(logOut());
    expect(parsed.scopes[0].task_id).toBe("fix-login-redirect-bug");
    expect(parsed.scopes[0].title).toBe("Fix login redirect bug");
    expect(typeof parsed.scopes[0].confidence).toBe("number");
  });

  it("scope use restores history to current-scope.yaml", () => {
    const paths = makeProject();
    process.chdir(paths.root);
    const auth = scopeFor("Fix login redirect bug", "2026-06-10T10:00:00.000Z");
    const ui = scopeFor("Update navbar component style", "2026-06-10T11:00:00.000Z");
    saveScope(auth, paths);
    saveScope(ui, paths);
    writeScope(paths.currentScopeFile, auth);

    scopeUseCommand("update-navbar-component-style");

    expect(readScope(paths.currentScopeFile).task.id).toBe("update-navbar-component-style");
    expect(logOut()).toContain("Restored update-navbar-component-style");
  });

  it("scope use --json is parseable and preserves rationale", () => {
    const paths = makeProject();
    process.chdir(paths.root);
    const scope = scopeFor("Fix login redirect bug", "2026-06-10T10:00:00.000Z");
    scope.rationale = [...scope.rationale, "Override: added allowed path tests/app/auth/**."];
    scope.allowed_paths = [...scope.allowed_paths, "tests/app/auth/**"];
    saveScope(scope, paths);

    scopeUseCommand("fix-login-redirect-bug", { json: true });

    const parsed = JSON.parse(logOut());
    expect(parsed.restored).toBe(true);
    expect(parsed.scope.allowed_paths).toContain("tests/app/auth/**");
    expect(parsed.scope.rationale).toContain(
      "Override: added allowed path tests/app/auth/**.",
    );
  });

  it("scope diff --task compares active scope with historical scope", () => {
    const paths = makeProject();
    process.chdir(paths.root);
    const historical = scopeFor("Fix login redirect bug", "2026-06-10T10:00:00.000Z");
    saveScope(historical, paths);
    const active = { ...historical, allowed_paths: ["custom/only/**"] };
    writeScope(paths.currentScopeFile, active);

    scopeHistoryDiffCommand({ task: "fix-login-redirect-bug", json: true });

    const parsed = JSON.parse(logOut());
    expect(parsed.diff.allowed_paths.added).toContain("src/auth/**");
    expect(parsed.diff.allowed_paths.removed).toContain("custom/only/**");
  });

  it("scope diff reports missing active scope", () => {
    const paths = makeProject();
    process.chdir(paths.root);
    saveScope(scopeFor("Fix login redirect bug", "2026-06-10T10:00:00.000Z"), paths);
    rmSync(paths.currentScopeFile, { force: true });

    scopeHistoryDiffCommand({ task: "fix-login-redirect-bug", json: true });

    const parsed = JSON.parse(logOut());
    expect(parsed.error).toBe("no_active_scope");
    expect(process.exitCode).toBe(1);
  });

  it("scope apply auto-saves history and does not modify config.yaml", () => {
    const paths = makeProject();
    process.chdir(paths.root);
    saveScope(scopeFor("Fix login redirect bug", "2026-06-10T10:00:00.000Z"), paths);
    const beforeConfig = readFileSync(paths.configFile, "utf8");

    scopeApplyCommand({ addAllowed: ["tests/app/auth/**"] });

    const history = readScope(path.join(paths.scopesDir, "fix-login-redirect-bug.yaml"));
    expect(history.allowed_paths).toContain("tests/app/auth/**");
    expect(history.rationale).toContain(
      "Override: added allowed path tests/app/auth/**.",
    );
    expect(readFileSync(paths.configFile, "utf8")).toBe(beforeConfig);
  });

  it("start approve auto-saves history with override rationale", async () => {
    const paths = makeProject();
    process.chdir(paths.root);
    const beforeConfig = readFileSync(paths.configFile, "utf8");
    vi.spyOn(promptModule, "prompt").mockResolvedValue("y");

    await startCommand("Fix login redirect bug", {
      addAllowed: ["tests/app/auth/**"],
      addBlocked: ["private/**"],
    });

    const current = readScope(paths.currentScopeFile);
    const history = readScope(path.join(paths.scopesDir, "fix-login-redirect-bug.yaml"));
    expect(history).toEqual(current);
    expect(history.allowed_paths).toContain("tests/app/auth/**");
    expect(history.blocked_paths).toContain("private/**");
    expect(history.rationale).toContain(
      "Override: added allowed path tests/app/auth/**.",
    );
    expect(readFileSync(paths.configFile, "utf8")).toBe(beforeConfig);
  });

  it("human-readable errors are emitted for invalid task ids", () => {
    const paths = makeProject();
    process.chdir(paths.root);

    scopeHistoryDiffCommand({});

    expect(allOut()).toContain("A task id is required.");
    expect(process.exitCode).toBe(1);
  });
});
