import type { EffectiveAgentScopeConfig } from "../config/effective-config.js";
import type { ScopeContract } from "../schema/scope-contract.js";
import { inferScope, type InferredScope } from "../scope-inference/index.js";

/**
 * Scope creation entry point.
 *
 * As of V2.0 this delegates to the deterministic Scope Inference Engine
 * (`src/core/scope-inference`), which classifies the task into domains and
 * applies narrow, least-privilege rule packs instead of the V0 broad fallback.
 * V2.1: it consumes the normalized effective config (policy defaults, inference
 * threshold, fallback, disabled packs, and rule-pack overrides).
 *
 * The signature is kept stable for existing callers (the `start` command and
 * tests). Use `inferScope` directly when you also need the classification or
 * matched rule packs (e.g. for `--json` / `--dry-run` output).
 */
export interface CreateScopeOptions {
  rawInput: string;
  config: EffectiveAgentScopeConfig;
  /** ISO timestamp, injected so inference stays deterministic and testable. */
  createdAt: string;
  /** Optional explicit task id override (e.g. when re-deriving). */
  taskId?: string;
}

export function createScope(options: CreateScopeOptions): ScopeContract {
  return inferScope(options).scope;
}

/** Like `createScope` but also returns classification + matched rule packs. */
export function createScopeWithInference(
  options: CreateScopeOptions,
): InferredScope {
  return inferScope(options);
}
