import type {
  AgentScopeConfig,
  AddRemove,
  RulePackOverride,
} from "../schema/config.js";

/**
 * Effective config (V2.1).
 *
 * The normalized, fully-resolved configuration the rest of AgentScope consumes.
 * Built-in defaults are merged with the project's add/remove patches (and any
 * legacy `defaults:` block) into flat, ready-to-use lists. Internal code should
 * depend on this shape, never on the raw on-disk config.
 */

export interface EffectiveAgentScopeConfig {
  version: 1;
  policy: {
    blocked_paths: string[];
    high_risk: string[];
    allowed_commands: string[];
    dangerous_commands: string[];
  };
  inference: {
    confidence_threshold: number;
    fallback: {
      enabled: boolean;
      allowed_paths: string[];
    };
    rule_packs: {
      disabled: string[];
      overrides: Record<string, RulePackOverride>;
    };
  };
}

/** Built-in policy/inference defaults (the V2.0 behavior, made explicit). */
export const BUILTIN_DEFAULTS: EffectiveAgentScopeConfig = {
  version: 1,
  policy: {
    blocked_paths: [
      ".env*",
      "secrets/**",
      "migrations/**",
      ".github/**",
      "infra/**",
    ],
    high_risk: [
      "package.json",
      "package-lock.json",
      "pnpm-lock.yaml",
      "yarn.lock",
    ],
    allowed_commands: ["npm test", "npm run lint"],
    dangerous_commands: [
      "rm -rf *",
      "curl * | sh",
      "wget * | sh",
      "git push --force",
      "sudo *",
    ],
  },
  inference: {
    confidence_threshold: 0.65,
    fallback: {
      enabled: true,
      allowed_paths: ["src/**", "tests/**", "__tests__/**"],
    },
    rule_packs: {
      disabled: [],
      overrides: {},
    },
  },
};

/** Returns a deep clone of the built-in defaults so callers can't mutate them. */
export function defaultEffectiveConfig(): EffectiveAgentScopeConfig {
  return structuredClone(BUILTIN_DEFAULTS);
}

/**
 * Applies an add/remove patch to a base list:
 *  - append everything in `add`
 *  - remove every exact match in `remove`
 *  - de-duplicate while preserving first-seen order
 *
 * `remove` runs after `add`, so removing a value also strips it if it was just
 * added (a project explicitly listing a value in both clearly wants it gone).
 */
export function applyAddRemove(
  base: readonly string[],
  patch: AddRemove | undefined,
): string[] {
  const add = patch?.add ?? [];
  const remove = patch?.remove ?? [];
  const removeSet = new Set(remove);

  const merged = [...base, ...add].filter((v) => !removeSet.has(v));
  return [...new Set(merged)];
}

/**
 * Normalizes a validated on-disk config into the effective config.
 *
 * Merge order for each list: built-in defaults → legacy `defaults:` block (if
 * present) → structured `policy.*` add/remove patch. The legacy block is folded
 * in first as a base so old configs keep working; the structured patches then
 * refine it.
 */
export function normalizeConfig(
  config: AgentScopeConfig,
): EffectiveAgentScopeConfig {
  const d = BUILTIN_DEFAULTS;
  const legacy = config.defaults;

  // Legacy lists, when present, replace the built-in base for that list. Then
  // the structured add/remove patch is applied on top.
  const blockedBase = legacy?.blocked_paths ?? d.policy.blocked_paths;
  const highRiskBase = legacy?.high_risk ?? d.policy.high_risk;
  const allowedCmdBase = legacy?.allowed_commands ?? d.policy.allowed_commands;
  const dangerousBase =
    legacy?.dangerous_commands ?? d.policy.dangerous_commands;

  const fallbackBase =
    legacy?.allowed_paths ?? d.inference.fallback.allowed_paths;

  return {
    version: 1,
    policy: {
      blocked_paths: applyAddRemove(blockedBase, config.policy.blocked_paths),
      high_risk: applyAddRemove(highRiskBase, config.policy.high_risk),
      allowed_commands: applyAddRemove(
        allowedCmdBase,
        config.policy.allowed_commands,
      ),
      dangerous_commands: applyAddRemove(
        dangerousBase,
        config.policy.dangerous_commands,
      ),
    },
    inference: {
      confidence_threshold:
        config.inference.confidence_threshold ??
        d.inference.confidence_threshold,
      fallback: {
        enabled:
          config.inference.fallback?.enabled ?? d.inference.fallback.enabled,
        allowed_paths: [
          ...new Set(config.inference.fallback?.allowed_paths ?? fallbackBase),
        ],
      },
      rule_packs: {
        disabled: [...new Set(config.inference.rule_packs?.disabled ?? [])],
        overrides: config.inference.rule_packs?.overrides ?? {},
      },
    },
  };
}
