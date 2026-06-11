import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadConfig, loadConfigResult, ConfigError } from "./load-config.js";
import { getProjectPaths } from "../fs/project-paths.js";
import { DEFAULT_CONFIG_YAML } from "./default-config.js";

const tmpDirs: string[] = [];

function makeProject(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "agentscope-cfg-"));
  tmpDirs.push(dir);
  mkdirSync(path.join(dir, ".agentscope"), { recursive: true });
  return dir;
}

function writeConfig(dir: string, yaml: string): void {
  writeFileSync(getProjectPaths(dir).configFile, yaml, "utf8");
}

afterEach(() => {
  while (tmpDirs.length) {
    const dir = tmpDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("loadConfig (effective)", () => {
  it("returns built-in defaults when no config file exists", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "agentscope-nocfg-"));
    tmpDirs.push(dir);
    const cfg = loadConfig(getProjectPaths(dir));
    expect(cfg.policy.blocked_paths).toContain(".env*");
    expect(cfg.inference.fallback.allowed_paths).toContain("src/**");
  });

  it("loads and normalizes the written default config", () => {
    const dir = makeProject();
    writeConfig(dir, DEFAULT_CONFIG_YAML);
    const cfg = loadConfig(getProjectPaths(dir));
    expect(cfg.policy.blocked_paths).toContain(".github/**");
    expect(cfg.policy.dangerous_commands).toContain("git push --force");
  });

  it("applies blocked_paths add/remove", () => {
    const dir = makeProject();
    writeConfig(
      dir,
      `version: 1
policy:
  blocked_paths:
    add:
      - private/**
    remove:
      - infra/**
`,
    );
    const cfg = loadConfig(getProjectPaths(dir));
    expect(cfg.policy.blocked_paths).toContain("private/**");
    expect(cfg.policy.blocked_paths).not.toContain("infra/**");
    // unaffected defaults remain
    expect(cfg.policy.blocked_paths).toContain(".env*");
  });

  it("applies high_risk and allowed_commands add", () => {
    const dir = makeProject();
    writeConfig(
      dir,
      `version: 1
policy:
  high_risk:
    add:
      - scripts/release/**
  allowed_commands:
    add:
      - npm run test:auth
`,
    );
    const cfg = loadConfig(getProjectPaths(dir));
    expect(cfg.policy.high_risk).toContain("scripts/release/**");
    expect(cfg.policy.allowed_commands).toContain("npm run test:auth");
  });

  it("applies dangerous_commands add/remove", () => {
    const dir = makeProject();
    writeConfig(
      dir,
      `version: 1
policy:
  dangerous_commands:
    add:
      - gh secret *
    remove:
      - sudo *
`,
    );
    const cfg = loadConfig(getProjectPaths(dir));
    expect(cfg.policy.dangerous_commands).toContain("gh secret *");
    expect(cfg.policy.dangerous_commands).not.toContain("sudo *");
    expect(cfg.policy.dangerous_commands).toContain("git push --force");
  });

  it("honors inference overrides", () => {
    const dir = makeProject();
    writeConfig(
      dir,
      `version: 1
inference:
  confidence_threshold: 0.9
  fallback:
    enabled: false
    allowed_paths:
      - app/**
  rule_packs:
    disabled:
      - frontend
    overrides:
      auth:
        allowed_paths:
          add:
            - app/auth/**
`,
    );
    const cfg = loadConfig(getProjectPaths(dir));
    expect(cfg.inference.confidence_threshold).toBe(0.9);
    expect(cfg.inference.fallback.enabled).toBe(false);
    expect(cfg.inference.fallback.allowed_paths).toEqual(["app/**"]);
    expect(cfg.inference.rule_packs.disabled).toContain("frontend");
    expect(cfg.inference.rule_packs.overrides.auth?.allowed_paths?.add).toContain(
      "app/auth/**",
    );
  });

  it("fills defaults for a partial config", () => {
    const dir = makeProject();
    writeConfig(dir, `version: 1\npolicy:\n  high_risk:\n    add:\n      - x/**\n`);
    const cfg = loadConfig(getProjectPaths(dir));
    expect(cfg.policy.high_risk).toContain("x/**");
    // everything else falls back to defaults
    expect(cfg.policy.blocked_paths).toContain(".env*");
    expect(cfg.inference.confidence_threshold).toBe(0.65);
  });

  it("supports legacy top-level defaults.dangerous_commands", () => {
    const dir = makeProject();
    writeConfig(
      dir,
      `project:
  package_manager: pnpm
defaults:
  allowed_paths:
    - src/**
  blocked_paths:
    - .env*
  high_risk:
    - package.json
  allowed_commands:
    - npm test
  dangerous_commands:
    - rm -rf *
    - my-legacy-danger *
`,
    );
    const cfg = loadConfig(getProjectPaths(dir));
    expect(cfg.policy.dangerous_commands).toContain("my-legacy-danger *");
    expect(cfg.policy.blocked_paths).toEqual([".env*"]);
  });

  it("throws ConfigError on invalid structure", () => {
    const dir = makeProject();
    writeConfig(dir, "policy: not-an-object\n");
    expect(() => loadConfig(getProjectPaths(dir))).toThrow(ConfigError);
  });

  it("rejects unknown top-level keys", () => {
    const dir = makeProject();
    writeConfig(dir, "version: 1\nbogus: true\n");
    expect(() => loadConfig(getProjectPaths(dir))).toThrow(ConfigError);
  });
});

describe("loadConfigResult", () => {
  it("reports usedDefaults when no file exists", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "agentscope-nocfg2-"));
    tmpDirs.push(dir);
    const r = loadConfigResult(getProjectPaths(dir));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.usedDefaults).toBe(true);
  });

  it("returns ok:false with a message on invalid config (no throw)", () => {
    const dir = makeProject();
    writeConfig(dir, "version: 2\n");
    const r = loadConfigResult(getProjectPaths(dir));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("Invalid config");
  });

  it("treats an empty file as defaults", () => {
    const dir = makeProject();
    writeConfig(dir, "");
    const r = loadConfigResult(getProjectPaths(dir));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config.policy.blocked_paths).toContain(".env*");
  });
});
