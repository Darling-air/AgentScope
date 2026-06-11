import type { ScopeContract } from "../schema/scope-contract.js";

/**
 * Scope Diff (V2.2).
 *
 * Pure, deterministic comparison of two Task Scope Contracts. Uses exact string
 * comparison only — it does NOT interpret globs. Order is preserved from the
 * input lists (added follows `next` order, removed/unchanged follow `current`
 * order). Inputs are never mutated.
 */
export interface ScopeListDiff {
  added: string[];
  removed: string[];
  unchanged: string[];
}

export interface ScopeDiff {
  allowed_paths: ScopeListDiff;
  blocked_paths: ScopeListDiff;
  high_risk: ScopeListDiff;
  allowed_commands: ScopeListDiff;
}

function diffList(
  current: readonly string[],
  next: readonly string[],
): ScopeListDiff {
  const currentSet = new Set(current);
  const nextSet = new Set(next);

  // added: in next but not current (next order)
  const added = next.filter((v) => !currentSet.has(v));
  // removed: in current but not next (current order)
  const removed = current.filter((v) => !nextSet.has(v));
  // unchanged: in both (current order)
  const unchanged = current.filter((v) => nextSet.has(v));

  return { added, removed, unchanged };
}

export function diffScopes(
  current: ScopeContract,
  next: ScopeContract,
): ScopeDiff {
  return {
    allowed_paths: diffList(current.allowed_paths, next.allowed_paths),
    blocked_paths: diffList(current.blocked_paths, next.blocked_paths),
    high_risk: diffList(current.high_risk, next.high_risk),
    allowed_commands: diffList(current.allowed_commands, next.allowed_commands),
  };
}

/** True when every list diff has no added and no removed entries. */
export function isEmptyScopeDiff(diff: ScopeDiff): boolean {
  const lists: ScopeListDiff[] = [
    diff.allowed_paths,
    diff.blocked_paths,
    diff.high_risk,
    diff.allowed_commands,
  ];
  return lists.every((l) => l.added.length === 0 && l.removed.length === 0);
}
