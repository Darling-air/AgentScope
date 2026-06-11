import type { EffectiveAgentScopeConfig } from "../config/effective-config.js";
import type { RiskFactor, RiskLevel, RiskScoreV1 } from "../risk/risk-score.js";
import {
  GATE_RESULT_VERSION,
  type GatePolicySnapshot,
  type GateReason,
  type GateResultV1,
} from "./gate-result.js";

const LEVEL_RANK: Record<RiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export interface EvaluatePolicyGateInput {
  risk: RiskScoreV1;
  gate: EffectiveAgentScopeConfig["gate"];
}

export function evaluatePolicyGate(
  input: EvaluatePolicyGateInput,
): GateResultV1 {
  const { risk, gate } = input;
  const policy = policySnapshot(gate);

  if (!gate.enabled) {
    return buildResult({
      risk,
      policy,
      status: "skipped",
      passed: true,
      summary: "Policy gate skipped.",
      reasons: [
        {
          id: "gate_disabled",
          label: "Policy gate is disabled in config",
          severity: "info",
          source: "config",
        },
      ],
    });
  }

  const reasons: GateReason[] = [];

  if (risk.score > gate.risk.max_score) {
    reasons.push({
      id: "risk_score_exceeded",
      label: "Risk score exceeded policy threshold",
      severity: "high",
      source: "risk",
      details: { score: risk.score, max_score: gate.risk.max_score },
    });
  }

  if (LEVEL_RANK[risk.level] > LEVEL_RANK[gate.risk.max_level]) {
    reasons.push({
      id: "risk_level_exceeded",
      label: "Risk level exceeded policy threshold",
      severity: risk.level,
      source: "risk",
      details: { level: risk.level, max_level: gate.risk.max_level },
    });
  }

  if (risk.counts.deny > gate.decisions.max_denies) {
    reasons.push({
      id: "deny_count_exceeded",
      label: "Deny count exceeded policy threshold",
      severity: "high",
      source: "decision",
      details: { deny: risk.counts.deny, max_denies: gate.decisions.max_denies },
    });
  }

  if (risk.counts.ask > gate.decisions.max_asks) {
    reasons.push({
      id: "ask_count_exceeded",
      label: "Ask count exceeded policy threshold",
      severity: "medium",
      source: "decision",
      details: { ask: risk.counts.ask, max_asks: gate.decisions.max_asks },
    });
  }

  if (!gate.decisions.allow_warnings && risk.counts.warn > 0) {
    reasons.push({
      id: "warnings_not_allowed",
      label: "Warnings are not allowed by policy",
      severity: "medium",
      source: "decision",
      details: { warn: risk.counts.warn },
    });
  }

  if (
    gate.rules.fail_on_blocked_path &&
    hasFactor(risk.factors, "blocked_path_denied")
  ) {
    reasons.push({
      id: "blocked_path_denied",
      label: "Blocked path access was denied",
      severity: "high",
      source: "rule",
      details: factorDetails(risk.factors, "blocked_path_denied"),
    });
  }

  if (
    gate.rules.fail_on_dangerous_command &&
    (hasFactor(risk.factors, "dangerous_command_denied") ||
      hasFactor(risk.factors, "dangerous_command_seen"))
  ) {
    reasons.push({
      id: "dangerous_command_detected",
      label: "Dangerous command activity was detected",
      severity: "critical",
      source: "rule",
      details: {
        factors: risk.factors
          .filter(
            (f) =>
              f.id === "dangerous_command_denied" ||
              f.id === "dangerous_command_seen",
          )
          .map((f) => f.id),
      },
    });
  }

  if (
    gate.rules.fail_on_high_risk_without_review &&
    hasFactor(risk.factors, "high_risk_approval_required")
  ) {
    reasons.push({
      id: "high_risk_requires_review",
      label: "High-risk change required review",
      severity: "high",
      source: "rule",
      details: factorDetails(risk.factors, "high_risk_approval_required"),
    });
  }

  const failed = reasons.length > 0;
  return buildResult({
    risk,
    policy,
    status: failed ? "fail" : "pass",
    passed: !failed,
    summary: failed ? "Policy gate failed." : "Policy gate passed.",
    reasons,
  });
}

function policySnapshot(
  gate: EffectiveAgentScopeConfig["gate"],
): GatePolicySnapshot {
  return {
    enabled: gate.enabled,
    max_score: gate.risk.max_score,
    max_level: gate.risk.max_level,
    max_denies: gate.decisions.max_denies,
    max_asks: gate.decisions.max_asks,
    allow_warnings: gate.decisions.allow_warnings,
    fail_on_blocked_path: gate.rules.fail_on_blocked_path,
    fail_on_dangerous_command: gate.rules.fail_on_dangerous_command,
    fail_on_high_risk_without_review:
      gate.rules.fail_on_high_risk_without_review,
  };
}

function hasFactor(factors: readonly RiskFactor[], id: string): boolean {
  return factors.some((f) => f.id === id);
}

function factorDetails(
  factors: readonly RiskFactor[],
  id: string,
): Record<string, unknown> {
  return {
    factors: factors
      .filter((f) => f.id === id)
      .map((f) => ({
        id: f.id,
        event_id: f.event_id,
        target: f.target,
        matched_rule: f.matched_rule,
      })),
  };
}

function buildResult(input: {
  risk: RiskScoreV1;
  policy: GatePolicySnapshot;
  status: GateResultV1["status"];
  passed: boolean;
  summary: string;
  reasons: GateReason[];
}): GateResultV1 {
  return {
    version: GATE_RESULT_VERSION,
    status: input.status,
    passed: input.passed,
    summary: input.summary,
    task: { ...input.risk.task },
    scope_hash: input.risk.scope_hash,
    risk: input.risk,
    policy: input.policy,
    reasons: input.reasons,
    evidence: { ...input.risk.evidence },
  };
}
