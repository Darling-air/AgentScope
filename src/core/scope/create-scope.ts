import type { AgentScopeConfig } from "../schema/config.js";
import {
  SCOPE_CONTRACT_VERSION,
  type ScopeContract,
} from "../schema/scope-contract.js";
import { taskTitleToId } from "./task-id.js";

/**
 * V0 Scope Inference Engine.
 *
 * Deterministic, local-only. No LLM, no network, no git history. It maps task
 * keywords to a small set of likely paths and otherwise falls back to the
 * project config defaults. Every inference records a rationale line so the
 * resulting contract is explainable.
 *
 * Keyword groups (CLAUDE.md V0 spec):
 *  - auth:      login / redirect / session / auth  -> src/auth/**, tests/auth/**
 *  - component: component / ui / button / navbar    -> src/components/**, tests/components/**
 *  - ci:        ci / workflow / github / action      -> .github/** becomes high_risk (not blocked)
 *  - migration: migration / database / schema        -> migrations/** becomes allowed (not blocked)
 */

interface PathSignal {
  group: string;
  keywords: string[];
  allowed: string[];
  rationale: string;
}

const PATH_SIGNALS: PathSignal[] = [
  {
    group: "auth",
    keywords: ["auth", "login", "redirect", "session"],
    allowed: ["src/auth/**", "tests/auth/**"],
    rationale: "Task references authentication keywords; added auth source and test paths.",
  },
  {
    group: "component",
    keywords: ["component", "components", "ui", "button", "navbar"],
    allowed: ["src/components/**", "tests/components/**"],
    rationale: "Task references UI/component keywords; added component source and test paths.",
  },
];

const CI_KEYWORDS = ["ci", "workflow", "workflows", "github", "action", "actions"];
const MIGRATION_KEYWORDS = ["migration", "migrations", "database", "schema"];

function tokenize(input: string): Set<string> {
  return new Set(
    input
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  );
}

function hasAny(tokens: Set<string>, keywords: string[]): boolean {
  return keywords.some((kw) => tokens.has(kw));
}

function countMatches(tokens: Set<string>, keywords: string[]): number {
  return keywords.filter((kw) => tokens.has(kw)).length;
}

function uniqueInOrder(values: string[]): string[] {
  return [...new Set(values)];
}

export interface CreateScopeOptions {
  rawInput: string;
  config: AgentScopeConfig;
  /** ISO timestamp, injected so inference stays deterministic and testable. */
  createdAt: string;
  /** Optional explicit task id override (e.g. when re-deriving). */
  taskId?: string;
}

export function createScope(options: CreateScopeOptions): ScopeContract {
  const { rawInput, config, createdAt } = options;
  const title = rawInput.trim();
  const taskId = options.taskId ?? taskTitleToId(title);
  const tokens = tokenize(title);

  const { defaults } = config;

  const allowedPaths: string[] = [];
  const rationale: string[] = [];
  let keywordSignals = 0;

  // Keyword-driven allowed paths. `keywordSignals` counts individual keyword
  // hits (not groups) so multi-keyword tasks get higher confidence.
  for (const signal of PATH_SIGNALS) {
    const hits = countMatches(tokens, signal.keywords);
    if (hits > 0) {
      allowedPaths.push(...signal.allowed);
      rationale.push(signal.rationale);
      keywordSignals += hits;
    }
  }

  // Start blocked/high-risk from config defaults, then relax based on intent.
  let blockedPaths = [...defaults.blocked_paths];
  const highRisk = [...defaults.high_risk];

  // CI intent: do not block .github/**, treat it as high risk instead.
  if (hasAny(tokens, CI_KEYWORDS)) {
    keywordSignals += 1;
    const ciPattern = ".github/**";
    blockedPaths = blockedPaths.filter((p) => p !== ciPattern);
    allowedPaths.push(ciPattern);
    if (!highRisk.includes(ciPattern)) highRisk.push(ciPattern);
    rationale.push(
      "Task targets CI/workflow changes; .github/** moved out of blocked into allowed + high risk.",
    );
  }

  // Migration intent: do not block migrations/**, allow it as high risk.
  if (hasAny(tokens, MIGRATION_KEYWORDS)) {
    keywordSignals += 1;
    const migPattern = "migrations/**";
    blockedPaths = blockedPaths.filter((p) => p !== migPattern);
    allowedPaths.push(migPattern);
    if (!highRisk.includes(migPattern)) highRisk.push(migPattern);
    rationale.push(
      "Task targets database/migration changes; migrations/** moved out of blocked into allowed + high risk.",
    );
  }

  // Fallback: no keyword signal at all -> use default allowed paths.
  if (allowedPaths.length === 0) {
    allowedPaths.push(...defaults.allowed_paths);
    rationale.push(
      "No specific task keywords matched; fell back to default allowed paths.",
    );
  } else {
    // Always include defaults too so unrelated source/test edits stay in scope,
    // but keep keyword paths first for readability.
    allowedPaths.push(...defaults.allowed_paths);
  }

  rationale.push("V0 uses local deterministic inference only (no LLM, no network).");

  // Confidence: 0.80 with multiple signals, 0.72 with one, 0.55 default-only.
  let confidence: number;
  if (keywordSignals >= 2) confidence = 0.8;
  else if (keywordSignals === 1) confidence = 0.72;
  else confidence = 0.55;

  return {
    version: SCOPE_CONTRACT_VERSION,
    task: {
      id: taskId,
      title,
      raw_input: rawInput,
    },
    confidence,
    allowed_paths: uniqueInOrder(allowedPaths),
    blocked_paths: uniqueInOrder(blockedPaths),
    allowed_commands: [...defaults.allowed_commands],
    high_risk: uniqueInOrder(highRisk),
    rationale,
    created_at: createdAt,
  };
}
