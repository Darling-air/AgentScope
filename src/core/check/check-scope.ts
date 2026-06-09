import type { ScopeContract } from "../schema/scope-contract.js";
import { findMatchingPattern } from "../policy/path-matcher.js";

export type FileStatus = "ok" | "warning" | "violation";

export interface FileCheckResult {
  file: string;
  status: FileStatus;
  /** Machine-readable category for the decision. */
  category: "blocked" | "high_risk" | "allowed" | "out_of_scope";
  /** Human-readable explanation, e.g. "blocked path: .github/**". */
  reason: string;
  /** The glob pattern that matched, if any. */
  matchedPattern?: string;
}

export interface ScopeCheckResult {
  task: ScopeContract["task"];
  files: FileCheckResult[];
  summary: {
    ok: number;
    warnings: number;
    violations: number;
  };
  /** Overall pass/fail. Fails only when there is at least one violation. */
  passed: boolean;
}

/**
 * Classifies a single changed file against a scope contract.
 *
 * Precedence (deny wins, see architecture.md §7):
 *   1. blocked_paths   -> violation
 *   2. high_risk       -> warning
 *   3. allowed_paths   -> ok
 *   4. otherwise       -> warning (out of scope)
 */
export function checkFile(
  file: string,
  scope: ScopeContract,
): FileCheckResult {
  const blocked = findMatchingPattern(file, scope.blocked_paths);
  if (blocked) {
    return {
      file,
      status: "violation",
      category: "blocked",
      reason: `blocked path: ${blocked}`,
      matchedPattern: blocked,
    };
  }

  const highRisk = findMatchingPattern(file, scope.high_risk);
  if (highRisk) {
    return {
      file,
      status: "warning",
      category: "high_risk",
      reason: `high risk path: ${highRisk}`,
      matchedPattern: highRisk,
    };
  }

  const allowed = findMatchingPattern(file, scope.allowed_paths);
  if (allowed) {
    return {
      file,
      status: "ok",
      category: "allowed",
      reason: `within allowed paths: ${allowed}`,
      matchedPattern: allowed,
    };
  }

  return {
    file,
    status: "warning",
    category: "out_of_scope",
    reason: "out of scope: not in allowed paths",
  };
}

/**
 * Checks a list of changed files against the scope contract and produces a
 * summarized result. Pure and deterministic — the caller supplies the files.
 */
export function checkScope(
  scope: ScopeContract,
  changedFiles: string[],
): ScopeCheckResult {
  const files = changedFiles.map((file) => checkFile(file, scope));

  const summary = { ok: 0, warnings: 0, violations: 0 };
  for (const f of files) {
    if (f.status === "ok") summary.ok += 1;
    else if (f.status === "warning") summary.warnings += 1;
    else summary.violations += 1;
  }

  return {
    task: scope.task,
    files,
    summary,
    passed: summary.violations === 0,
  };
}
