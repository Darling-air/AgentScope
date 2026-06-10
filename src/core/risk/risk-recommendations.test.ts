import { describe, it, expect } from "vitest";
import { buildRecommendations } from "./risk-recommendations.js";
import type { RiskFactor } from "./risk-score.js";

function factor(id: string): RiskFactor {
  return { id, label: id, severity: "medium", points: 10 };
}

describe("buildRecommendations", () => {
  it("returns the reassuring line for no factors", () => {
    expect(buildRecommendations([])).toEqual([
      "No major policy concerns detected in this session.",
    ]);
  });

  it("maps blocked_path_denied", () => {
    expect(buildRecommendations([factor("blocked_path_denied")])).toContain(
      "Review why the agent attempted to access blocked paths.",
    );
  });

  it("maps both dangerous command factor ids to one recommendation", () => {
    const fromDenied = buildRecommendations([factor("dangerous_command_denied")]);
    const fromSeen = buildRecommendations([factor("dangerous_command_seen")]);
    const expected = "Investigate denied dangerous shell commands.";
    expect(fromDenied).toContain(expected);
    expect(fromSeen).toContain(expected);
  });

  it("does not duplicate the dangerous recommendation when both ids present", () => {
    const recs = buildRecommendations([
      factor("dangerous_command_denied"),
      factor("dangerous_command_seen"),
    ]);
    const count = recs.filter(
      (r) => r === "Investigate denied dangerous shell commands.",
    ).length;
    expect(count).toBe(1);
  });

  it("is deterministic / stable in order", () => {
    const factors = [
      factor("many_policy_interventions"),
      factor("blocked_path_denied"),
      factor("high_risk_approval_required"),
    ];
    const a = buildRecommendations(factors);
    const b = buildRecommendations(factors);
    expect(a).toEqual(b);
    // blocked path rule is declared before high-risk and interventions rules.
    expect(a[0]).toBe("Review why the agent attempted to access blocked paths.");
  });
});
