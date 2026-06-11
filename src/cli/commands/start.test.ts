import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { mkdtempSync, rmSync, existsSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { startCommand } from "./start.js";
import { getProjectPaths } from "../../core/fs/project-paths.js";
import { DEFAULT_CONFIG_YAML } from "../../core/config/default-config.js";

const tmpDirs: string[] = [];
let originalCwd: string;
let logSpy: ReturnType<typeof vi.spyOn>;

function makeProject(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "agentscope-start-cli-"));
  tmpDirs.push(dir);
  const paths = getProjectPaths(dir);
  mkdirSync(paths.agentscopeDir, { recursive: true });
  writeFileSync(paths.configFile, DEFAULT_CONFIG_YAML, "utf8");
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

describe("start --dry-run", () => {
  it("shows the inferred scope but does not write current-scope.yaml", async () => {
    const dir = makeProject();
    process.chdir(dir);
    await startCommand("Fix login redirect bug", { dryRun: true });
    const out = output();
    expect(out).toContain("Generated Task Scope Contract");
    expect(out).toContain("src/auth/**");
    expect(out.toLowerCase()).toContain("dry run");
    expect(existsSync(getProjectPaths(dir).currentScopeFile)).toBe(false);
    expect(process.exitCode).toBe(0);
  });
});

describe("start --json", () => {
  it("outputs parseable JSON and writes nothing", async () => {
    const dir = makeProject();
    process.chdir(dir);
    await startCommand("Fix login redirect bug", { json: true });
    const parsed = JSON.parse(output());
    expect(parsed.scope.task.id).toBe("fix-login-redirect-bug");
    expect(parsed.scope.allowed_paths).toContain("src/auth/**");
    expect(parsed.scope.allowed_paths).not.toContain("src/**");
    expect(parsed.classification.domains).toContain("auth");
    expect(parsed.matched_rule_packs).toContain("auth");
    expect(parsed.used_fallback).toBe(false);
    expect(existsSync(getProjectPaths(dir).currentScopeFile)).toBe(false);
  });

  it("emits only JSON (no human-readable summary lines)", async () => {
    const dir = makeProject();
    process.chdir(dir);
    await startCommand("Fix login redirect bug", { json: true });
    const out = output().trim();
    expect(out.startsWith("{")).toBe(true);
    expect(out).not.toContain("Generated Task Scope Contract");
    // The whole thing parses as one JSON document.
    expect(() => JSON.parse(out)).not.toThrow();
  });

  it("returns a structured JSON error for an empty task", async () => {
    const dir = makeProject();
    process.chdir(dir);
    await startCommand("   ", { json: true });
    const parsed = JSON.parse(output());
    expect(parsed.error).toBe("invalid_task");
    expect(process.exitCode).toBe(1);
  });
});

describe("start override flags", () => {
  it("--dry-run --add-allowed shows patched scope and does not write", async () => {
    const dir = makeProject();
    process.chdir(dir);
    await startCommand("Fix login redirect bug", {
      dryRun: true,
      addAllowed: ["app/auth/**"],
    });
    const out = output();
    expect(out).toContain("app/auth/**");
    expect(out).toContain("Override: added allowed path app/auth/**.");
    expect(existsSync(getProjectPaths(dir).currentScopeFile)).toBe(false);
  });

  it("--json includes the patched scope and overrides", async () => {
    const dir = makeProject();
    process.chdir(dir);
    await startCommand("Fix login redirect bug", {
      json: true,
      addAllowed: ["app/auth/**"],
      removeAllowed: ["src/**/login*"],
      addBlocked: ["private/**"],
      addHighRisk: ["scripts/release/**"],
    });
    const parsed = JSON.parse(output());
    expect(parsed.scope.allowed_paths).toContain("app/auth/**");
    expect(parsed.scope.allowed_paths).not.toContain("src/**/login*");
    expect(parsed.scope.blocked_paths).toContain("private/**");
    expect(parsed.scope.high_risk).toContain("scripts/release/**");
    expect(parsed.overrides.allowed_paths.add).toContain("app/auth/**");
    expect(parsed.overrides.allowed_paths.remove).toContain("src/**/login*");
    expect(existsSync(getProjectPaths(dir).currentScopeFile)).toBe(false);
  });

  it("supports repeated --add-allowed", async () => {
    const dir = makeProject();
    process.chdir(dir);
    await startCommand("Fix login redirect bug", {
      json: true,
      addAllowed: ["app/auth/**", "lib/auth/**"],
    });
    const parsed = JSON.parse(output());
    expect(parsed.scope.allowed_paths).toContain("app/auth/**");
    expect(parsed.scope.allowed_paths).toContain("lib/auth/**");
  });

  it("remove-allowed removes the exact path", async () => {
    const dir = makeProject();
    process.chdir(dir);
    await startCommand("Fix login redirect bug", {
      json: true,
      removeAllowed: ["src/auth/**"],
    });
    const parsed = JSON.parse(output());
    expect(parsed.scope.allowed_paths).not.toContain("src/auth/**");
  });

  it("override rationale appears in the patched scope", async () => {
    const dir = makeProject();
    process.chdir(dir);
    await startCommand("Fix login redirect bug", {
      json: true,
      addBlocked: ["private/**"],
    });
    const parsed = JSON.parse(output());
    expect(parsed.scope.rationale).toContain(
      "Override: added blocked path private/**.",
    );
  });

  it("does not modify config.yaml", async () => {
    const dir = makeProject();
    process.chdir(dir);
    const before = readFileSync(getProjectPaths(dir).configFile, "utf8");
    await startCommand("Fix login redirect bug", {
      json: true,
      addAllowed: ["app/auth/**"],
    });
    const after = readFileSync(getProjectPaths(dir).configFile, "utf8");
    expect(after).toBe(before);
  });
});
