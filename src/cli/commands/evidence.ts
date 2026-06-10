import { getProjectPaths } from "../../core/fs/project-paths.js";
import {
  readEvidencePackage,
  clearEvidence,
  summarizeEvidence,
  type EvidenceEvent,
} from "../../core/evidence/index.js";
import { color } from "../ui.js";

/**
 * `agentscope evidence show [--json]`
 *
 * Reads `.agentscope/evidence/latest.json` and prints a human-readable summary
 * of the recorded policy decisions (or the raw JSON with --json). This is an
 * audit view only — it does not compute a risk score (that is V1.4).
 */
export function evidenceShowCommand(options: { json?: boolean } = {}): void {
  const paths = getProjectPaths();
  const pkg = readEvidencePackage(paths.evidenceLatestFile);

  if (!pkg) {
    console.log("");
    console.log(color.yellow("No evidence recorded yet."));
    console.log(color.dim(`  Expected at: ${paths.evidenceLatestFile}`));
    console.log(
      color.dim(
        "  Evidence is written when a Claude Code session runs with the hook installed.",
      ),
    );
    console.log("");
    return;
  }

  if (options.json) {
    console.log(JSON.stringify(pkg, null, 2));
    return;
  }

  const s = summarizeEvidence(pkg);

  console.log("");
  console.log(color.bold("AgentScope Evidence"));
  console.log("");
  console.log(`Evidence path: ${paths.evidenceLatestFile}`);
  console.log(`Task id:       ${s.taskId}`);
  console.log(`Task title:    ${s.taskTitle}`);
  console.log(`Scope hash:    ${s.scopeHash}`);
  console.log(`Created at:    ${pkg.created_at}`);
  console.log(`Updated at:    ${pkg.updated_at}`);
  console.log("");
  console.log(color.cyan("Event counts:"));
  console.log(`  Total: ${s.total}`);
  console.log(`  ${color.green("allow")}: ${s.allow}`);
  console.log(`  ${color.red("deny")}:  ${s.deny}`);
  console.log(`  ${color.yellow("ask")}:   ${s.ask}`);
  console.log(`  ${color.yellow("warn")}:  ${s.warn}`);
  console.log("");

  printInterventions(pkg.policy_interventions);
  console.log("");
}

const RECENT_LIMIT = 10;

function printInterventions(interventions: EvidenceEvent[]): void {
  console.log(color.cyan("Recent policy interventions (non-allow):"));
  if (interventions.length === 0) {
    console.log(color.dim("  (none)"));
    return;
  }

  const recent = interventions.slice(-RECENT_LIMIT);
  for (const ev of recent) {
    const d = ev.policy_decision.decision;
    const tinted =
      d === "deny" ? color.red(d) : color.yellow(d);
    const subject =
      ev.tool_event.target ?? ev.tool_event.command ?? "(no target)";
    const tool = ev.tool_event.tool_name ?? ev.tool_event.event_type;
    console.log(`  [${tinted}] ${tool} ${subject}`);
    console.log(`     ${color.dim(ev.policy_decision.reason)}`);
  }
}

/**
 * `agentscope evidence clear`
 *
 * Removes `.agentscope/evidence/latest.json`. Missing file is a friendly no-op.
 */
export function evidenceClearCommand(): void {
  const paths = getProjectPaths();
  const result = clearEvidence(paths.evidenceLatestFile);

  if (result.removed) {
    console.log(color.green(`Removed ${result.latestFile}`));
  } else {
    console.log(color.dim(`No evidence to clear at ${result.latestFile}`));
  }
}
