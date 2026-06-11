import { getProjectPaths } from "../../core/fs/project-paths.js";
import { loadConfig, ConfigError } from "../../core/config/load-config.js";
import { createScopeWithInference } from "../../core/scope/create-scope.js";
import { applyScopeOverride } from "../../core/scope/override.js";
import { saveScope } from "../../core/scope/history.js";
import type { ScopeContract } from "../../core/schema/scope-contract.js";
import {
  buildOverridePatch,
  type OverrideFlagValues,
} from "../override-flags.js";
import { color, printList } from "../ui.js";
import { prompt } from "../prompt.js";

export interface StartOptions extends OverrideFlagValues {
  /** Show the inferred scope without writing or prompting. */
  dryRun?: boolean;
  /** Emit the inferred scope as parseable JSON (implies no write/prompt). */
  json?: boolean;
}

/** Renders a Task Scope Contract as a readable summary block. */
export function printScopeSummary(scope: ScopeContract): void {
  console.log("");
  console.log(color.bold("Generated Task Scope Contract"));
  console.log("");
  console.log(`Task:       ${scope.task.title}`);
  console.log(`Task id:    ${scope.task.id}`);
  console.log(`Confidence: ${formatConfidence(scope.confidence)}`);
  console.log("");
  console.log(color.cyan("Allowed paths:"));
  printList(scope.allowed_paths);
  console.log(color.cyan("Blocked paths:"));
  printList(scope.blocked_paths);
  console.log(color.cyan("High risk:"));
  printList(scope.high_risk);
  console.log(color.cyan("Allowed commands:"));
  printList(scope.allowed_commands);
  console.log(color.cyan("Rationale:"));
  printList(scope.rationale);
  console.log("");
}

function formatConfidence(c: number): string {
  const pct = `${(c * 100).toFixed(0)}% (${c.toFixed(2)})`;
  if (c >= 0.75) return color.green(pct);
  if (c >= 0.6) return color.yellow(pct);
  return color.red(pct);
}

/**
 * `agentscope start "<task>"`
 *
 * Infers a Task Scope Contract from the task description, shows it, asks for
 * approval, then writes it to current-scope.yaml and scopes/<id>.yaml.
 *
 * `--dry-run` shows the inferred scope without writing or prompting.
 * `--json` emits the inferred scope (plus classification metadata) as JSON and,
 * like `--dry-run`, writes nothing and skips the prompt.
 */
export async function startCommand(
  task: string,
  options: StartOptions = {},
): Promise<void> {
  const title = task.trim();
  if (!title) {
    if (options.json) {
      console.log(
        JSON.stringify(
          { error: "invalid_task", message: "task description is required" },
          null,
          2,
        ),
      );
      process.exitCode = 1;
      return;
    }
    console.error(
      color.red('Error: task description is required. Usage: agentscope start "<task>"'),
    );
    process.exitCode = 1;
    return;
  }

  const paths = getProjectPaths();

  let config;
  try {
    config = loadConfig(paths);
  } catch (err) {
    if (err instanceof ConfigError) {
      if (options.json) {
        console.log(
          JSON.stringify({ error: "config_error", message: err.message }, null, 2),
        );
      } else {
        console.error(color.red(err.message));
      }
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  const inferred = createScopeWithInference({
    rawInput: task,
    config,
    createdAt: new Date().toISOString(),
  });

  // Apply any user override flags AFTER inference. This adjusts only this scope;
  // it never touches config.yaml. Override rationale is recorded on the scope.
  const overrides = buildOverridePatch(options);
  const scope = applyScopeOverride(inferred.scope, overrides);

  // --json: machine-readable output, no write, no prompt.
  if (options.json) {
    console.log(
      JSON.stringify(
        {
          scope,
          classification: inferred.classification,
          matched_rule_packs: inferred.matchedRulePacks,
          used_fallback: inferred.usedFallback,
          overrides,
          dry_run: options.dryRun ?? false,
        },
        null,
        2,
      ),
    );
    process.exitCode = 0;
    return;
  }

  printScopeSummary(scope);

  // --dry-run: show the scope, write nothing, skip the prompt.
  if (options.dryRun) {
    console.log(
      color.dim(
        "Dry run: nothing was written. Re-run without --dry-run to approve and save.",
      ),
    );
    process.exitCode = 0;
    return;
  }

  const answer = (await prompt("Approve? [Y/n/e] ")).toLowerCase();

  if (answer === "n" || answer === "no") {
    console.log(color.dim("Aborted. No scope was written."));
    return;
  }

  if (answer === "e" || answer === "edit") {
    // V0: write the file, then point the user at it to edit manually.
    writeScopeFiles(paths, scope);
    console.log("");
    console.log(
      `${color.yellow("Edit mode:")} scope written. Edit it manually at ${color.cyan(
        ".agentscope/current-scope.yaml",
      )}, then run ${color.bold("agentscope show")} to review.`,
    );
    return;
  }

  // Default (Y / empty) approves.
  writeScopeFiles(paths, scope);
  console.log(`${color.green("✔")} Scope approved and saved.`);
  console.log(`  ${color.cyan(".agentscope/current-scope.yaml")}`);
  console.log(`  ${color.cyan(`.agentscope/scopes/${scope.task.id}.yaml`)}`);
  console.log("");
  console.log(`Next: make your changes, then run ${color.bold("agentscope check")}`);
}

function writeScopeFiles(
  paths: ReturnType<typeof getProjectPaths>,
  scope: ScopeContract,
): void {
  saveScope(scope, paths);
}
