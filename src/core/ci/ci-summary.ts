import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { EvidenceEvent, EvidencePackageV1 } from "../evidence/index.js";
import type { RiskFactor, RiskScoreV1 } from "../risk/index.js";

export const DEFAULT_CI_SUMMARY_PATH = ".agentscope/ci/summary.md";
const TOP_FACTORS_LIMIT = 8;

export interface CiSummaryAction {
  event_id: string;
  tool_name: string;
  action?: string;
  target: string;
  matched_rule?: string;
  reason: string;
}

export interface CiSummaryJson {
  summary_path: string;
  task: {
    id: string;
    title: string;
  };
  scope_hash: string;
  score: number;
  level: RiskScoreV1["level"];
  counts: RiskScoreV1["counts"];
  denied_actions: CiSummaryAction[];
  asked_actions: CiSummaryAction[];
  high_risk_actions: CiSummaryAction[];
  top_factors: RiskFactor[];
  recommendations: string[];
  evidence_path?: string;
}

export interface BuildCiSummaryInput {
  evidence: EvidencePackageV1;
  risk: RiskScoreV1;
  summaryPath?: string;
}

export interface CiSummaryResult {
  json: CiSummaryJson;
  markdown: string;
}

export function buildCiSummary(input: BuildCiSummaryInput): CiSummaryResult {
  const summaryPath = normalizePath(
    input.summaryPath ?? DEFAULT_CI_SUMMARY_PATH,
  );
  const denied = input.evidence.events
    .filter((event) => event.policy_decision.decision === "deny")
    .map(actionFromEvent);
  const asked = input.evidence.events
    .filter((event) => event.policy_decision.decision === "ask")
    .map(actionFromEvent);
  const highRisk = input.evidence.events
    .filter((event) => isHighRiskEvent(event))
    .map(actionFromEvent);
  const topFactors = topRiskFactors(input.risk.factors);

  const json: CiSummaryJson = {
    summary_path: summaryPath,
    task: { ...input.risk.task },
    scope_hash: input.risk.scope_hash,
    score: input.risk.score,
    level: input.risk.level,
    counts: { ...input.risk.counts },
    denied_actions: denied,
    asked_actions: asked,
    high_risk_actions: highRisk,
    top_factors: topFactors,
    recommendations: [...input.risk.recommendations],
    evidence_path: input.risk.evidence.path,
  };

  return {
    json,
    markdown: renderCiSummaryMarkdown(json),
  };
}

export function writeCiSummaryFile(filePath: string, markdown: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, markdown, "utf8");
}

export function renderCiSummaryMarkdown(summary: CiSummaryJson): string {
  const lines = [
    "# AgentScope CI Summary",
    "",
    `Task: ${summary.task.title} (${summary.task.id})`,
    `Scope Hash: ${summary.scope_hash}`,
    "",
    `Risk Score: ${summary.score} / 100`,
    `Risk Level: ${summary.level}`,
    "",
    "Denied Actions:",
    ...renderActionList(summary.denied_actions),
    "",
    "Asked Actions:",
    ...renderActionList(summary.asked_actions),
    "",
    "High-Risk Actions:",
    ...renderActionList(summary.high_risk_actions),
    "",
    "Top Risk Factors:",
    ...renderFactorList(summary.top_factors),
    "",
    "Recommendations:",
    ...renderRecommendationList(summary.recommendations),
    "",
  ];

  if (summary.evidence_path) {
    lines.splice(lines.length - 1, 0, `Evidence Path: ${normalizePath(summary.evidence_path)}`);
  }

  return `${lines.join("\n")}\n`;
}

function renderActionList(actions: CiSummaryAction[]): string[] {
  if (actions.length === 0) return ["- (none)"];
  return actions.map((action) => {
    const rule = action.matched_rule ? ` [${action.matched_rule}]` : "";
    return `- ${action.tool_name} ${action.target}${rule}`;
  });
}

function renderFactorList(factors: RiskFactor[]): string[] {
  if (factors.length === 0) return ["- (none)"];
  return factors.map((factor) => `- ${factor.id} (+${factor.points})`);
}

function renderRecommendationList(recommendations: string[]): string[] {
  if (recommendations.length === 0) return ["- (none)"];
  return recommendations.map((recommendation) => `- ${recommendation}`);
}

function topRiskFactors(factors: RiskFactor[]): RiskFactor[] {
  return [...factors]
    .sort((a, b) => b.points - a.points)
    .slice(0, TOP_FACTORS_LIMIT)
    .map((factor) => ({ ...factor }));
}

function isHighRiskEvent(event: EvidenceEvent): boolean {
  return event.policy_decision.matched_rule?.startsWith("high_risk:") ?? false;
}

function actionFromEvent(event: EvidenceEvent): CiSummaryAction {
  const action: CiSummaryAction = {
    event_id: event.id,
    tool_name: event.tool_event.tool_name ?? event.tool_event.event_type,
    target:
      event.tool_event.target ??
      event.tool_event.command ??
      "(no target)",
    matched_rule: event.policy_decision.matched_rule,
    reason: event.policy_decision.reason,
  };
  if (event.tool_event.action) action.action = event.tool_event.action;
  return action;
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}
