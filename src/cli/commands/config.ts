import { getProjectPaths } from "../../core/fs/project-paths.js";
import {
  loadConfigResult,
  type LoadConfigResult,
} from "../../core/config/load-config.js";
import type { EffectiveAgentScopeConfig } from "../../core/config/effective-config.js";
import { color, printList } from "../ui.js";

/**
 * `agentscope config show [--json]` and `agentscope config validate`.
 *
 * Read-only views over the normalized effective config. These never modify the
 * config file and never affect runtime enforcement.
 */

export function configShowCommand(options: { json?: boolean } = {}): void {
  const paths = getProjectPaths();
  const result = loadConfigResult(paths);

  if (options.json) {
    printJson(result, paths.configFile);
    return;
  }

  if (!result.ok) {
    console.error(color.red(result.message));
    process.exitCode = 1;
    return;
  }

  printHuman(result, paths.configFile);
}

function printJson(result: LoadConfigResult, configFile: string): void {
  if (!result.ok) {
    console.log(
      JSON.stringify(
        { error: "invalid_config", message: result.message, config_path: configFile },
        null,
        2,
      ),
    );
    process.exitCode = 1;
    return;
  }
  console.log(
    JSON.stringify(
      {
        config_path: configFile,
        used_defaults: result.usedDefaults,
        config: result.config,
      },
      null,
      2,
    ),
  );
}

function printHuman(
  result: Extract<LoadConfigResult, { ok: true }>,
  configFile: string,
): void {
  const c: EffectiveAgentScopeConfig = result.config;

  console.log("");
  console.log(color.bold("AgentScope Effective Config"));
  console.log("");
  console.log(`Config path: ${configFile}`);
  if (result.usedDefaults) {
    console.log(color.dim("  (no config file found — using built-in defaults)"));
  }
  console.log(`Version:     ${c.version}`);
  console.log("");

  console.log(color.cyan("Blocked paths:"));
  printList(c.policy.blocked_paths);
  console.log(color.cyan("High-risk paths:"));
  printList(c.policy.high_risk);
  console.log(color.cyan("Allowed commands:"));
  printList(c.policy.allowed_commands);
  console.log(color.cyan("Dangerous commands:"));
  printList(c.policy.dangerous_commands);
  console.log("");

  console.log(color.cyan("Inference:"));
  console.log(`  Confidence threshold: ${c.inference.confidence_threshold}`);
  console.log(`  Fallback enabled:     ${c.inference.fallback.enabled}`);
  console.log(color.cyan("  Fallback paths:"));
  printList(c.inference.fallback.allowed_paths, "    ");
  console.log(color.cyan("  Disabled rule packs:"));
  printList(c.inference.rule_packs.disabled, "    ");

  const overrideIds = Object.keys(c.inference.rule_packs.overrides);
  console.log(color.cyan("  Rule pack overrides:"));
  if (overrideIds.length === 0) {
    console.log(color.dim("    (none)"));
  } else {
    for (const id of overrideIds) {
      console.log(`    - ${id}`);
    }
  }
  console.log("");
}

export function configValidateCommand(): void {
  const paths = getProjectPaths();
  const result = loadConfigResult(paths);

  if (!result.ok) {
    console.error(color.red("Invalid config:"));
    console.error(result.message);
    process.exitCode = 1;
    return;
  }

  if (result.usedDefaults) {
    console.log(color.dim("No config found — using built-in defaults."));
    process.exitCode = 0;
    return;
  }

  console.log(`${color.green("✔")} Config is valid: ${paths.configFile}`);
  process.exitCode = 0;
}
