import { z } from "zod";

/**
 * PolicyDecision — the deterministic verdict the PolicyEngine returns for a
 * single ToolEvent. It is intentionally small and explainable: every decision
 * carries a human-readable `reason` and, where applicable, the `matched_rule`
 * that produced it.
 *
 * `risk_delta` is a hint that a future Risk Scoring engine (V1+) can accumulate.
 * It is NOT a full risk score and is not interpreted by the PolicyEngine itself.
 */

export const PolicyDecisionKindSchema = z.enum([
  "allow",
  "deny",
  "ask",
  "warn",
]);
export type PolicyDecisionKind = z.infer<typeof PolicyDecisionKindSchema>;

export const PolicyDecisionSchema = z.object({
  decision: PolicyDecisionKindSchema,
  reason: z.string().min(1),
  matched_rule: z.string().optional(),
  risk_delta: z.number().optional(),
});

export type PolicyDecision = z.infer<typeof PolicyDecisionSchema>;
