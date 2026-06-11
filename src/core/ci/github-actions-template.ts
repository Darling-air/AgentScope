export type CiPackageManager = "pnpm" | "npm";
export type GithubActionsTemplateMode = "direct" | "action";

export interface GithubActionsTemplateOptions {
  packageManager?: CiPackageManager;
  allowMissingEvidence?: boolean;
  mode?: GithubActionsTemplateMode;
  summaryPath?: string;
}

export const GITHUB_ACTIONS_WORKFLOW_PATH =
  ".github/workflows/agentscope-gate.yml";

export function isCiPackageManager(value: string): value is CiPackageManager {
  return value === "pnpm" || value === "npm";
}

export function isGithubActionsTemplateMode(
  value: string,
): value is GithubActionsTemplateMode {
  return value === "direct" || value === "action";
}

export function githubActionsWorkflowTemplate(
  options: GithubActionsTemplateOptions = {},
): string {
  const packageManager = options.packageManager ?? "pnpm";
  const mode = options.mode ?? "direct";
  if (mode === "action") {
    return githubActionsActionWorkflowTemplate(options);
  }

  const allowMissing = options.allowMissingEvidence ?? false;
  const summaryPath = options.summaryPath;
  const installCommand =
    packageManager === "pnpm"
      ? "corepack enable\n          pnpm install --frozen-lockfile"
      : "npm ci";
  const gateCommand =
    packageManager === "pnpm"
      ? `pnpm exec agentscope gate --json${allowMissing ? " --allow-missing-evidence" : ""}`
      : `npx agentscope gate --json${allowMissing ? " --allow-missing-evidence" : ""}`;

  const summaryStep = summaryPath
    ? `
      - name: Generate AgentScope CI summary
        if: always()
        shell: bash
        run: |
          ${packageManager === "pnpm" ? "pnpm exec" : "npx"} agentscope ci-summary --output ${summaryPath}
`
    : "";

  return `name: AgentScope Gate

on:
  pull_request:
  push:
    branches:
      - main

jobs:
  agentscope-gate:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: |
          ${installCommand}

      - name: Run AgentScope gate
        shell: bash
        run: |
          mkdir -p .agentscope/ci
          set +e
          ${gateCommand} > .agentscope/ci/gate-result.json
          code=$?
          cat .agentscope/ci/gate-result.json
          exit $code
${summaryStep}
`;
}

function githubActionsActionWorkflowTemplate(
  options: GithubActionsTemplateOptions = {},
): string {
  const packageManager = options.packageManager ?? "pnpm";
  const allowMissing = options.allowMissingEvidence ?? false;
  const summaryPath = options.summaryPath;
  const installCommand =
    packageManager === "pnpm"
      ? "corepack enable\n          pnpm install --frozen-lockfile"
      : "npm ci";
  const allowMissingInput = allowMissing
    ? "          allow-missing-evidence: true\n"
    : "";
  const summaryInput = summaryPath
    ? `          summary-path: ${summaryPath}\n`
    : "";

  return `name: AgentScope Gate

on:
  pull_request:
  push:
    branches:
      - main

jobs:
  agentscope-gate:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: |
          ${installCommand}

      - name: Run AgentScope Gate
        uses: ./
        with:
          package-manager: ${packageManager}
${allowMissingInput}${summaryInput}`;
}
