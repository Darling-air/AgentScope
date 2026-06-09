import type { AgentScopeConfig } from "../schema/config.js";

/**
 * The default project configuration written by `agentscope init` and used as a
 * fallback by scope inference. Values mirror the V0 spec in CLAUDE.md.
 */
export function defaultConfig(): AgentScopeConfig {
  return {
    project: {
      package_manager: "auto",
    },
    defaults: {
      allowed_paths: ["src/**", "tests/**", "__tests__/**"],
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
  };
}

/**
 * Serialized form of the default config. Written verbatim by `agentscope init`
 * so the file stays human-readable and comment-friendly for the user to edit.
 */
export const DEFAULT_CONFIG_YAML = `project:
  package_manager: auto

defaults:
  allowed_paths:
    - "src/**"
    - "tests/**"
    - "__tests__/**"

  blocked_paths:
    - ".env*"
    - "secrets/**"
    - "migrations/**"
    - ".github/**"
    - "infra/**"

  high_risk:
    - "package.json"
    - "package-lock.json"
    - "pnpm-lock.yaml"
    - "yarn.lock"

  allowed_commands:
    - "npm test"
    - "npm run lint"

  dangerous_commands:
    - "rm -rf *"
    - "curl * | sh"
    - "wget * | sh"
    - "git push --force"
    - "sudo *"
`;
