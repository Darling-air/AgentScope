import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getProjectPaths } from "../../core/fs/project-paths.js";
import {
  GITHUB_ACTIONS_WORKFLOW_PATH,
  githubActionsWorkflowTemplate,
  isCiPackageManager,
  type CiPackageManager,
} from "../../core/ci/index.js";
import { color } from "../ui.js";

export interface CiInitGithubActionsOptions {
  force?: boolean;
  allowMissingEvidence?: boolean;
  packageManager?: string;
}

export interface CiDoctorOptions {
  json?: boolean;
}

type DiagnosticStatus = "found" | "missing";

interface DiagnosticItem {
  status: DiagnosticStatus;
  path: string;
}

interface CiDoctorResult {
  config: DiagnosticItem;
  evidence: DiagnosticItem;
  workflow: DiagnosticItem;
  package: DiagnosticItem;
  recommendations: string[];
}

export function ciInitGithubActionsCommand(
  options: CiInitGithubActionsOptions = {},
): void {
  const packageManager = options.packageManager ?? "pnpm";
  if (!isCiPackageManager(packageManager)) {
    console.error(
      color.red(
        `Invalid package manager "${packageManager}". Expected "pnpm" or "npm".`,
      ),
    );
    process.exitCode = 1;
    return;
  }

  const paths = getProjectPaths();
  const target = path.join(paths.root, GITHUB_ACTIONS_WORKFLOW_PATH);

  if (existsSync(target) && !options.force) {
    console.error(
      color.red(
        `Workflow already exists at ${GITHUB_ACTIONS_WORKFLOW_PATH}. Re-run with --force to overwrite.`,
      ),
    );
    process.exitCode = 1;
    return;
  }

  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(
    target,
    githubActionsWorkflowTemplate({
      packageManager: packageManager as CiPackageManager,
      allowMissingEvidence: options.allowMissingEvidence ?? false,
    }),
    "utf8",
  );

  console.log("");
  console.log(
    `${color.green("[OK]")} Wrote ${color.cyan(GITHUB_ACTIONS_WORKFLOW_PATH)}`,
  );
  console.log(
    color.dim("The workflow runs `agentscope gate`; its exit code controls CI."),
  );
  console.log("");
  process.exitCode = 0;
}

export function ciDoctorCommand(options: CiDoctorOptions = {}): void {
  const result = buildDoctorResult();

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = 0;
    return;
  }

  console.log("");
  console.log(color.bold("AgentScope CI Doctor"));
  console.log("");
  printDiagnostic("Config", result.config);
  printDiagnostic("Evidence", result.evidence);
  printDiagnostic("Workflow", result.workflow);
  printDiagnostic("Package", result.package);
  console.log("");
  console.log(color.cyan("Recommendation:"));
  if (result.recommendations.length === 0) {
    console.log(color.dim("  (none)"));
  } else {
    for (const recommendation of result.recommendations) {
      console.log(`  - ${recommendation}`);
    }
  }
  console.log("");
  process.exitCode = 0;
}

function buildDoctorResult(): CiDoctorResult {
  const paths = getProjectPaths();
  const workflowPath = path.join(paths.root, GITHUB_ACTIONS_WORKFLOW_PATH);
  const packagePath = path.join(paths.root, "package.json");

  const result: CiDoctorResult = {
    config: item(paths.configFile),
    evidence: item(paths.evidenceLatestFile),
    workflow: item(workflowPath),
    package: item(packagePath),
    recommendations: [],
  };

  if (result.workflow.status === "missing") {
    result.recommendations.push("Run agentscope ci init github-actions.");
  }
  if (result.evidence.status === "missing") {
    result.recommendations.push(
      "Generate evidence before expecting CI gate to pass.",
    );
  }
  if (result.config.status === "missing") {
    result.recommendations.push("Run agentscope init to create .agentscope/config.yaml.");
  }
  if (result.package.status === "missing") {
    result.recommendations.push("Run from a Node project with package.json.");
  }

  return result;
}

function item(filePath: string): DiagnosticItem {
  return {
    status: existsSync(filePath) ? "found" : "missing",
    path: relativePath(filePath),
  };
}

function relativePath(filePath: string): string {
  return path.relative(process.cwd(), filePath).replace(/\\/g, "/");
}

function printDiagnostic(label: string, item: DiagnosticItem): void {
  const status =
    item.status === "found"
      ? color.green("found")
      : color.yellow("missing");
  console.log(`${label}: ${status} (${item.path})`);
}
