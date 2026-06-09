import { existsSync, readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { AgentScopeConfigSchema, type AgentScopeConfig } from "../schema/config.js";
import { defaultConfig } from "./default-config.js";
import type { ProjectPaths } from "../fs/project-paths.js";

/**
 * Raised when a config file exists but cannot be parsed or fails validation.
 * Carries a user-actionable message.
 */
export class ConfigError extends Error {}

/**
 * Loads `.agentscope/config.yaml`. If the file does not exist, falls back to
 * the built-in defaults (so `agentscope start` still works without `init`).
 *
 * Throws ConfigError with a clear message when the file exists but is invalid.
 */
export function loadConfig(paths: ProjectPaths): AgentScopeConfig {
  if (!existsSync(paths.configFile)) {
    return defaultConfig();
  }

  let raw: unknown;
  try {
    raw = parseYaml(readFileSync(paths.configFile, "utf8"));
  } catch (err) {
    throw new ConfigError(
      `Failed to parse ${paths.configFile}: ${(err as Error).message}`,
    );
  }

  const result = AgentScopeConfigSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new ConfigError(
      `Invalid config at ${paths.configFile}:\n${issues}`,
    );
  }

  return result.data;
}
