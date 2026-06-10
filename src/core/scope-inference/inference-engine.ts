import type { AgentScopeConfig } from "../schema/config.js";
import {
  SCOPE_CONTRACT_VERSION,
  type ScopeContract,
} from "../schema/scope-contract.js";
import { taskTitleToId } from "../scope/task-id.js";
import {
  classifyTask,
  type TaskClassification,
} from "./task-classifier.js";
import {
  GENERAL_PACK,
  rulePackById,
} from "./rule-packs.js";
import type { ScopeRulePack } from "./rule-pack.js";

/**
 * Scope Inference Engine (V2.0).
 *
 * Deterministic, local-only. Turns a natural-language task into a narrow,
 * least-privilege ScopeContract by:
 *   1. classifying the task into domains,
 *   2. selecting matching rule packs (or the general fallback),
 *   3. merging pack paths/commands with the config's safe defaults,
 *   4. de-duplicating while preserving order,
 *   5. recording a rationale for every decision.
 *
 * The key change from V0: a confidently-classified task (e.g. auth/login) gets
 * only its domain's narrow paths and does NOT receive the broad `src/**`
 * fallback. The broad fallback is reserved for low-confidence / unknown tasks.
 */

/** Confidence at or above which the broad general fallback is suppressed. */
export const FALLBACK_CONFIDENCE_THRESHOLD = 0.65;

export interface InferScopeOptions {
  rawInput: string;
  config: AgentScopeConfig;
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

/** Decides which rule packs apply, and whether the broad fallback was used. */
function selectRulePacks(classification: TaskClassification): {
  packs: ScopeRulePack[];
  usedFallback: boolean;
} {
  const hasDomain = classification.domains.length > 0;
  const confident = classification.confidence >= FALLBACK_CONFIDENCE_THRESHOLD;

  if (hasDomain && confident) {
    const packs = classification.domains
      .map((id) => rulePackById(id))
      .filter((p): p is ScopeRulePack => p !== undefined);
    return { packs, usedFallback: false };
  }

  // Low confidence or no clear domain: conservative broad fallback. Include any
  // matched domain packs too, so a weak signal still narrows where it can.
  const domainPacks = classification.domains
    .map((id) => rulePackById(id))
    .filter((p): p is ScopeRulePack => p !== undefined);
  return { packs: [...domainPacks, GENERAL_PACK], usedFallback: true };
}

export function inferScope(options: InferScopeOptions): InferredScope {
  const { rawInput, config, createdAt } = options;
  const title = rawInput.trim();
  const taskId = options.taskId ?? taskTitleToId(title);

  const classification = classifyTask(title);
  const { packs, usedFallback } = selectRulePacks(classification);

  const { defaults } = config;

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

  // 2. Blocked paths: config defaults minus anything a pack explicitly unblocks.
  const blockedPaths = defaults.blocked_paths.filter((p) => !unblock.has(p));

  // 3. High risk: config defaults + pack-specific + any unblocked paths.
  const highRisk = [
    ...defaults.high_risk,
    ...packHighRisk,
    ...unblock,
  ];

  // 4. Commands: pack commands, falling back to config defaults if none.
  const commands =
    allowedCommands.length > 0 ? allowedCommands : [...defaults.allowed_commands];

  // 5. Explain the safe defaults so the contract is fully self-describing.
  rationale.push(
    `Blocked paths kept from project defaults: ${blockedPaths.join(", ") || "(none)"}.`,
  );
  rationale.push(
    `High-risk paths require confirmation: ${uniqueInOrder(highRisk).join(", ") || "(none)"}.`,
  );
  rationale.push(
    "V2.0 deterministic inference only (no LLM, no network).",
  );

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
