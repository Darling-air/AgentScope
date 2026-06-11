import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { configShowCommand, configValidateCommand } from "./config.js";
import { initCommand } from "./init.js";
import { getProjectPaths } from "../../core/fs/project-paths.js";
import { DEFAULT_CONFIG_YAML } from "../../core/config/default-config.js";

const tmpDirs: string[] = [];
let originalCwd: string;
let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;

function makeProject(withConfig = true): string {
  const dir = mkdtempSync(path.join(tmpdir(), "agentscope-config-cli-"));
  tmpDirs.push(dir);
  const paths = getProjectPaths(dir);
  mkdirSync(paths.agentscopeDir, { recursive: true });
  if (withConfig) writeFileSync(paths.configFile, DEFAULT_CONFIG_YAML, "utf8");
  return dir;
}

function writeConfig(dir: string, yaml: string): void {
  writeFileSync(getProjectPaths(dir).configFile, yaml, "utf8");
}

function out(): string {
  return [...logSpy.mock.calls, ...errSpy.mock.calls]
    .map((c) => c.join(" "))
    .join("\n");
}

function logOut(): string {
  return logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
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

describe("config show", () => {
  it("shows effective config with a config file", () => {
    const dir = makeProject();
    process.chdir(dir);
    configShowCommand();
    const text = out();
    expect(text).toContain("AgentScope Effective Config");
    expect(text).toContain("Blocked paths:");
    expect(text).toContain(".env*");
    expect(text).toContain("Confidence threshold: 0.65");
    expect(text).toContain("Gate policy:");
    expect(text).toContain("Max score:");
  });

  it("works without a config file and notes defaults", () => {
    const dir = makeProject(false);
    process.chdir(dir);
    configShowCommand();
    expect(out()).toContain("built-in defaults");
  });

  it("--json outputs parseable JSON only", () => {
    const dir = makeProject();
    process.chdir(dir);
    configShowCommand({ json: true });
    const text = logOut().trim();
    expect(text.startsWith("{")).toBe(true);
    const parsed = JSON.parse(text);
    expect(parsed.config.policy.blocked_paths).toContain(".env*");
    expect(parsed.config.inference.confidence_threshold).toBe(0.65);
    expect(parsed.config.gate.risk.max_score).toBe(74);
    expect(parsed.config.gate.risk.max_level).toBe("high");
  });
});

describe("config validate", () => {
  it("reports valid for a good config (exit 0)", () => {
    const dir = makeProject();
    process.chdir(dir);
    configValidateCommand();
    expect(out().toLowerCase()).toContain("valid");
    expect(process.exitCode).toBe(0);
  });

  it("reports defaults when no config exists (exit 0)", () => {
    const dir = makeProject(false);
    process.chdir(dir);
    configValidateCommand();
    expect(out().toLowerCase()).toContain("no config");
    expect(process.exitCode).toBe(0);
  });

  it("returns exit 1 on invalid config", () => {
    const dir = makeProject();
    writeConfig(dir, "version: 99\n");
    process.chdir(dir);
    configValidateCommand();
    expect(process.exitCode).toBe(1);
    expect(out().toLowerCase()).toContain("invalid");
  });

  it("catches invalid gate config", () => {
    const dir = makeProject();
    writeConfig(
      dir,
      `version: 1
gate:
  risk:
    max_score: -1
`,
    );
    process.chdir(dir);
    configValidateCommand();
    expect(process.exitCode).toBe(1);
    expect(out()).toContain("gate.risk.max_score");
  });
});

describe("init", () => {
  it("writes default gate config", () => {
    const dir = makeProject(false);
    process.chdir(dir);
    initCommand();
    const config = readFileSync(getProjectPaths(dir).configFile, "utf8");
    expect(config).toContain("gate:");
    expect(config).toContain("max_score: 74");
    expect(config).toContain("fail_on_blocked_path: true");
  });
});
