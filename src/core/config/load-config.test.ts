import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadConfig, ConfigError } from "./load-config.js";
import { getProjectPaths } from "../fs/project-paths.js";
import { DEFAULT_CONFIG_YAML } from "./default-config.js";

const tmpDirs: string[] = [];

function makeProject(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "agentscope-cfg-"));
  tmpDirs.push(dir);
  mkdirSync(path.join(dir, ".agentscope"), { recursive: true });
  return dir;
}

afterEach(() => {
  while (tmpDirs.length) {
    const dir = tmpDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("loadConfig", () => {
  it("returns built-in defaults when no config file exists", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "agentscope-nocfg-"));
    tmpDirs.push(dir);
    const cfg = loadConfig(getProjectPaths(dir));
    expect(cfg.defaults.allowed_paths).toContain("src/**");
  });

  it("loads and validates the written default config", () => {
    const dir = makeProject();
    const paths = getProjectPaths(dir);
    writeFileSync(paths.configFile, DEFAULT_CONFIG_YAML, "utf8");

    const cfg = loadConfig(paths);
    expect(cfg.defaults.blocked_paths).toContain(".github/**");
    expect(cfg.defaults.dangerous_commands).toContain("git push --force");
  });

  it("throws ConfigError on invalid YAML structure", () => {
    const dir = makeProject();
    const paths = getProjectPaths(dir);
    writeFileSync(paths.configFile, "defaults: not-an-object\n", "utf8");

    expect(() => loadConfig(paths)).toThrow(ConfigError);
  });
});
