import { mkdirSync, existsSync } from "node:fs";
import { getProjectPaths, scopeFileForTask } from "../../core/fs/project-paths.js";
import { loadConfig, ConfigError } from "../../core/config/load-config.js";
import { createScope } from "../../core/scope/create-scope.js";
import { writeScope } from "../../core/scope/scope-io.js";
import type { ScopeContract } from "../../core/schema/scope-contract.js";
import { color, printList } from "../ui.js";
import { prompt } from "../prompt.js";

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
 */
export async function startCommand(task: string): Promise<void> {
  const title = task.trim();
  if (!title) {
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
      console.error(color.red(err.message));
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  const scope = createScope({
    rawInput: task,
    config,
    createdAt: new Date().toISOString(),
  });

  printScopeSummary(scope);

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
  if (!existsSync(paths.scopesDir)) {
    mkdirSync(paths.scopesDir, { recursive: true });
  }
  writeScope(paths.currentScopeFile, scope);
  writeScope(scopeFileForTask(paths, scope.task.id), scope);
}
