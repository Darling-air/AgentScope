import type { RiskFactor } from "./risk-score.js";

/**
 * Deterministic risk recommendations (V1.4).
 *
 * Maps the set of factor ids present in a risk score to short, plain
 * recommendations. No LLM, no network, no exaggerated security claims — just a
 * fixed, testable lookup driven by which factors fired.
 *
 * Order is stable (declaration order below) so the output is deterministic for
 * a given set of factors.
 */

interface RecommendationRule {
  /** Recommendation fires if ANY of these factor ids are present. */
  whenAnyFactor: string[];
  text: string;
}

const RULES: RecommendationRule[] = [
  {
    whenAnyFactor: ["blocked_path_denied"],
    text: "Review why the agent attempted to access blocked paths.",
  },
  {
    whenAnyFactor: ["dangerous_command_denied", "dangerous_command_seen"],
    text: "Investigate denied dangerous shell commands.",
  },
  {
    whenAnyFactor: ["high_risk_approval_required"],
    text: "Manually review high-risk file changes before merging.",
  },
  {
    whenAnyFactor: ["out_of_scope_approval_required"],
    text: "Review whether the task scope should be narrowed or explicitly expanded.",
  },
  {
    whenAnyFactor: ["many_policy_interventions", "multiple_denied_actions"],
    text: "Review this session before trusting the final changes.",
  },
];

const NO_CONCERN =
  "No major policy concerns detected in this session.";

/**
 * Builds the recommendation list from the factors. Returns a single reassuring
 * line when no risk-bearing factor fired.
 */
export function buildRecommendations(factors: RiskFactor[]): string[] {
  const ids = new Set(factors.map((f) => f.id));

  const out: string[] = [];
  for (const rule of RULES) {
    if (rule.whenAnyFactor.some((id) => ids.has(id))) {
      out.push(rule.text);
    }
  }

  if (out.length === 0) {
    return [NO_CONCERN];
  }
  return out;
}
