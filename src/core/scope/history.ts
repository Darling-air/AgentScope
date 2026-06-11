import { existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { getProjectPaths, scopeFileForTask, type ProjectPaths } from "../fs/project-paths.js";
import type { ScopeContract } from "../schema/scope-contract.js";
import { readScope, writeScope, ScopeError } from "./scope-io.js";

export interface ScopeHistoryEntry {
  task_id: string;
  title: string;
  created_at: string;
  confidence: number;
  file: string;
}

function resolvePaths(paths?: ProjectPaths): ProjectPaths {
  return paths ?? getProjectPaths();
}

function ensureScopesDir(paths: ProjectPaths): void {
  mkdirSync(paths.scopesDir, { recursive: true });
}

/** Saves a task scope to both the active scope file and the local history file. */
export function saveScope(
  scope: ScopeContract,
  paths: ProjectPaths = getProjectPaths(),
): ScopeHistoryEntry {
  const resolved = resolvePaths(paths);
  ensureScopesDir(resolved);
  writeScope(resolved.currentScopeFile, scope);
  const historyFile = scopeFileForTask(resolved, scope.task.id);
  writeScope(historyFile, scope);
  return entryFor(scope, historyFile);
}

/** Loads a historical scope by task id without mutating current-scope.yaml. */
export function loadScope(
  taskId: string,
  paths: ProjectPaths = getProjectPaths(),
): ScopeContract {
  const id = taskId.trim();
  if (!id) {
    throw new ScopeError("Task id is required.");
  }
  return readScope(scopeFileForTask(resolvePaths(paths), id));
}

/** Alias for loadScope, kept for the V2.3 public API shape. */
export function getScope(
  taskId: string,
  paths: ProjectPaths = getProjectPaths(),
): ScopeContract {
  return loadScope(taskId, paths);
}

/** Lists saved task scopes in deterministic task-id order. */
export function listScopes(
  paths: ProjectPaths = getProjectPaths(),
): ScopeHistoryEntry[] {
  const resolved = resolvePaths(paths);
  if (!existsSync(resolved.scopesDir)) return [];

  return readdirSync(resolved.scopesDir)
    .filter((name) => name.endsWith(".yaml") || name.endsWith(".yml"))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => {
      const file = path.join(resolved.scopesDir, name);
      const scope = readScope(file);
      return entryFor(scope, file);
    });
}

/** Restores a historical scope into current-scope.yaml and returns it. */
export function useScope(
  taskId: string,
  paths: ProjectPaths = getProjectPaths(),
): ScopeContract {
  const resolved = resolvePaths(paths);
  const scope = loadScope(taskId, resolved);
  writeScope(resolved.currentScopeFile, scope);
  return scope;
}

function entryFor(scope: ScopeContract, file: string): ScopeHistoryEntry {
  return {
    task_id: scope.task.id,
    title: scope.task.title,
    created_at: scope.created_at,
    confidence: scope.confidence,
    file,
  };
}
