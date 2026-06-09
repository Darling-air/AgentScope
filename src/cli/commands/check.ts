import { getProjectPaths } from "../../core/fs/project-paths.js";
import { readScope, ScopeError } from "../../core/scope/scope-io.js";
import { getChangedFiles, GitError } from "../../core/git/changed-files.js";
import { checkScope } from "../../core/check/check-scope.js";
import { color, symbol } from "../ui.js";

/**
 * `agentscope check`
 *
 * Reads the current scope, gets changed files from git, classifies each file,
 * and prints a summary. Exit code is 1 only when there is at least one
 * violation (a blocked path was modified). Warnings do not fail.
 */
export function checkCommand(): void {
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

  let changedFiles: string[];
  try {
    changedFiles = getChangedFiles(paths.root);
  } catch (err) {
    if (err instanceof GitError) {
      console.error(color.red(`Error: ${err.message}`));
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  // AgentScope does not police its own metadata directory.
  changedFiles = changedFiles.filter(
    (f) => f !== ".agentscope" && !f.startsWith(".agentscope/"),
  );

  console.log("");
  console.log(color.bold("AgentScope Check"));
  console.log("");
  console.log(`Task: ${scope.task.title}`);
  console.log("");

  if (changedFiles.length === 0) {
    console.log("No changed files detected.");
    console.log("");
    console.log(color.green("Result:"));
    console.log(color.green("PASSED"));
    process.exitCode = 0;
    return;
  }

  const result = checkScope(scope, changedFiles);

  console.log("Changed files:");
  for (const f of result.files) {
    const icon =
      f.status === "ok" ? symbol.ok : f.status === "warning" ? symbol.warn : symbol.fail;
    const name =
      f.status === "ok"
        ? color.green(f.file)
        : f.status === "warning"
          ? color.yellow(f.file)
          : color.red(f.file);
    console.log(`${icon} ${name}`);
    console.log(`   ${color.dim(f.reason)}`);
  }

  console.log("");
  console.log("Summary:");
  console.log(`  ${symbol.ok} OK:         ${result.summary.ok}`);
  console.log(`  ${symbol.warn} Warnings:   ${result.summary.warnings}`);
  console.log(`  ${symbol.fail} Violations: ${result.summary.violations}`);
  console.log("");

  if (result.passed) {
    console.log(color.green("Result:"));
    console.log(color.green("PASSED"));
    process.exitCode = 0;
  } else {
    console.log(color.red("Result:"));
    console.log(color.red("FAILED"));
    process.exitCode = 1;
  }
}
