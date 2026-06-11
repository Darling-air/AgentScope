# AgentScope GitHub Actions Workflow Example

This directory contains a copyable GitHub Actions workflow that runs:

```bash
agentscope gate --json
```

The workflow does not reimplement gate logic. The `agentscope gate` exit code is the only pass/fail signal.

## Use It

Copy the workflow into your repository:

```bash
mkdir -p .github/workflows
cp examples/github-actions/agentscope-gate.yml .github/workflows/agentscope-gate.yml
```

Or generate it:

```bash
agentscope ci init github-actions
```

## pnpm vs npm

The example defaults to pnpm:

```yaml
corepack enable
pnpm install --frozen-lockfile
pnpm exec agentscope gate --json
```

For npm projects, generate the npm variant:

```bash
agentscope ci init github-actions --package-manager npm
```

That workflow uses:

```yaml
npm ci
npx agentscope gate --json
```

## Missing Evidence

`agentscope gate` fails when `.agentscope/evidence/latest.json` is missing. That is intentional: CI cannot prove the session was governed without evidence.

For early rollout only, you can generate a workflow that skips missing evidence:

```bash
agentscope ci init github-actions --allow-missing-evidence
```

This adds `--allow-missing-evidence` to the gate command.

## Gate Result JSON

The workflow writes:

```txt
.agentscope/ci/gate-result.json
```

It also prints that JSON to the job log. Uploading it as an artifact is optional and not part of the core template.

## Current Limits

This is not a Marketplace Action or reusable GitHub Action. V3.1 does not implement SARIF, PR comments, JUnit output, GitHub API calls, branch protection integration, or remote/team policy.
