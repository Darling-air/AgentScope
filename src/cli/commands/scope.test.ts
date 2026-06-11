import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { mkdtempSync, rmSync, existsSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  scopeExplainCommand,
  scopeDiffCommand,
  scopeApplyCommand,
} from "./scope.js";
import { getProjectPaths } from "../../core/fs/project-paths.js";
import { DEFAULT_CONFIG_YAML, defaultConfig } from "../../core/config/default-config.js";
import { createScope } from "../../core/scope/create-scope.js";
import { readScope, writeScope } from "../../core/scope/scope-io.js";
import { saveScope } from "../../core/scope/history.js";

const tmpDirs: string[] = [];
let originalCwd: string;
let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;

function makeProject(withScope = true): string {
  const dir = mkdtempSync(path.join(tmpdir(), "agentscope-scope-cli-"));
  tmpDirs.push(dir);
  const paths = getProjectPaths(dir);
  mkdirSync(paths.scopesDir, { recursive: true });
  writeFileSync(paths.configFile, DEFAULT_CONFIG_YAML, "utf8");
  if (withScope) {
    const scope = createScope({
      rawInput: "Fix login redirect bug",
      config: defaultConfig(),
      createdAt: "2026-06-10T10:00:00.000Z",
    });
    writeScope(paths.currentScopeFile, scope);
  }
  return dir;
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
  process.exitCode = 0;
  while (tmpDirs.length) {
    const dir = tmpDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("scope explain", () => {
  it("works with an active scope", () => {
    const dir = makeProject();
    process.chdir(dir);
    scopeExplainCommand();
    const out = logOut();
    expect(out).toContain("Task Scope Contract - explanation");
    expect(out).toContain("fix-login-redirect-bug");
    expect(out).toContain("src/auth/**");
  });

  it("handles a missing active scope", () => {
    const dir = makeProject(false);
    process.chdir(dir);
    scopeExplainCommand();
    expect(allOut()).toContain("No active scope");
  });

  it("--json outputs parseable JSON", () => {
    const dir = makeProject();
    process.chdir(dir);
    scopeExplainCommand({ json: true });
    const parsed = JSON.parse(logOut());
    expect(parsed.task.id).toBe("fix-login-redirect-bug");
    expect(parsed.allowed_paths).toContain("src/auth/**");
  });
});

describe("scope diff --task", () => {
  it("shows added/removed paths vs a saved historical scope", () => {
    const dir = makeProject();
    process.chdir(dir);
    const paths = getProjectPaths(dir);
    const scope = readScope(paths.currentScopeFile);
    saveScope(scope, paths);
    scope.allowed_paths = ["custom/only/**"];
    writeScope(paths.currentScopeFile, scope);

    scopeDiffCommand({ task: "fix-login-redirect-bug", json: true });
    const parsed = JSON.parse(logOut());
    expect(parsed.historical.task.id).toBe("fix-login-redirect-bug");
    expect(parsed.diff.allowed_paths.added).toContain("src/auth/**");
    expect(parsed.diff.allowed_paths.removed).toContain("custom/only/**");
  });

  it("--json is parseable", () => {
    const dir = makeProject();
    process.chdir(dir);
    const paths = getProjectPaths(dir);
    saveScope(readScope(paths.currentScopeFile), paths);
    scopeDiffCommand({ task: "fix-login-redirect-bug", json: true });
    expect(() => JSON.parse(logOut())).not.toThrow();
  });

  it("handles a missing current scope", () => {
    const dir = makeProject(false);
    process.chdir(dir);
    const paths = getProjectPaths(dir);
    saveScope(
      createScope({
        rawInput: "Fix login redirect bug",
        config: defaultConfig(),
        createdAt: "2026-06-10T10:00:00.000Z",
      }),
      paths,
    );
    rmSync(paths.currentScopeFile, { force: true });
    scopeDiffCommand({ task: "fix-login-redirect-bug", json: true });
    const parsed = JSON.parse(logOut());
    expect(parsed.error).toBe("no_active_scope");
    expect(process.exitCode).toBe(1);
  });

  it("requires a task id", () => {
    const dir = makeProject();
    process.chdir(dir);
    scopeDiffCommand({ json: true });
    const parsed = JSON.parse(logOut());
    expect(parsed.error).toBe("invalid_task_id");
    expect(process.exitCode).toBe(1);
  });
});

describe("scope apply", () => {
  it("--add-allowed writes the current scope", () => {
    const dir = makeProject();
    process.chdir(dir);
    scopeApplyCommand({ addAllowed: ["tests/app/auth/**"] });
    const paths = getProjectPaths(dir);
    const scope = readScope(paths.currentScopeFile);
    const history = readScope(`${paths.scopesDir}/fix-login-redirect-bug.yaml`);
    expect(scope.allowed_paths).toContain("tests/app/auth/**");
    expect(scope.rationale).toContain(
      "Override: added allowed path tests/app/auth/**.",
    );
    expect(history).toEqual(scope);
  });

  it("--dry-run does not write", () => {
    const dir = makeProject();
    process.chdir(dir);
    scopeApplyCommand({ addAllowed: ["tests/app/auth/**"], dryRun: true });
    const scope = readScope(getProjectPaths(dir).currentScopeFile);
    expect(scope.allowed_paths).not.toContain("tests/app/auth/**");
  });

  it("--json outputs parseable JSON and does not write", () => {
    const dir = makeProject();
    process.chdir(dir);
    scopeApplyCommand({ addAllowed: ["tests/app/auth/**"], json: true });
    const parsed = JSON.parse(logOut());
    expect(parsed.scope.allowed_paths).toContain("tests/app/auth/**");
    expect(parsed.changed).toBe(true);
    const scope = readScope(getProjectPaths(dir).currentScopeFile);
    expect(scope.allowed_paths).not.toContain("tests/app/auth/**");
  });

  it("reports no changes for an empty patch and does not write", () => {
    const dir = makeProject();
    process.chdir(dir);
    const before = readScope(getProjectPaths(dir).currentScopeFile);
    scopeApplyCommand({});
    expect(allOut().toLowerCase()).toContain("no override");
    const after = readScope(getProjectPaths(dir).currentScopeFile);
    expect(after.allowed_paths).toEqual(before.allowed_paths);
  });

  it("exits 1 when there is no active scope", () => {
    const dir = makeProject(false);
    process.chdir(dir);
    scopeApplyCommand({ addAllowed: ["x/**"] });
    expect(process.exitCode).toBe(1);
    expect(allOut().toLowerCase()).toContain("no active scope");
    expect(existsSync(getProjectPaths(dir).currentScopeFile)).toBe(false);
  });

  it("does not modify config.yaml", () => {
    const dir = makeProject();
    process.chdir(dir);
    const paths = getProjectPaths(dir);
    const cfgBefore = readFileSync(paths.configFile, "utf8");
    scopeApplyCommand({ addBlocked: ["private/**"] });
    const cfgAfter = readFileSync(paths.configFile, "utf8");
    expect(cfgAfter).toBe(cfgBefore);
  });
});
