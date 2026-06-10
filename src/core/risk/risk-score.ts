import { z } from "zod";

/**
 * RiskScoreV1 (V1.4).
 *
 * A deterministic, explainable risk score computed from a V1.3 Evidence
 * Package. It NEVER changes runtime enforcement — it is a read-only,
 * after-the-fact summary. There is no policy gate, no threshold, no CI failure
 * behavior in V1.4.
 *
 * Score range: 0-100. Levels:
 *   0-24   low
 *   25-49  medium
 *   50-74  high
 *   75-100 critical
 */

export const RISK_SCORE_VERSION = "0.1" as const;

export const RiskLevelSchema = z.enum(["low", "medium", "high", "critical"]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const RiskSeveritySchema = z.enum([
  "info",
  "low",
  "medium",
  "high",
  "critical",
]);
export type RiskSeverity = z.infer<typeof RiskSeveritySchema>;

export const RiskFactorSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  severity: RiskSeveritySchema,
  points: z.number(),
  event_id: z.string().optional(),
  tool_name: z.string().optional(),
  action: z.string().optional(),
  target: z.string().optional(),
  matched_rule: z.string().optional(),
});
export type RiskFactor = z.infer<typeof RiskFactorSchema>;

export const RiskCountsSchema = z.object({
  total_events: z.number().int().min(0),
  allow: z.number().int().min(0),
  deny: z.number().int().min(0),
  ask: z.number().int().min(0),
  warn: z.number().int().min(0),
  policy_interventions: z.number().int().min(0),
});
export type RiskCounts = z.infer<typeof RiskCountsSchema>;

export const RiskScoreV1Schema = z.object({
  version: z.literal(RISK_SCORE_VERSION),
  score: z.number().min(0).max(100),
  level: RiskLevelSchema,
  summary: z.string().min(1),
  task: z.object({
    id: z.string().min(1),
    title: z.string().min(1),
  }),
  scope_hash: z.string().min(1),
  counts: RiskCountsSchema,
  factors: z.array(RiskFactorSchema),
  recommendations: z.array(z.string()),
  evidence: z.object({
    path: z.string().optional(),
    created_at: z.string(),
    updated_at: z.string(),
  }),
});
export type RiskScoreV1 = z.infer<typeof RiskScoreV1Schema>;

/** Maps a clamped 0-100 score to its risk level. */
export function levelForScore(score: number): RiskLevel {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}
