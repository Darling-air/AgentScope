import type { PolicyDecisionKind } from "../policy/policy-decision.js";
import type { EvidencePackageV1 } from "./evidence-package.js";

/**
 * Evidence summary (V1.3).
 *
 * Pure, presentation-agnostic counts derived from an EvidencePackage. The CLI
 * commands (`evidence show`, `report`) render this; keeping the arithmetic here
 * makes it testable without touching stdout.
 *
 * This is NOT a risk score. V1.3 deliberately does not compute risk — that is
 * V1.4 (`agentscope risk`).
 */
export interface EvidenceSummary {
  taskId: string;
  taskTitle: string;
  scopeHash: string;
  total: number;
  allow: number;
  deny: number;
  ask: number;
  warn: number;
  /** Non-allow events (deny / ask / warn). */
  interventions: number;
  /** Count of events whose decision matched a high_risk rule. */
  highRisk: number;
}

function isHighRisk(matchedRule: string | undefined): boolean {
  return matchedRule !== undefined && matchedRule.startsWith("high_risk");
}

export function summarizeEvidence(pkg: EvidencePackageV1): EvidenceSummary {
  const counts: Record<PolicyDecisionKind, number> = {
    allow: 0,
    deny: 0,
    ask: 0,
    warn: 0,
  };
  let highRisk = 0;

  for (const event of pkg.events) {
    counts[event.policy_decision.decision] += 1;
    if (isHighRisk(event.policy_decision.matched_rule)) {
      highRisk += 1;
    }
  }

  return {
    taskId: pkg.task.id,
    taskTitle: pkg.task.title,
    scopeHash: pkg.scope.scope_hash,
    total: pkg.events.length,
    allow: counts.allow,
    deny: counts.deny,
    ask: counts.ask,
    warn: counts.warn,
    interventions: pkg.policy_interventions.length,
    highRisk,
  };
}
