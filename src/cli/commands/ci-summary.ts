import { getProjectPaths } from "../../core/fs/project-paths.js";
import { readEvidencePackage } from "../../core/evidence/index.js";
import { calculateRiskScore } from "../../core/risk/index.js";
import {
  DEFAULT_CI_SUMMARY_PATH,
  buildCiSummary,
  writeCiSummaryFile,
} from "../../core/ci/ci-summary.js";
import { color } from "../ui.js";

export interface CiSummaryCommandOptions {
  json?: boolean;
  output?: string;
}

export function ciSummaryCommand(
  options: CiSummaryCommandOptions = {},
): void {
  const paths = getProjectPaths();
  const output = options.output ?? DEFAULT_CI_SUMMARY_PATH;
  const pkg = readEvidencePackage(paths.evidenceLatestFile);

  if (!pkg) {
    const result = {
      error: "no_evidence",
      message: "No evidence recorded yet.",
      summary_path: output,
      evidence_path: paths.evidenceLatestFile,
    };

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log("");
      console.log(color.yellow("No evidence to summarize yet."));
      console.log(color.dim(`  Expected at: ${paths.evidenceLatestFile}`));
      console.log("");
    }
    process.exitCode = 0;
    return;
  }

  const risk = calculateRiskScore(pkg, {
    evidencePath: paths.evidenceLatestFile,
  });
  const summary = buildCiSummary({
    evidence: pkg,
    risk,
    summaryPath: output,
  });

  writeCiSummaryFile(output, summary.markdown);

  if (options.json) {
    console.log(JSON.stringify(summary.json, null, 2));
  } else {
    console.log("");
    console.log(`${color.green("[OK]")} Wrote ${color.cyan(output)}`);
    console.log(color.dim("Summary generation does not enforce the gate."));
    console.log("");
  }

  process.exitCode = 0;
}
