import { z } from "zod";
import {
  RiskLevelSchema,
  RiskScoreV1Schema,
  RiskSeveritySchema,
  type RiskLevel,
  type RiskScoreV1,
  type RiskSeverity,
} from "../risk/risk-score.js";

export const GATE_RESULT_VERSION = "0.1" as const;

export const GateStatusSchema = z.enum(["pass", "fail", "skipped"]);
export type GateStatus = z.infer<typeof GateStatusSchema>;

export const GateReasonSourceSchema = z.enum([
  "risk",
  "decision",
  "rule",
  "config",
  "evidence",
]);
export type GateReasonSource = z.infer<typeof GateReasonSourceSchema>;

export const GateReasonSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  severity: RiskSeveritySchema,
  source: GateReasonSourceSchema,
  details: z.record(z.unknown()).optional(),
});

export interface GateReason {
  id: string;
  label: string;
  severity: RiskSeverity;
  source: GateReasonSource;
  details?: Record<string, unknown>;
}

export const GatePolicySnapshotSchema = z.object({
  enabled: z.boolean(),
  max_score: z.number().min(0).max(100),
  max_level: RiskLevelSchema,
  max_denies: z.number().int().min(0),
  max_asks: z.number().int().min(0),
  allow_warnings: z.boolean(),
  fail_on_blocked_path: z.boolean(),
  fail_on_dangerous_command: z.boolean(),
  fail_on_high_risk_without_review: z.boolean(),
});

export interface GatePolicySnapshot {
  enabled: boolean;
  max_score: number;
  max_level: RiskLevel;
  max_denies: number;
  max_asks: number;
  allow_warnings: boolean;
  fail_on_blocked_path: boolean;
  fail_on_dangerous_command: boolean;
  fail_on_high_risk_without_review: boolean;
}

export const GateResultV1Schema = z.object({
  version: z.literal(GATE_RESULT_VERSION),
  status: GateStatusSchema,
  passed: z.boolean(),
  summary: z.string().min(1),
  task: z.object({
    id: z.string().min(1),
    title: z.string().min(1),
  }),
  scope_hash: z.string().min(1),
  risk: RiskScoreV1Schema,
  policy: GatePolicySnapshotSchema,
  reasons: z.array(GateReasonSchema),
  evidence: z.object({
    path: z.string().optional(),
    created_at: z.string(),
    updated_at: z.string(),
  }),
});

export interface GateResultV1 {
  version: typeof GATE_RESULT_VERSION;
  status: GateStatus;
  passed: boolean;
  summary: string;
  task: {
    id: string;
    title: string;
  };
  scope_hash: string;
  risk: RiskScoreV1;
  policy: GatePolicySnapshot;
  reasons: GateReason[];
  evidence: {
    path?: string;
    created_at: string;
    updated_at: string;
  };
}
