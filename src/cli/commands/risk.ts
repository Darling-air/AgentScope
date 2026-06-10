import { getProjectPaths } from "../../core/fs/project-paths.js";
import { readEvidencePackage } from "../../core/evidence/index.js";
import {
  calculateRiskScore,
  type RiskFactor,
  type RiskLevel,
  type RiskScoreV1,
} from "../../core/risk/index.js";
import { color } from "../ui.js";

/**
 * `agentscope risk [--json]`
 *
 * Reads `.agentscope/evidence/latest.json`, computes a deterministic
 * RiskScoreV1, and prints it. This is a read-only summary: it is NOT a policy
 * gate, sets no failing exit code, and never changes hook enforcement.
 */
export function riskCommand(options: { json?: boolean } = {}): void {
  const paths = getProjectPaths();
  const pkg = readEvidencePackage(paths.evidenceLatestFile);

  if (!pkg) {
    if (options.json) {
      console.log(
        JSON.stringify(
          {
            error: "no_evidence",
            message: "No evidence recorded yet.",
            evidence_path: paths.evidenceLatestFile,
          },
          null,
          2,
        ),
      );
      return;
    }
    console.log("");
    console.log(color.yellow("No evidence to score yet."));
    console.log(color.dim(`  Expected at: ${paths.evidenceLatestFile}`));
    console.log(
      color.dim(
        "  Run a Claude Code session with the AgentScope hook installed, then try again.",
      ),
    );
    console.log("");
    return;
  }

  const risk = calculateRiskScore(pkg, {
    evidencePath: paths.evidenceLatestFile,
  });

  if (options.json) {
    console.log(JSON.stringify(risk, null, 2));
    return;
  }

  printRiskReport(risk, paths.evidenceLatestFile);
}

const TOP_FACTORS_LIMIT = 8;

/** Tints a risk level for the terminal. */
export function tintLevel(level: RiskLevel): string {
  switch (level) {
    case "critical":
    case "high":
      return color.red(level);
    case "medium":
      return color.yellow(level);
    case "low":
      return color.green(level);
  }
}

function printRiskReport(risk: RiskScoreV1, evidencePath: string): void {
  console.log("");
  console.log(color.bold("AgentScope Risk (V1.4)"));
  console.log("");
  console.log(`Risk score: ${risk.score} / 100`);
  console.log(`Risk level: ${tintLevel(risk.level)}`);
  console.log(`Task:       ${risk.task.title} (${risk.task.id})`);
  console.log(`Scope hash: ${risk.scope_hash}`);
  console.log("");
  console.log(color.cyan("Event counts:"));
  console.log(`  Total: ${risk.counts.total_events}`);
  console.log(`  ${color.green("allow")}: ${risk.counts.allow}`);
  console.log(`  ${color.red("deny")}:  ${risk.counts.deny}`);
  console.log(`  ${color.yellow("ask")}:   ${risk.counts.ask}`);
  console.log(`  ${color.yellow("warn")}:  ${risk.counts.warn}`);
  console.log(`  interventions: ${risk.counts.policy_interventions}`);
  console.log("");

  printTopFactors(risk.factors);
  console.log("");

  console.log(color.cyan("Recommendations:"));
  for (const rec of risk.recommendations) {
    console.log(`  - ${rec}`);
  }
  console.log("");
  console.log(color.dim(`Evidence path: ${evidencePath}`));
  console.log("");
}

function printTopFactors(factors: RiskFactor[]): void {
  console.log(color.cyan("Top risk factors:"));
  if (factors.length === 0) {
    console.log(color.dim("  (none)"));
    return;
  }

  // Sort by points descending for display only; the underlying list order is
  // deterministic from the engine. Ties keep their original order (stable sort).
  const top = [...factors]
    .sort((a, b) => b.points - a.points)
    .slice(0, TOP_FACTORS_LIMIT);

  for (const f of top) {
    const subject = f.target ?? f.matched_rule ?? "";
    const suffix = subject ? ` ${color.dim(subject)}` : "";
    console.log(`  [+${f.points}] ${f.label}${suffix}`);
  }
}
