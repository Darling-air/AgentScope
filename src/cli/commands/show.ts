import { getProjectPaths } from "../../core/fs/project-paths.js";
import { readScope, ScopeError } from "../../core/scope/scope-io.js";
import { color, printList } from "../ui.js";

/**
 * `agentscope show`
 *
 * Reads and displays the current Task Scope Contract.
 */
export function showCommand(): void {
  const paths = getProjectPaths();

  let scope;
  try {
    scope = readScope(paths.currentScopeFile);
  } catch (err) {
    if (err instanceof ScopeError) {
      console.error(color.red(err.message));
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  console.log("");
  console.log(color.bold("Current Task Scope Contract"));
  console.log("");
  console.log(`Task id:    ${scope.task.id}`);
  console.log(`Task title: ${scope.task.title}`);
  console.log(`Confidence: ${(scope.confidence * 100).toFixed(0)}% (${scope.confidence.toFixed(2)})`);
  console.log(`Created at: ${scope.created_at}`);
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
