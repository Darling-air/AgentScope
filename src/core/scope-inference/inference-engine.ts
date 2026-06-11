import {
  SCOPE_CONTRACT_VERSION,
  type ScopeContract,
} from "../schema/scope-contract.js";
import type { EffectiveAgentScopeConfig } from "../config/effective-config.js";
import { applyAddRemove } from "../config/effective-config.js";
import type { RulePackOverride } from "../schema/config.js";
import { taskTitleToId } from "../scope/task-id.js";
import {
  classifyTask,
  type TaskClassification,
} from "./task-classifier.js";
import { GENERAL_PACK, rulePackById } from "./rule-packs.js";
import type { ScopeRulePack } from "./rule-pack.js";

/**
 * Scope Inference Engine (V2.0, config-aware in V2.1).
 *
 * Deterministic, local-only. Turns a natural-language task into a narrow,
 * least-privilege ScopeContract by:
 *   1. classifying the task into domains,
 *   2. selecting matching rule packs (or the general fallback),
 *   3. applying project rule-pack overrides + disabled packs,
 *   4. merging pack paths/commands with the effective config's policy defaults,
 *   5. de-duplicating while preserving order,
 *   6. recording a rationale for every decision.
 *
 * V2.1: confidence threshold, fallback behavior, default policy lists, disabled
 * rule packs, and per-pack overrides all come from the EffectiveAgentScopeConfig.
 */

/**
 * Default confidence threshold (used when no config overrides it). At or above
 * this value the broad general fallback is suppressed for a clearly-classified
 * task.
 */
export const FALLBACK_CONFIDENCE_THRESHOLD = 0.65;

export interface InferScopeOptions {
  rawInput: string;
  config: EffectiveAgentScopeConfig;
  /** ISO timestamp, injected so inference stays deterministic and testable. */
  createdAt: string;
  /** Optional explicit task id override. */
  taskId?: string;
}

export interface InferredScope {
  scope: ScopeContract;
  classification: TaskClassification;
  /** Rule pack ids that contributed to the scope, in application order. */
  matchedRulePacks: string[];
  /** True when the broad general fallback pack was applied. */
  usedFallback: boolean;
}

function uniqueInOrder(values: string[]): string[] {
  return [...new Set(values)];
}

/**
 * Applies a project override to a rule pack, returning a new pack with its
 * allowed_paths / allowed_commands / high_risk patched. Pure; never mutates the
 * built-in pack.
 */
function applyOverride(
  pack: ScopeRulePack,
  override: RulePackOverride | undefined,
): ScopeRulePack {
  if (!override) return pack;
  return {
    ...pack,
    allowed_paths: applyAddRemove(pack.allowed_paths, override.allowed_paths),
    allowed_commands: applyAddRemove(
      pack.allowed_commands ?? [],
      override.allowed_commands,
    ),
    high_risk: applyAddRemove(pack.high_risk ?? [], override.high_risk),
  };
}

/** Decides which rule packs apply, honoring disabled packs and fallback config. */
function selectRulePacks(
  classification: TaskClassification,
  config: EffectiveAgentScopeConfig,
): { packs: ScopeRulePack[]; usedFallback: boolean } {
  const disabled = new Set(config.inference.rule_packs.disabled);
  const threshold = config.inference.confidence_threshold;
  const fallbackEnabled = config.inference.fallback.enabled;

  const domainPacks = classification.domains
    .filter((id) => !disabled.has(id))
    .map((id) => rulePackById(id))
    .filter((p): p is ScopeRulePack => p !== undefined);

  const confident = classification.confidence >= threshold;
  const hasDomain = domainPacks.length > 0;

  if (hasDomain && confident) {
    return { packs: domainPacks, usedFallback: false };
  }

  // Low confidence / no clear domain. Add the broad fallback only if enabled
  // (and not disabled by id). Otherwise keep whatever narrow domain packs exist.
  const fallbackAllowed = fallbackEnabled && !disabled.has(GENERAL_PACK.id);
  if (fallbackAllowed) {
    return { packs: [...domainPacks, GENERAL_PACK], usedFallback: true };
  }
  return { packs: domainPacks, usedFallback: false };
}

export function inferScope(options: InferScopeOptions): InferredScope {
  const { rawInput, config, createdAt } = options;
  const title = rawInput.trim();
  const taskId = options.taskId ?? taskTitleToId(title);

  const classification = classifyTask(title);
  const { packs: selectedPacks, usedFallback } = selectRulePacks(
    classification,
    config,
  );

  const overrides = config.inference.rule_packs.overrides;

  // For the general fallback pack, swap its allowed_paths for the configured
  // fallback paths so projects can customize what "broad" means.
  const packs = selectedPacks.map((pack) => {
    let effective = applyOverride(pack, overrides[pack.id]);
    if (pack.id === GENERAL_PACK.id) {
      effective = {
        ...effective,
        allowed_paths: config.inference.fallback.allowed_paths,
      };
    }
    return effective;
  });

  // 1. Assemble allowed paths and commands from packs.
  const allowedPaths: string[] = [];
  const allowedCommands: string[] = [];
  const packHighRisk: string[] = [];
  const unblock = new Set<string>();
  const rationale: string[] = [];

  rationale.push(...classification.rationale);

  for (const pack of packs) {
    allowedPaths.push(...pack.allowed_paths);
    if (pack.allowed_commands) allowedCommands.push(...pack.allowed_commands);
    if (pack.high_risk) packHighRisk.push(...pack.high_risk);
    if (pack.unblock_paths) pack.unblock_paths.forEach((p) => unblock.add(p));
    rationale.push(...pack.rationale.map((r) => `[${pack.id}] ${r}`));
  }

  // 2. Blocked paths: effective policy defaults minus anything a pack unblocks.
  const blockedPaths = config.policy.blocked_paths.filter(
    (p) => !unblock.has(p),
  );

  // 3. High risk: effective policy defaults + pack-specific + unblocked paths.
  const highRisk = [...config.policy.high_risk, ...packHighRisk, ...unblock];

  // 4. Commands: pack commands, falling back to effective policy defaults.
  const commands =
    allowedCommands.length > 0
      ? allowedCommands
      : [...config.policy.allowed_commands];

  // 5. Explain the safe defaults so the contract is fully self-describing.
  rationale.push(
    `Blocked paths kept from project config: ${blockedPaths.join(", ") || "(none)"}.`,
  );
  rationale.push(
    `High-risk paths require confirmation: ${uniqueInOrder(highRisk).join(", ") || "(none)"}.`,
  );
  rationale.push("V2.0 deterministic inference only (no LLM, no network).");

  const scope: ScopeContract = {
    version: SCOPE_CONTRACT_VERSION,
    task: {
      id: taskId,
      title,
      raw_input: rawInput,
    },
    confidence: classification.confidence,
    allowed_paths: uniqueInOrder(allowedPaths),
    blocked_paths: uniqueInOrder(blockedPaths),
    allowed_commands: uniqueInOrder(commands),
    high_risk: uniqueInOrder(highRisk),
    rationale,
    created_at: createdAt,
  };

  return {
    scope,
    classification,
    matchedRulePacks: packs.map((p) => p.id),
    usedFallback,
  };
}
