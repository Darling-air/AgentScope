import { existsSync } from "node:fs";
import { getProjectPaths } from "../../core/fs/project-paths.js";
import { readScope } from "../../core/scope/scope-io.js";
import { saveScope } from "../../core/scope/history.js";
import {
  applyScopeOverride,
  isEmptyOverridePatch,
} from "../../core/scope/override.js";
import type { ScopeContract } from "../../core/schema/scope-contract.js";
import {
  buildOverridePatch,
  type OverrideFlagValues,
} from "../override-flags.js";
import { color, printList } from "../ui.js";
import { scopeHistoryDiffCommand } from "./scope-history.js";

/**
 * `agentscope scope explain | diff | apply`
 *
 * Review and override helpers for the active Task Scope Contract. These never
 * modify `.agentscope/config.yaml`; `apply` writes the active scope and updates
 * the local per-task history snapshot.
 */

function loadActiveScope(
  paths: ReturnType<typeof getProjectPaths>,
): ScopeContract | undefined {
  if (!existsSync(paths.currentScopeFile)) return undefined;
  try {
    return readScope(paths.currentScopeFile);
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// scope explain
// ---------------------------------------------------------------------------

export function scopeExplainCommand(options: { json?: boolean } = {}): void {
  const paths = getProjectPaths();
  const scope = loadActiveScope(paths);

  if (!scope) {
    if (options.json) {
      console.log(
        JSON.stringify(
          { error: "no_active_scope", message: "No active scope found." },
          null,
          2,
        ),
      );
      process.exitCode = 1;
      return;
    }
    console.log("");
    console.log(color.yellow("No active scope found."));
    console.log(
      color.dim('  Run `agentscope start "<task>"` to create one.'),
    );
    console.log("");
    return;
  }

  if (options.json) {
    console.log(JSON.stringify(scope, null, 2));
    return;
  }

  console.log("");
  console.log(color.bold("Task Scope Contract - explanation"));
  console.log("");
  console.log(`Task id:    ${scope.task.id}`);
  console.log(`Task title: ${scope.task.title}`);
  console.log(`Confidence: ${(scope.confidence * 100).toFixed(0)}% (${scope.confidence.toFixed(2)})`);
  console.log("");
  console.log(color.cyan("Allowed paths:"));
  printList(scope.allowed_paths);
  console.log(color.cyan("Blocked paths:"));
  printList(scope.blocked_paths);
  console.log(color.cyan("High-risk paths:"));
  printList(scope.high_risk);
  console.log(color.cyan("Allowed commands:"));
  printList(scope.allowed_commands);
  console.log(color.cyan("Rationale:"));
  printList(scope.rationale);
  console.log("");
}

// ---------------------------------------------------------------------------
// scope diff --task "<task-id>"
// ---------------------------------------------------------------------------

export function scopeDiffCommand(
  options: { task?: string; json?: boolean } = {},
): void {
  scopeHistoryDiffCommand(options);
}

// ---------------------------------------------------------------------------
// scope apply [override flags]
// ---------------------------------------------------------------------------

export interface ScopeApplyOptions extends OverrideFlagValues {
  dryRun?: boolean;
  json?: boolean;
}

export function scopeApplyCommand(options: ScopeApplyOptions = {}): void {
  const paths = getProjectPaths();
  const current = loadActiveScope(paths);

  if (!current) {
    const msg = 'No active scope to apply overrides to. Run `agentscope start "<task>"` first.';
    if (options.json) {
      console.log(JSON.stringify({ error: "no_active_scope", message: msg }, null, 2));
    } else {
      console.error(color.red(msg));
    }
    process.exitCode = 1;
    return;
  }

  const patch = buildOverridePatch(options);
  const empty = isEmptyOverridePatch(patch);
  const next = applyScopeOverride(current, patch);

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          scope: next,
          overrides: patch,
          dry_run: options.dryRun ?? false,
          changed: !empty,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (empty) {
    console.log(
      color.dim("No override flags given - scope unchanged, nothing written."),
    );
    return;
  }

  printScopeApplyResult(next);

  if (options.dryRun) {
    console.log(
      color.dim("Dry run: nothing was written. Re-run without --dry-run to save."),
    );
    return;
  }

  saveScope(next, paths);
  console.log(`${color.green("[OK]")} Overrides applied to ${color.cyan(".agentscope/current-scope.yaml")}`);
  console.log(`  ${color.cyan(`.agentscope/scopes/${next.task.id}.yaml`)}`);
  console.log("");
}

function printScopeApplyResult(scope: ScopeContract): void {
  console.log("");
  console.log(color.bold("Scope after overrides"));
  console.log("");
  console.log(color.cyan("Allowed paths:"));
  printList(scope.allowed_paths);
  console.log(color.cyan("Blocked paths:"));
  printList(scope.blocked_paths);
  console.log(color.cyan("High-risk paths:"));
  printList(scope.high_risk);
  console.log(color.cyan("Allowed commands:"));
  printList(scope.allowed_commands);
  console.log("");
}
