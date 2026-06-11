# AgentScope GitHub Actions Examples

This directory contains copyable GitHub Actions examples for AgentScope.

## Direct Workflow

`agentscope-gate.yml` runs:

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
agentscope ci init github-actions --mode direct
```

Direct mode is the default.

## Repo-local Action Workflow

`agentscope-action.yml` uses the root `action.yml` as a repo-local reusable action:

```yaml
- name: Run AgentScope Gate
  uses: ./
  with:
    package-manager: pnpm
```

Generate this workflow with:

```bash
agentscope ci init github-actions --mode action
```

This is a repo-local action example, not a Marketplace Action.

The action outputs:

- `status`
- `score`
- `level`
- `result-path`

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

## CI Summary (optional)

Generate a workflow that also writes a human-readable Markdown summary:

```bash
agentscope ci init github-actions --summary .agentscope/ci/summary.md
agentscope ci init github-actions --mode action --summary .agentscope/ci/summary.md
```

The summary runs `agentscope ci-summary` after the gate. It is display only — it never changes the gate's exit code or fails the job. Suitable for a GitHub Actions Step Summary or an uploaded artifact.

## Current Limits

The following are **planned but not implemented**: Marketplace publishing, SARIF, PR comments, JUnit output, GitHub API calls, branch protection integration, and remote/team policy. Artifact upload of the gate result or CI summary is possible in your own workflow but is not required behavior of the core template.
