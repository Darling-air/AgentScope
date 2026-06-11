import {
  defaultEffectiveConfig,
  type EffectiveAgentScopeConfig,
} from "./effective-config.js";

/**
 * The effective config AgentScope falls back to when no `.agentscope/config.yaml`
 * exists. This mirrors the built-in defaults; inference and the hook consume the
 * effective config directly.
 */
export function defaultConfig(): EffectiveAgentScopeConfig {
  return defaultEffectiveConfig();
}

/**
 * Serialized default config written by `agentscope init` (V2.1 shape).
 *
 * Every list uses the add/remove structure so a project can tune the built-in
 * defaults without restating them. Empty patches are written so the file is a
 * ready-to-edit template; missing fields fall back to defaults on load.
 */
export const DEFAULT_CONFIG_YAML = `version: 1

policy:
  blocked_paths:
    add: []
    remove: []

  high_risk:
    add: []
    remove: []

  allowed_commands:
    add: []
    remove: []

  dangerous_commands:
    add: []
    remove: []

inference:
  confidence_threshold: 0.65

  fallback:
    enabled: true
    allowed_paths:
      - "src/**"
      - "tests/**"
      - "__tests__/**"

  rule_packs:
    disabled: []
    overrides: {}
`;
