import { z } from "zod";

/**
 * AgentScope project configuration schema (.agentscope/config.yaml).
 *
 * V2.1 introduces a structured, add/remove-based config so a project can tune
 * the built-in policy defaults and inference preferences without restating the
 * whole list. The shape is:
 *
 *   version: 1
 *   policy:
 *     blocked_paths:      { add: [...], remove: [...] }
 *     high_risk:          { add: [...], remove: [...] }
 *     allowed_commands:   { add: [...], remove: [...] }
 *     dangerous_commands: { add: [...], remove: [...] }
 *   inference:
 *     confidence_threshold: 0.65
 *     fallback: { enabled: true, allowed_paths: [...] }
 *     rule_packs: { disabled: [...], overrides: { <id>: {...} } }
 *
 * Every field is optional; missing fields fall back to built-in defaults during
 * normalization. Backward compatibility: the legacy V0/V2.0 shape (a top-level
 * `defaults:` block, including `defaults.dangerous_commands`) still parses and
 * is folded into the effective config.
 */

/** An add/remove patch over a default string list. Both sides optional. */
export const AddRemoveSchema = z
  .object({
    add: z.array(z.string()).default([]),
    remove: z.array(z.string()).default([]),
  })
  .default({ add: [], remove: [] });

export type AddRemove = z.infer<typeof AddRemoveSchema>;

/** Per-rule-pack override: add/remove patches for its lists. */
export const RulePackOverrideSchema = z.object({
  allowed_paths: AddRemoveSchema.optional(),
  allowed_commands: AddRemoveSchema.optional(),
  high_risk: AddRemoveSchema.optional(),
});

export type RulePackOverride = z.infer<typeof RulePackOverrideSchema>;

export const PolicyConfigSchema = z
  .object({
    blocked_paths: AddRemoveSchema.optional(),
    high_risk: AddRemoveSchema.optional(),
    allowed_commands: AddRemoveSchema.optional(),
    dangerous_commands: AddRemoveSchema.optional(),
  })
  .default({});

export const InferenceConfigSchema = z
  .object({
    confidence_threshold: z.number().min(0).max(1).optional(),
    fallback: z
      .object({
        enabled: z.boolean().optional(),
        allowed_paths: z.array(z.string()).optional(),
      })
      .optional(),
    rule_packs: z
      .object({
        disabled: z.array(z.string()).default([]),
        overrides: z.record(RulePackOverrideSchema).default({}),
      })
      .optional(),
  })
  .default({});

export const GateRiskLevelSchema = z.enum([
  "low",
  "medium",
  "high",
  "critical",
]);

export const GateConfigSchema = z
  .object({
    enabled: z.boolean().default(true),
    risk: z
      .object({
        max_score: z.number().min(0).max(100).default(74),
        max_level: GateRiskLevelSchema.default("high"),
      })
      .default({}),
    decisions: z
      .object({
        max_denies: z.number().int().min(0).default(0),
        max_asks: z.number().int().min(0).default(10),
        allow_warnings: z.boolean().default(true),
      })
      .default({}),
    rules: z
      .object({
        fail_on_blocked_path: z.boolean().default(true),
        fail_on_dangerous_command: z.boolean().default(true),
        fail_on_high_risk_without_review: z.boolean().default(false),
      })
      .default({}),
  })
  .default({});

export type GateConfig = z.infer<typeof GateConfigSchema>;

/**
 * Legacy defaults block (V0/V2.0). Kept optional so old config files continue
 * to validate and contribute their values to the effective config.
 */
export const LegacyDefaultsSchema = z.object({
  allowed_paths: z.array(z.string()).optional(),
  blocked_paths: z.array(z.string()).optional(),
  high_risk: z.array(z.string()).optional(),
  allowed_commands: z.array(z.string()).optional(),
  dangerous_commands: z.array(z.string()).optional(),
});

export type LegacyDefaults = z.infer<typeof LegacyDefaultsSchema>;

/**
 * The on-disk config schema. `version` defaults to 1. `policy` / `inference`
 * carry the V2.1 structured config; `project` and `defaults` preserve the
 * legacy shape. Unknown top-level keys are rejected so typos surface as errors.
 */
export const AgentScopeConfigSchema = z.object({
  version: z.literal(1).default(1),
  project: z
    .object({
      package_manager: z.string().default("auto"),
    })
    .default({ package_manager: "auto" }),
  policy: PolicyConfigSchema,
  inference: InferenceConfigSchema,
  gate: GateConfigSchema,
  /** Legacy V0/V2.0 defaults block (still honored for back-compat). */
  defaults: LegacyDefaultsSchema.optional(),
}).strict();

export type AgentScopeConfig = z.infer<typeof AgentScopeConfigSchema>;
