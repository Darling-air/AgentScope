import { existsSync, readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { AgentScopeConfigSchema } from "../schema/config.js";
import {
  defaultEffectiveConfig,
  normalizeConfig,
  type EffectiveAgentScopeConfig,
} from "./effective-config.js";
import type { ProjectPaths } from "../fs/project-paths.js";

/**
 * Raised when a config file exists but cannot be parsed or fails validation.
 * Carries a user-actionable message.
 */
export class ConfigError extends Error {}

/** Formats Zod issues into an indented, user-readable list. */
function formatIssues(issues: { path: (string | number)[]; message: string }[]): string {
  return issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
}

/**
 * Loads `.agentscope/config.yaml` and returns the normalized effective config.
 *
 * - File missing -> built-in defaults (so `agentscope start` works without init)
 * - File present + valid -> defaults merged with the project's add/remove patches
 * - File present + invalid -> throws ConfigError with a clear, actionable message
 */
export function loadConfig(paths: ProjectPaths): EffectiveAgentScopeConfig {
  const result = loadConfigResult(paths);
  if (!result.ok) {
    throw new ConfigError(result.message);
  }
  return result.config;
}

export type LoadConfigResult =
  | {
      ok: true;
      /** True when no config file existed and defaults were used. */
      usedDefaults: boolean;
      config: EffectiveAgentScopeConfig;
    }
  | {
      ok: false;
      /** A user-readable validation/parse error message. */
      message: string;
    };

/**
 * Like `loadConfig` but never throws — returns a discriminated result. Used by
 * `agentscope config validate` (which wants to report errors, not crash) and by
 * the hook entrypoint (which must degrade safely on bad config).
 */
export function loadConfigResult(paths: ProjectPaths): LoadConfigResult {
  if (!existsSync(paths.configFile)) {
    return { ok: true, usedDefaults: true, config: defaultEffectiveConfig() };
  }

  let raw: unknown;
  try {
    raw = parseYaml(readFileSync(paths.configFile, "utf8"));
  } catch (err) {
    return {
      ok: false,
      message: `Failed to parse ${paths.configFile}: ${(err as Error).message}`,
    };
  }

  // An empty file parses to null; treat it as an empty config object.
  const candidate = raw == null ? {} : raw;

  const parsed = AgentScopeConfigSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      message: `Invalid config at ${paths.configFile}:\n${formatIssues(parsed.error.issues)}`,
    };
  }

  return {
    ok: true,
    usedDefaults: false,
    config: normalizeConfig(parsed.data),
  };
}
