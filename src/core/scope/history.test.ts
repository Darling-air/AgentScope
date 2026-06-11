import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getProjectPaths } from "../fs/project-paths.js";
import { defaultConfig, DEFAULT_CONFIG_YAML } from "../config/default-config.js";
import { createScope } from "./create-scope.js";
import { applyScopeOverride } from "./override.js";
import { readScope, writeScope } from "./scope-io.js";
import { listScopes, loadScope, saveScope, useScope } from "./history.js";

const tmpDirs: string[] = [];

function makeProject(): ReturnType<typeof getProjectPaths> {
  const dir = mkdtempSync(path.join(tmpdir(), "agentscope-history-"));
  tmpDirs.push(dir);
  const paths = getProjectPaths(dir);
  mkdirSync(paths.agentscopeDir, { recursive: true });
  writeFileSync(paths.configFile, DEFAULT_CONFIG_YAML, "utf8");
  return paths;
}

function scopeFor(task: string, createdAt: string) {
  return createScope({ rawInput: task, config: defaultConfig(), createdAt });
}

afterEach(() => {
  while (tmpDirs.length) {
    const dir = tmpDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("scope history", () => {
  it("saveScope writes current-scope.yaml and scopes/<task-id>.yaml", () => {
    const paths = makeProject();
    const scope = scopeFor("Fix login redirect bug", "2026-06-10T10:00:00.000Z");

    const entry = saveScope(scope, paths);

    expect(entry.task_id).toBe("fix-login-redirect-bug");
    expect(existsSync(paths.currentScopeFile)).toBe(true);
    expect(existsSync(path.join(paths.scopesDir, "fix-login-redirect-bug.yaml"))).toBe(true);
    expect(readScope(paths.currentScopeFile)).toEqual(scope);
    expect(loadScope("fix-login-redirect-bug", paths)).toEqual(scope);
  });

  it("listScopes returns task-id, title, created_at, and confidence deterministically", () => {
    const paths = makeProject();
    saveScope(scopeFor("Update navbar component style", "2026-06-10T11:00:00.000Z"), paths);
    saveScope(scopeFor("Fix login redirect bug", "2026-06-10T10:00:00.000Z"), paths);

    const entries = listScopes(paths);

    expect(entries.map((e) => e.task_id)).toEqual([
      "fix-login-redirect-bug",
      "update-navbar-component-style",
    ]);
    const first = entries[0];
    expect(first).toBeDefined();
    expect(first).toMatchObject({
      task_id: "fix-login-redirect-bug",
      title: "Fix login redirect bug",
      created_at: "2026-06-10T10:00:00.000Z",
    });
    expect(typeof first?.confidence).toBe("number");
  });

  it("useScope restores a historical scope to current-scope.yaml", () => {
    const paths = makeProject();
    const auth = scopeFor("Fix login redirect bug", "2026-06-10T10:00:00.000Z");
    const ui = scopeFor("Update navbar component style", "2026-06-10T11:00:00.000Z");
    saveScope(auth, paths);
    saveScope(ui, paths);
    writeScope(paths.currentScopeFile, auth);

    const restored = useScope("update-navbar-component-style", paths);

    expect(restored.task.id).toBe("update-navbar-component-style");
    expect(readScope(paths.currentScopeFile)).toEqual(ui);
  });

  it("preserves override rationale and does not mutate config.yaml", () => {
    const paths = makeProject();
    const beforeConfig = readFileSync(paths.configFile, "utf8");
    const scope = applyScopeOverride(
      scopeFor("Fix login redirect bug", "2026-06-10T10:00:00.000Z"),
      {
        allowed_paths: { add: ["tests/app/auth/**"] },
        blocked_paths: { add: ["private/**"] },
      },
    );

    saveScope(scope, paths);
    useScope(scope.task.id, paths);

    const restored = readScope(paths.currentScopeFile);
    expect(restored.allowed_paths).toContain("tests/app/auth/**");
    expect(restored.blocked_paths).toContain("private/**");
    expect(restored.rationale).toContain(
      "Override: added allowed path tests/app/auth/**.",
    );
    expect(restored.rationale).toContain("Override: added blocked path private/**.");
    expect(readFileSync(paths.configFile, "utf8")).toBe(beforeConfig);
  });

  it("retains V2.2 inference regressions in saved history", () => {
    const paths = makeProject();
    const scope = scopeFor("Fix login redirect bug", "2026-06-10T10:00:00.000Z");
    saveScope(scope, paths);

    const saved = loadScope("fix-login-redirect-bug", paths);
    expect(saved.allowed_paths).toContain("src/auth/**");
    expect(saved.allowed_paths).not.toContain("src/**");
    expect(saved.blocked_paths).toContain(".env*");
    expect(saved.high_risk).toContain("package.json");
  });
});
