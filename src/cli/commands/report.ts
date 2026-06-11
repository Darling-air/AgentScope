import { getProjectPaths } from "../../core/fs/project-paths.js";
import {
  readEvidencePackage,
  summarizeEvidence,
  type EvidenceEvent,
} from "../../core/evidence/index.js";
import { calculateRiskScore } from "../../core/risk/index.js";
import { tintLevel } from "./risk.js";
import { color } from "../ui.js";

/**
 * `agentscope report`
 *
 * Prints an audit summary from `.agentscope/evidence/latest.json`: task, scope
 * hash, a risk score + level (V1.4), event counts, and denied / asked actions.
 *
 * It is NOT a policy gate: it never sets a failing exit code, has no threshold,
 * and never changes hook enforcement. It is a human-readable summary only.
 */
export function reportCommand(): void {
  const paths = getProjectPaths();
  const pkg = readEvidencePackage(paths.evidenceLatestFile);

  if (!pkg) {
    console.log("");
    console.log(color.yellow("No evidence to report on yet."));
    console.log(color.dim(`  Expected at: ${paths.evidenceLatestFile}`));
    console.log(
      color.dim(
        "  Run a Claude Code session with the AgentScope hook installed, then try again.",
      ),
    );
    console.log("");
    return;
  }

  const s = summarizeEvidence(pkg);
  const risk = calculateRiskScore(pkg, {
    evidencePath: paths.evidenceLatestFile,
  });

  console.log("");
  console.log(color.bold("AgentScope Report"));
  console.log("");
  console.log(`Task:       ${s.taskTitle} (${s.taskId})`);
  console.log(`Scope hash: ${s.scopeHash}`);
  console.log("");
  console.log(`Risk score: ${risk.score} / 100`);
  console.log(`Risk level: ${tintLevel(risk.level)}`);
  console.log("");
  console.log(color.cyan("Event counts:"));
  console.log(`  Total: ${s.total}`);
  console.log(`  ${color.green("allow")}: ${s.allow}`);
  console.log(`  ${color.red("deny")}:  ${s.deny}`);
  console.log(`  ${color.yellow("ask")}:   ${s.ask}`);
  console.log(`  ${color.yellow("warn")}:  ${s.warn}`);
  console.log(`  high-risk related: ${s.highRisk}`);
  console.log("");

  const denied = pkg.events.filter(
    (e) => e.policy_decision.decision === "deny",
  );
  const asked = pkg.events.filter(
    (e) => e.policy_decision.decision === "ask",
  );

  printActions(color.red("Denied actions:"), denied);
  console.log("");
  printActions(color.yellow("Asked actions:"), asked);
  console.log("");

  if (risk.recommendations.length > 0) {
    console.log(color.cyan("Recommendations:"));
    for (const rec of risk.recommendations) {
      console.log(`  - ${rec}`);
    }
    console.log("");
  }

  console.log(color.dim(`Evidence path: ${paths.evidenceLatestFile}`));
  console.log(color.dim("Run `agentscope risk` for the full risk breakdown."));
  console.log(color.dim("Policy gate: run `agentscope gate` to enforce thresholds."));
  console.log("");
}

function printActions(heading: string, events: EvidenceEvent[]): void {
  console.log(heading);
  if (events.length === 0) {
    console.log(color.dim("  (none)"));
    return;
  }
  for (const ev of events) {
    const subject =
      ev.tool_event.target ?? ev.tool_event.command ?? "(no target)";
    const tool = ev.tool_event.tool_name ?? ev.tool_event.event_type;
    console.log(`  - ${tool} ${subject}`);
    console.log(`    ${color.dim(ev.policy_decision.reason)}`);
  }
}
