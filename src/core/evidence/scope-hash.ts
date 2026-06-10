import { createHash } from "node:crypto";
import type { ScopeContract } from "../schema/scope-contract.js";
import type { EvidenceScopeSnapshot } from "./evidence-package.js";

/**
 * Stable scope hashing (V1.3).
 *
 * The scope hash pins an EvidencePackage to the exact scope that governed it.
 * It is computed over a canonical snapshot of the scope's stable, governance-
 * relevant fields:
 *
 *   - task id
 *   - task title
 *   - allowed_paths
 *   - blocked_paths
 *   - allowed_commands
 *   - high_risk
 *
 * Determinism rules:
 *   - The same scope content always produces the same hash.
 *   - Object key order does NOT affect the hash (we serialize with sorted keys).
 *   - Array order IS preserved — scope ordering can be meaningful, so reordering
 *     paths is treated as a different scope.
 *
 * Excluded on purpose: `confidence`, `rationale`, `created_at`, and `version`.
 * Those can change without changing what the session is actually allowed to do.
 */

export interface ScopeHashInput {
  task: { id: string; title: string };
  allowed_paths: string[];
  blocked_paths: string[];
  allowed_commands: string[];
  high_risk: string[];
}

/**
 * Deterministic JSON: object keys are emitted in sorted order at every level so
 * key ordering never affects the digest. Arrays keep their order.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      out[key] = canonicalize(obj[key]);
    }
    return out;
  }
  return value;
}

/** Computes the canonical `sha256:<hex>` hash for a scope hash input. */
export function computeScopeHash(input: ScopeHashInput): string {
  const canonical = canonicalize({
    task: { id: input.task.id, title: input.task.title },
    allowed_paths: input.allowed_paths,
    blocked_paths: input.blocked_paths,
    allowed_commands: input.allowed_commands,
    high_risk: input.high_risk,
  });
  const hex = createHash("sha256")
    .update(JSON.stringify(canonical))
    .digest("hex");
  return `sha256:${hex}`;
}

/**
 * Builds the EvidencePackage scope snapshot (including its hash) from a full
 * ScopeContract.
 */
export function buildScopeSnapshot(scope: ScopeContract): EvidenceScopeSnapshot {
  const scope_hash = computeScopeHash({
    task: { id: scope.task.id, title: scope.task.title },
    allowed_paths: scope.allowed_paths,
    blocked_paths: scope.blocked_paths,
    allowed_commands: scope.allowed_commands,
    high_risk: scope.high_risk,
  });

  return {
    scope_hash,
    allowed_paths: scope.allowed_paths,
    blocked_paths: scope.blocked_paths,
    allowed_commands: scope.allowed_commands,
    high_risk: scope.high_risk,
  };
}
