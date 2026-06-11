import type { ScopeContract } from "../schema/scope-contract.js";

/**
 * Scope Override Patch (V2.2).
 *
 * A user-supplied, per-scope adjustment applied AFTER inference. It tweaks a
 * single Task Scope Contract for one session; it never touches
 * `.agentscope/config.yaml` (that is the project-wide layer that affects future
 * inference). Every applied add/remove is recorded in the scope's rationale so
 * the override is always visible.
 *
 * Shape mirrors the config add/remove style: `add` appends (de-duplicated,
 * order-preserving), `remove` strips exact string matches only.
 */
export interface ScopeListPatch {
  add?: string[];
  remove?: string[];
}

export interface ScopeOverridePatch {
  allowed_paths?: ScopeListPatch;
  blocked_paths?: ScopeListPatch;
  high_risk?: ScopeListPatch;
  allowed_commands?: ScopeListPatch;
}

/** True when a patch has no add/remove entries on any list. */
export function isEmptyOverridePatch(patch: ScopeOverridePatch): boolean {
  const lists: (ScopeListPatch | undefined)[] = [
    patch.allowed_paths,
    patch.blocked_paths,
    patch.high_risk,
    patch.allowed_commands,
  ];
  return lists.every(
    (l) => !l || ((l.add?.length ?? 0) === 0 && (l.remove?.length ?? 0) === 0),
  );
}

/** Applies one list patch: append `add`, remove exact-match `remove`, de-dup. */
function applyListPatch(
  base: readonly string[],
  patch: ScopeListPatch | undefined,
): string[] {
  const add = patch?.add ?? [];
  const remove = patch?.remove ?? [];
  const removeSet = new Set(remove);
  const merged = [...base, ...add].filter((v) => !removeSet.has(v));
  return [...new Set(merged)];
}

/** Rationale lines for a single list's add/remove, in a stable order. */
function rationaleFor(
  base: readonly string[],
  patch: ScopeListPatch | undefined,
  label: string,
): string[] {
  if (!patch) return [];
  const lines: string[] = [];
  const baseSet = new Set(base);

  for (const value of patch.add ?? []) {
    lines.push(`Override: added ${label} ${value}.`);
  }
  for (const value of patch.remove ?? []) {
    // Only report removals that actually matched, so rationale reflects reality.
    if (baseSet.has(value)) {
      lines.push(`Override: removed ${label} ${value}.`);
    }
  }
  return lines;
}

/**
 * Applies a ScopeOverridePatch to a scope, returning a NEW ScopeContract.
 *
 * - never mutates the input scope
 * - leaves task id / title / raw_input / created_at / version / confidence intact
 * - appends a rationale line for every add and every effective remove
 * - an empty patch returns an equivalent scope with no new rationale
 */
export function applyScopeOverride(
  scope: ScopeContract,
  patch: ScopeOverridePatch,
): ScopeContract {
  if (isEmptyOverridePatch(patch)) {
    // Return a structurally-equivalent copy (still no mutation of input).
    return {
      ...scope,
      allowed_paths: [...scope.allowed_paths],
      blocked_paths: [...scope.blocked_paths],
      high_risk: [...scope.high_risk],
      allowed_commands: [...scope.allowed_commands],
      rationale: [...scope.rationale],
    };
  }

  const overrideRationale = [
    ...rationaleFor(scope.allowed_paths, patch.allowed_paths, "allowed path"),
    ...rationaleFor(scope.blocked_paths, patch.blocked_paths, "blocked path"),
    ...rationaleFor(scope.high_risk, patch.high_risk, "high-risk path"),
    ...rationaleFor(
      scope.allowed_commands,
      patch.allowed_commands,
      "allowed command",
    ),
  ];

  return {
    ...scope,
    allowed_paths: applyListPatch(scope.allowed_paths, patch.allowed_paths),
    blocked_paths: applyListPatch(scope.blocked_paths, patch.blocked_paths),
    high_risk: applyListPatch(scope.high_risk, patch.high_risk),
    allowed_commands: applyListPatch(
      scope.allowed_commands,
      patch.allowed_commands,
    ),
    rationale: [...scope.rationale, ...overrideRationale],
  };
}
