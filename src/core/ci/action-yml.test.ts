import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import YAML from "yaml";

function loadAction(): { raw: string; parsed: Record<string, unknown> } {
  const raw = readFileSync(path.join(process.cwd(), "action.yml"), "utf8");
  return {
    raw,
    parsed: YAML.parse(raw) as Record<string, unknown>,
  };
}

describe("repo-local action.yml", () => {
  it("exists and is valid YAML", () => {
    const { parsed } = loadAction();
    expect(parsed.name).toBe("AgentScope Gate");
  });

  it("uses a composite action", () => {
    const { parsed } = loadAction();
    const runs = parsed.runs as Record<string, unknown>;
    expect(runs.using).toBe("composite");
  });

  it("has required inputs", () => {
    const { parsed } = loadAction();
    const inputs = parsed.inputs as Record<string, unknown>;
    expect(Object.keys(inputs)).toEqual(
      expect.arrayContaining([
        "package-manager",
        "working-directory",
        "allow-missing-evidence",
        "install-command",
        "gate-command",
      ]),
    );
  });

  it("has required outputs", () => {
    const { parsed } = loadAction();
    const outputs = parsed.outputs as Record<string, unknown>;
    expect(Object.keys(outputs)).toEqual(
      expect.arrayContaining(["status", "score", "level", "result-path"]),
    );
  });

  it("calls agentscope gate --json and writes the CI result", () => {
    const { raw } = loadAction();
    expect(raw).toContain("agentscope gate --json");
    expect(raw).toContain(".agentscope/ci/gate-result.json");
    expect(raw).toContain("gate-exit-code");
  });

  it("does not duplicate gate threshold logic", () => {
    const { raw } = loadAction();
    expect(raw).not.toContain("max_score");
    expect(raw).not.toContain("max_denies");
    expect(raw).not.toContain("blocked_path_denied");
    expect(raw).not.toContain("risk_score_exceeded");
  });

  it("does not call GitHub API", () => {
    const { raw } = loadAction();
    expect(raw).not.toContain("api.github.com");
    expect(raw).not.toContain("gh api");
    expect(raw).not.toContain("GITHUB_TOKEN");
  });

  it("exposes an optional summary-path input", () => {
    const { parsed } = loadAction();
    const inputs = parsed.inputs as Record<string, { required?: boolean }>;
    expect(inputs["summary-path"]).toBeDefined();
    expect(inputs["summary-path"]?.required).toBe(false);
  });

  it("generates the CI summary only when summary-path is provided", () => {
    const { raw } = loadAction();
    expect(raw).toContain("agentscope ci-summary --output");
    expect(raw).toContain("inputs.summary-path != ''");
  });

  it("summary generation never fails the job", () => {
    const { raw } = loadAction();
    // The summary command tolerates failure; the gate exit code is enforced separately.
    expect(raw).toContain("|| true");
    expect(raw).toContain('exit "${{ steps.run-gate.outputs.gate-exit-code }}"');
  });
});
