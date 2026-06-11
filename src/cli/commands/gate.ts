import { getProjectPaths } from "../../core/fs/project-paths.js";
import { readEvidencePackage } from "../../core/evidence/index.js";
import { loadConfigResult } from "../../core/config/load-config.js";
import { calculateRiskScore } from "../../core/risk/index.js";
import {
  GATE_RESULT_VERSION,
  evaluatePolicyGate,
  type GateReason,
  type GateResultV1,
} from "../../core/gate/index.js";
import { color } from "../ui.js";
import { tintLevel } from "./risk.js";

export interface GateCommandOptions {
  json?: boolean;
  allowMissingEvidence?: boolean;
}

export function gateCommand(options: GateCommandOptions = {}): void {
  const paths = getProjectPaths();
  const pkg = readEvidencePackage(paths.evidenceLatestFile);

  if (!pkg) {
    const result = missingEvidenceResult(
      paths.evidenceLatestFile,
      options.allowMissingEvidence ?? false,
    );
    emitGateResult(result, options.json);
    process.exitCode = result.passed ? 0 : 1;
    return;
  }

  const config = loadConfigResult(paths);
  if (!config.ok) {
    if (options.json) {
      console.log(
        JSON.stringify(
          {
            error: "invalid_config",
            message: config.message,
            config_path: paths.configFile,
          },
          null,
          2,
        ),
      );
    } else {
      console.error(color.red("Invalid config:"));
      console.error(config.message);
    }
    process.exitCode = 1;
    return;
  }

  const risk = calculateRiskScore(pkg, {
    evidencePath: paths.evidenceLatestFile,
  });
  const result = evaluatePolicyGate({ risk, gate: config.config.gate });
  emitGateResult(result, options.json);
  process.exitCode = result.passed ? 0 : 1;
}

function missingEvidenceResult(
  evidencePath: string,
  allowed: boolean,
): GateResultV1 {
  const reason: GateReason = allowed
    ? {
        id: "missing_evidence_allowed",
        label: "Missing evidence was allowed by CLI option",
        severity: "info",
        source: "evidence",
        details: { evidence_path: evidencePath },
      }
    : {
        id: "missing_evidence",
        label: "No evidence package was found",
        severity: "critical",
        source: "evidence",
        details: { evidence_path: evidencePath },
      };

  return {
    version: GATE_RESULT_VERSION,
    status: allowed ? "skipped" : "fail",
    passed: allowed,
    summary: allowed
      ? "Policy gate skipped."
      : "Policy gate failed: missing evidence.",
    task: {
      id: "unknown",
      title: "Unknown task",
    },
    scope_hash: "unknown",
    risk: {
      version: "0.1",
      score: 0,
      level: "low",
      summary: "No evidence available.",
      task: {
        id: "unknown",
        title: "Unknown task",
      },
      scope_hash: "unknown",
      counts: {
        total_events: 0,
        allow: 0,
        deny: 0,
        ask: 0,
        warn: 0,
        policy_interventions: 0,
      },
      factors: [],
      recommendations: [],
      evidence: {
        path: evidencePath,
        created_at: "",
        updated_at: "",
      },
    },
    policy: {
      enabled: true,
      max_score: 74,
      max_level: "high",
      max_denies: 0,
      max_asks: 10,
      allow_warnings: true,
      fail_on_blocked_path: true,
      fail_on_dangerous_command: true,
      fail_on_high_risk_without_review: false,
    },
    reasons: [reason],
    evidence: {
      path: evidencePath,
      created_at: "",
      updated_at: "",
    },
  };
}

function emitGateResult(result: GateResultV1, json?: boolean): void {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  printGateResult(result);
}

function printGateResult(result: GateResultV1): void {
  console.log("");
  console.log(`Policy gate: ${statusText(result.status)}`);
  console.log("");
  console.log(`Task:       ${result.task.title} (${result.task.id})`);
  console.log(`Scope hash: ${result.scope_hash}`);
  console.log("");
  console.log(`Risk score: ${result.risk.score} / 100`);
  console.log(`Risk level: ${tintLevel(result.risk.level)}`);
  console.log("");
  console.log(color.cyan("Policy thresholds:"));
  console.log(`  Max score:                ${result.policy.max_score}`);
  console.log(`  Max level:                ${result.policy.max_level}`);
  console.log(`  Max denies:               ${result.policy.max_denies}`);
  console.log(`  Max asks:                 ${result.policy.max_asks}`);
  console.log(`  Allow warnings:           ${result.policy.allow_warnings}`);
  console.log(`  Fail on blocked path:     ${result.policy.fail_on_blocked_path}`);
  console.log(`  Fail on dangerous command:${result.policy.fail_on_dangerous_command}`);
  console.log(
    `  Fail high-risk no review: ${result.policy.fail_on_high_risk_without_review}`,
  );
  console.log("");
  console.log(color.cyan("Reasons:"));
  if (result.reasons.length === 0) {
    console.log(color.dim("  (none)"));
  } else {
    for (const reason of result.reasons) {
      console.log(`  - ${reason.id}: ${reason.label}`);
    }
  }
  console.log("");
  console.log(color.dim(`Evidence path: ${result.evidence.path ?? "(none)"}`));
  console.log(
    color.dim(
      result.passed
        ? "Exit code: 0"
        : "Exit code: 1",
    ),
  );
  console.log("");
}

function statusText(status: GateResultV1["status"]): string {
  switch (status) {
    case "pass":
      return color.green("PASS");
    case "fail":
      return color.red("FAIL");
    case "skipped":
      return color.yellow("SKIPPED");
  }
}
