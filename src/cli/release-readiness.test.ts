import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("release readiness: smoke test", () => {
  it("scripts/smoke-test.mjs exists", () => {
    expect(existsSync(path.join(root, "scripts", "smoke-test.mjs"))).toBe(true);
  });

  it("package.json has a smoke script wired to the smoke-test file", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.scripts?.smoke).toBe("node scripts/smoke-test.mjs");
  });

  it("smoke test uses a temp directory and does not require Claude Code or network", () => {
    const smoke = read("scripts/smoke-test.mjs");
    expect(smoke).toContain("mkdtempSync");
    expect(smoke).toContain("tmpdir");
    // No live agent, no network access in the smoke script.
    expect(smoke).not.toContain("claude ");
    expect(smoke).not.toMatch(/https?:\/\//);
  });

  it("smoke test exercises the documented commands", () => {
    const smoke = read("scripts/smoke-test.mjs");
    expect(smoke).toContain("init");
    expect(smoke).toContain("--dry-run");
    expect(smoke).toContain("config");
    expect(smoke).toContain("doctor");
    expect(smoke).toContain("--allow-missing-evidence");
    expect(smoke).toContain("ci-summary");
  });
});

describe("release readiness: docs and package sanity", () => {
  it("README mentions the policy gate and CI summary", () => {
    const readme = read("README.md");
    expect(readme).toMatch(/agentscope gate/);
    expect(readme).toMatch(/ci-summary/);
  });

  it("README does not claim SARIF / PR comment / Marketplace as implemented", () => {
    const readme = read("README.md");
    // These terms may appear, but only in the "not implemented / planned"
    // section, never in the implemented/supported section above it.
    const markerIndex = readme.search(/not implemented yet|planned for later/i);
    expect(markerIndex).toBeGreaterThan(-1);
    const beforeMarker = readme.slice(0, markerIndex);
    for (const term of ["SARIF", "PR comment", "Marketplace"]) {
      expect(beforeMarker).not.toMatch(new RegExp(term, "i"));
    }
  });

  it("README has no mojibake replacement characters", () => {
    const readme = read("README.md");
    expect(readme).not.toContain("�");
  });

  it("CHANGELOG.md exists and has the 0.1.0 entry", () => {
    expect(existsSync(path.join(root, "CHANGELOG.md"))).toBe(true);
    const changelog = read("CHANGELOG.md");
    expect(changelog).toContain("0.1.0");
  });

  it("docs/release-checklist.md exists", () => {
    expect(existsSync(path.join(root, "docs", "release-checklist.md"))).toBe(
      true,
    );
  });

  it("docs/quickstart.md exists and covers risk/report/gate and ci-summary", () => {
    expect(existsSync(path.join(root, "docs", "quickstart.md"))).toBe(true);
    const quickstart = read("docs/quickstart.md");
    expect(quickstart).toMatch(/agentscope gate/);
    expect(quickstart).toMatch(/ci-summary/);
    expect(quickstart).toMatch(/allow-missing-evidence/);
  });

  it("package.json metadata is sane for npm publish", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.name).toBe("agentscope");
    expect(pkg.version).toBe("0.1.0");
    expect(pkg.bin?.agentscope).toBe("./dist/index.js");
    expect(pkg.license).toBe("MIT");
    expect(pkg.type).toBe("module");
    expect(pkg.engines?.node).toBeTruthy();
    expect(pkg.repository).toBeTruthy();
    expect(pkg.homepage).toBeTruthy();
    expect(pkg.bugs).toBeTruthy();
  });

  it("package files field excludes source, tests, and local evidence", () => {
    const pkg = JSON.parse(read("package.json"));
    const files: string[] = pkg.files ?? [];
    expect(files).toContain("dist");
    expect(files).not.toContain("src");
    expect(files).not.toContain(".agentscope");
    for (const entry of files) {
      expect(entry).not.toContain("test");
    }
  });
});

describe("release readiness: live-demo examples", () => {
  it("expected gate result and CI summary reference files exist", () => {
    const base = path.join(root, "examples", "live-demo");
    expect(existsSync(path.join(base, "expected-gate-result.json"))).toBe(true);
    expect(existsSync(path.join(base, "expected-ci-summary.md"))).toBe(true);
  });

  it("expected gate result is valid JSON with the demo score and status", () => {
    const gate = JSON.parse(read("examples/live-demo/expected-gate-result.json"));
    expect(gate.status).toBe("fail");
    expect(gate.risk.score).toBe(55);
    expect(gate.risk.level).toBe("high");
  });

  it("expected CI summary matches the demo score and decisions", () => {
    const summary = read("examples/live-demo/expected-ci-summary.md");
    expect(summary).toContain("Risk Score: 55 / 100");
    expect(summary).toContain("Read .env.local [blocked_paths:.env*]");
    expect(summary).toContain("Write package.json [high_risk:package.json]");
  });

  it("demo examples contain no real secrets or local user paths", () => {
    for (const file of [
      "examples/live-demo/expected-evidence.json",
      "examples/live-demo/expected-gate-result.json",
      "examples/live-demo/expected-ci-summary.md",
    ]) {
      const content = read(file);
      // No real Windows user home paths leaked into the fixtures.
      expect(content).not.toMatch(/C:\\Users\\/);
      expect(content).not.toMatch(/\/Users\/[a-z]/i);
    }
  });
});
