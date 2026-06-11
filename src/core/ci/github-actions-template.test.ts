import { describe, it, expect } from "vitest";
import { githubActionsWorkflowTemplate } from "./github-actions-template.js";

describe("githubActionsWorkflowTemplate", () => {
  it("generated pnpm workflow contains pnpm install", () => {
    const workflow = githubActionsWorkflowTemplate({ packageManager: "pnpm" });
    expect(workflow).toContain("corepack enable");
    expect(workflow).toContain("pnpm install --frozen-lockfile");
  });

  it("generated pnpm workflow uses pnpm exec agentscope gate --json", () => {
    const workflow = githubActionsWorkflowTemplate({ packageManager: "pnpm" });
    expect(workflow).toContain("pnpm exec agentscope gate --json > .agentscope/ci/gate-result.json");
  });

  it("generated npm workflow contains npm ci", () => {
    const workflow = githubActionsWorkflowTemplate({ packageManager: "npm" });
    expect(workflow).toContain("npm ci");
    expect(workflow).not.toContain("pnpm install");
  });

  it("generated npm workflow uses npx agentscope gate --json", () => {
    const workflow = githubActionsWorkflowTemplate({ packageManager: "npm" });
    expect(workflow).toContain("npx agentscope gate --json > .agentscope/ci/gate-result.json");
  });

  it("allow-missing-evidence adds --allow-missing-evidence", () => {
    const workflow = githubActionsWorkflowTemplate({
      packageManager: "pnpm",
      allowMissingEvidence: true,
    });
    expect(workflow).toContain(
      "pnpm exec agentscope gate --json --allow-missing-evidence > .agentscope/ci/gate-result.json",
    );
  });

  it("workflow writes .agentscope/ci/gate-result.json", () => {
    const workflow = githubActionsWorkflowTemplate();
    expect(workflow).toContain("mkdir -p .agentscope/ci");
    expect(workflow).toContain("> .agentscope/ci/gate-result.json");
    expect(workflow).toContain("cat .agentscope/ci/gate-result.json");
  });

  it("workflow does not duplicate gate logic", () => {
    const workflow = githubActionsWorkflowTemplate();
    expect(workflow).not.toContain("max_score");
    expect(workflow).not.toContain("max_denies");
    expect(workflow).not.toContain("blocked_path_denied");
    expect(workflow).not.toContain("risk_score_exceeded");
  });

  it("generated action-mode workflow uses ./", () => {
    const workflow = githubActionsWorkflowTemplate({ mode: "action" });
    expect(workflow).toContain("uses: ./");
  });

  it("generated action-mode workflow passes package-manager", () => {
    const workflow = githubActionsWorkflowTemplate({
      mode: "action",
      packageManager: "pnpm",
    });
    expect(workflow).toContain("package-manager: pnpm");
  });

  it("direct mode workflow remains unchanged", () => {
    const workflow = githubActionsWorkflowTemplate({ mode: "direct" });
    expect(workflow).toContain("pnpm exec agentscope gate --json > .agentscope/ci/gate-result.json");
    expect(workflow).not.toContain("uses: ./");
  });

  it("allow-missing-evidence works in action mode", () => {
    const workflow = githubActionsWorkflowTemplate({
      mode: "action",
      allowMissingEvidence: true,
    });
    expect(workflow).toContain("allow-missing-evidence: true");
  });

  it("npm package manager works in action mode", () => {
    const workflow = githubActionsWorkflowTemplate({
      mode: "action",
      packageManager: "npm",
    });
    expect(workflow).toContain("npm ci");
    expect(workflow).toContain("package-manager: npm");
  });

  it("direct mode adds a ci-summary step when summaryPath is set", () => {
    const workflow = githubActionsWorkflowTemplate({
      packageManager: "pnpm",
      summaryPath: ".agentscope/ci/summary.md",
    });
    expect(workflow).toContain(
      "pnpm exec agentscope ci-summary --output .agentscope/ci/summary.md",
    );
  });

  it("direct mode npm uses npx for the ci-summary step", () => {
    const workflow = githubActionsWorkflowTemplate({
      packageManager: "npm",
      summaryPath: ".agentscope/ci/summary.md",
    });
    expect(workflow).toContain(
      "npx agentscope ci-summary --output .agentscope/ci/summary.md",
    );
  });

  it("omits the ci-summary step when no summaryPath is set", () => {
    const workflow = githubActionsWorkflowTemplate({ packageManager: "pnpm" });
    expect(workflow).not.toContain("ci-summary");
  });

  it("action mode passes summary-path input when summaryPath is set", () => {
    const workflow = githubActionsWorkflowTemplate({
      mode: "action",
      summaryPath: ".agentscope/ci/summary.md",
    });
    expect(workflow).toContain("summary-path: .agentscope/ci/summary.md");
  });

  it("summary step does not affect the gate exit code", () => {
    const workflow = githubActionsWorkflowTemplate({
      packageManager: "pnpm",
      summaryPath: ".agentscope/ci/summary.md",
    });
    // The gate step still owns the exit code; the summary step is additive.
    expect(workflow).toContain(
      "pnpm exec agentscope gate --json > .agentscope/ci/gate-result.json",
    );
    expect(workflow).toContain("exit $code");
  });
});
