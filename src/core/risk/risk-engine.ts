import type { EvidencePackageV1 } from "../evidence/evidence-package.js";
import type { EvidenceEvent } from "../evidence/evidence-event.js";
import {
  RISK_SCORE_VERSION,
  levelForScore,
  type RiskFactor,
  type RiskScoreV1,
} from "./risk-score.js";
import { buildRecommendations } from "./risk-recommendations.js";

/**
 * Deterministic Risk Engine (V1.4).
 *
 * `calculateRiskScore` reads a V1.3 Evidence Package and produces an
 * explainable RiskScoreV1. It is a pure function:
 *   - same evidence in -> same score out
 *   - no LLM, no network, no filesystem reads, no clock
 *   - it never mutates the evidence and never affects hook decisions
 *
 * The model is intentionally simple and fully traceable: every non-zero point
 * contribution becomes a RiskFactor explaining where it came from.
 */

const MIN_SCORE = 0;
const MAX_SCORE = 100;

function clamp(value: number): number {
  return Math.max(MIN_SCORE, Math.min(MAX_SCORE, value));
}

function startsWith(rule: string | undefined, prefix: string): boolean {
  return rule !== undefined && rule.startsWith(prefix);
}

/** Common identifying fields copied from an event onto its factor(s). */
function factorContext(event: EvidenceEvent): Partial<RiskFactor> {
  const te = event.tool_event;
  return {
    event_id: event.id,
    tool_name: te.tool_name,
    action: te.action,
    target: te.target,
    matched_rule: event.policy_decision.matched_rule,
  };
}

interface PerEventResult {
  points: number;
  factor?: RiskFactor;
}

/** Scores a single deny event. */
function scoreDeny(event: EvidenceEvent): PerEventResult {
  const rule = event.policy_decision.matched_rule;
  const base = Math.max(event.policy_decision.risk_delta ?? 0, 15);

  if (startsWith(rule, "dangerous_commands:")) {
    const points = Math.max(base, 40);
    return {
      points,
      factor: {
        id: "dangerous_command_denied",
        label: "Dangerous command was denied",
        severity: "critical",
        points,
        ...factorContext(event),
      },
    };
  }

  if (startsWith(rule, "blocked_paths:")) {
    const points = Math.max(base, 20);
    return {
      points,
      factor: {
        id: "blocked_path_denied",
        label: "Blocked path access was denied",
        severity: "high",
        points,
        ...factorContext(event),
      },
    };
  }

  return {
    points: base,
    factor: {
      id: "denied_action",
      label: "An action was denied",
      severity: "medium",
      points: base,
      ...factorContext(event),
    },
  };
}

/** Scores a single ask event. */
function scoreAsk(event: EvidenceEvent): PerEventResult {
  const rule = event.policy_decision.matched_rule;
  const action = event.tool_event.action;
  const base = Math.max(event.policy_decision.risk_delta ?? 0, 8);

  if (startsWith(rule, "high_risk:")) {
    const points = Math.max(base, 25);
    return {
      points,
      factor: {
        id: "high_risk_approval_required",
        label: "High-risk change required approval",
        severity: "high",
        points,
        ...factorContext(event),
      },
    };
  }

  if (
    rule === undefined &&
    (action === "write" || action === "edit")
  ) {
    const points = Math.max(base, 15);
    return {
      points,
      factor: {
        id: "out_of_scope_approval_required",
        label: "Out-of-scope write required approval",
        severity: "medium",
        points,
        ...factorContext(event),
      },
    };
  }

  return {
    points: base,
    factor: {
      id: "approval_required",
      label: "An action required approval",
      severity: "low",
      points: base,
      ...factorContext(event),
    },
  };
}

/** Scores a single warn event. */
function scoreWarn(event: EvidenceEvent): PerEventResult {
  const points = Math.max(event.policy_decision.risk_delta ?? 0, 5);
  return {
    points,
    factor: {
      id: "warned_action",
      label: "An action triggered a warning",
      severity: "low",
      points,
      ...factorContext(event),
    },
  };
}

/** Scores a single allow event (0 unless it carries a positive risk_delta). */
function scoreAllow(event: EvidenceEvent): PerEventResult {
  const delta = event.policy_decision.risk_delta ?? 0;
  if (delta > 0) {
    return {
      points: delta,
      factor: {
        id: "positive_risk_delta_allowed",
        label: "Allowed action carried positive risk",
        severity: "info",
        points: delta,
        ...factorContext(event),
      },
    };
  }
  // Negative or zero risk_delta on an allow contributes nothing; it must never
  // pull the total below 0 (the running sum is clamped at the end).
  return { points: 0 };
}

function scoreEvent(event: EvidenceEvent): PerEventResult {
  switch (event.policy_decision.decision) {
    case "deny":
      return scoreDeny(event);
    case "ask":
      return scoreAsk(event);
    case "warn":
      return scoreWarn(event);
    case "allow":
      return scoreAllow(event);
    default:
      return { points: 0 };
  }
}

interface SessionSignals {
  interventions: number;
  denyCount: number;
  hasBlocked: boolean;
  hasHighRisk: boolean;
  hasDangerous: boolean;
}

/** Adds deterministic session-level factors based on aggregate signals. */
function sessionFactors(signals: SessionSignals): RiskFactor[] {
  const factors: RiskFactor[] = [];

  if (signals.interventions >= 3) {
    factors.push({
      id: "many_policy_interventions",
      label: "Multiple policy interventions occurred",
      severity: "medium",
      points: 10,
    });
  }

  if (signals.denyCount >= 2) {
    factors.push({
      id: "multiple_denied_actions",
      label: "Multiple actions were denied",
      severity: "medium",
      points: 10,
    });
  }

  if (signals.hasBlocked && signals.hasHighRisk) {
    factors.push({
      id: "mixed_blocked_and_high_risk",
      label: "Both blocked-path and high-risk activity occurred",
      severity: "high",
      points: 10,
    });
  }

  if (signals.hasDangerous) {
    factors.push({
      id: "dangerous_command_seen",
      label: "A dangerous command was attempted",
      severity: "critical",
      points: 15,
    });
  }

  return factors;
}

export interface CalculateRiskOptions {
  evidencePath?: string;
}

/**
 * Computes the RiskScoreV1 for an Evidence Package. Pure and deterministic.
 */
export function calculateRiskScore(
  evidence: EvidencePackageV1,
  options: CalculateRiskOptions = {},
): RiskScoreV1 {
  const counts = {
    total_events: evidence.events.length,
    allow: 0,
    deny: 0,
    ask: 0,
    warn: 0,
    policy_interventions: evidence.policy_interventions.length,
  };

  const factors: RiskFactor[] = [];
  let total = 0;

  let hasBlocked = false;
  let hasHighRisk = false;
  let hasDangerous = false;

  for (const event of evidence.events) {
    const decision = event.policy_decision.decision;
    counts[decision] += 1;

    const rule = event.policy_decision.matched_rule;
    if (startsWith(rule, "blocked_paths:")) hasBlocked = true;
    if (startsWith(rule, "high_risk:")) hasHighRisk = true;
    if (startsWith(rule, "dangerous_commands:")) hasDangerous = true;

    const result = scoreEvent(event);
    total += result.points;
    if (result.factor) {
      factors.push(result.factor);
    }
  }

  const session = sessionFactors({
    interventions: counts.policy_interventions,
    denyCount: counts.deny,
    hasBlocked,
    hasHighRisk,
    hasDangerous,
  });
  for (const factor of session) {
    total += factor.points;
    factors.push(factor);
  }

  const score = clamp(total);
  const level = levelForScore(score);
  const recommendations = buildRecommendations(factors);

  return {
    version: RISK_SCORE_VERSION,
    score,
    level,
    summary: buildSummary(score, level, counts),
    task: { id: evidence.task.id, title: evidence.task.title },
    scope_hash: evidence.scope.scope_hash,
    counts,
    factors,
    recommendations,
    evidence: {
      path: options.evidencePath,
      created_at: evidence.created_at,
      updated_at: evidence.updated_at,
    },
  };
}

function buildSummary(
  score: number,
  level: string,
  counts: { total_events: number; policy_interventions: number },
): string {
  return (
    `Risk ${score}/100 (${level}) from ${counts.total_events} event(s), ` +
    `${counts.policy_interventions} policy intervention(s).`
  );
}
