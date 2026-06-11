import { existsSync } from "node:fs";
import { getProjectPaths } from "../../core/fs/project-paths.js";
import { diffScopes, type ScopeDiff } from "../../core/scope/diff.js";
import {
  listScopes,
  loadScope,
  useScope,
  type ScopeHistoryEntry,
} from "../../core/scope/history.js";
import { readScope, ScopeError } from "../../core/scope/scope-io.js";
import { color } from "../ui.js";

export function scopeListCommand(options: { json?: boolean } = {}): void {
  const paths = getProjectPaths();

  let entries: ScopeHistoryEntry[];
  try {
    entries = listScopes(paths);
  } catch (err) {
    handleScopeHistoryError(err, options.json);
    return;
  }

  if (options.json) {
    console.log(JSON.stringify({ scopes: entries }, null, 2));
    return;
  }

  console.log("");
  console.log(color.bold("Saved task scopes"));
  console.log("");

  if (entries.length === 0) {
    console.log(color.dim("  (none)"));
    console.log("");
    return;
  }

  for (const entry of entries) {
    console.log(`${entry.task_id}`);
    console.log(`  title:      ${entry.title}`);
    console.log(`  created_at: ${entry.created_at}`);
    console.log(`  confidence: ${entry.confidence.toFixed(2)}`);
  }
  console.log("");
}

export function scopeUseCommand(
  taskId: string,
  options: { json?: boolean } = {},
): void {
  const id = taskId.trim();
  if (!id) {
    invalidTaskId(options.json);
    return;
  }

  try {
    const scope = useScope(id, getProjectPaths());

    if (options.json) {
      console.log(JSON.stringify({ scope, restored: true }, null, 2));
      return;
    }

    console.log("");
    console.log(
      `${color.green("[OK]")} Restored ${color.cyan(scope.task.id)} to ${color.cyan(
        ".agentscope/current-scope.yaml",
      )}`,
    );
    console.log(`Task title: ${scope.task.title}`);
    console.log("");
  } catch (err) {
    handleScopeHistoryError(err, options.json);
  }
}

export function scopeHistoryDiffCommand(
  options: { task?: string; json?: boolean } = {},
): void {
  const id = options.task?.trim();
  if (!id) {
    invalidTaskId(options.json);
    return;
  }

  const paths = getProjectPaths();
  if (!existsSync(paths.currentScopeFile)) {
    const message = 'No active scope found. Run `agentscope scope use <task-id>` or `agentscope start "<task>"`.';
    if (options.json) {
      console.log(JSON.stringify({ error: "no_active_scope", message }, null, 2));
    } else {
      console.error(color.red(message));
    }
    process.exitCode = 1;
    return;
  }

  try {
    const current = readScope(paths.currentScopeFile);
    const historical = loadScope(id, paths);
    const diff = diffScopes(current, historical);

    if (options.json) {
      console.log(JSON.stringify({ current, historical, diff }, null, 2));
      return;
    }

    console.log("");
    console.log(color.bold("Scope diff: active -> historical"));
    console.log(color.dim(`(task id: ${historical.task.id})`));
    console.log("");
    printListDiff("Allowed paths", diff.allowed_paths);
    printListDiff("Blocked paths", diff.blocked_paths);
    printListDiff("High-risk paths", diff.high_risk);
    printListDiff("Allowed commands", diff.allowed_commands);
    console.log("");
  } catch (err) {
    handleScopeHistoryError(err, options.json);
  }
}

function printListDiff(label: string, d: ScopeDiff["allowed_paths"]): void {
  console.log(color.cyan(`${label}:`));
  if (d.added.length === 0 && d.removed.length === 0) {
    console.log(color.dim("  (no changes)"));
    return;
  }
  for (const v of d.added) console.log(`  ${color.green(`+ ${v}`)}`);
  for (const v of d.removed) console.log(`  ${color.red(`- ${v}`)}`);
}

function invalidTaskId(json?: boolean): void {
  const message = "A task id is required.";
  if (json) {
    console.log(JSON.stringify({ error: "invalid_task_id", message }, null, 2));
  } else {
    console.error(color.red(message));
  }
  process.exitCode = 1;
}

function handleScopeHistoryError(err: unknown, json?: boolean): void {
  const message = err instanceof Error ? err.message : String(err);
  const error = err instanceof ScopeError ? "scope_error" : "scope_history_error";
  if (json) {
    console.log(JSON.stringify({ error, message }, null, 2));
  } else {
    console.error(color.red(message));
  }
  process.exitCode = 1;
}
