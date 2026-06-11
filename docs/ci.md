# AgentScope CI

AgentScope supports two GitHub Actions integration styles: a direct workflow template and a repo-local reusable action. Both are thin wrappers around `agentscope gate`; neither is a Marketplace Action. An optional CI summary step produces a human-readable Markdown report.

## How CI Gate Works

The direct workflow does three things:

1. Install the project dependencies.
2. Run `agentscope gate --json`.
3. Save the JSON output to `.agentscope/ci/gate-result.json` and exit with the gate command's exit code.

The workflow does not reimplement gate thresholds. `agentscope gate` remains the source of truth.

Exit behavior:

- `pass` or `skipped` -> exit `0`
- `fail` -> exit `1`
- missing evidence -> fail by default

## Generate a Workflow

```bash
agentscope ci init github-actions
git add .github/workflows/agentscope-gate.yml
```

Options:

```bash
agentscope ci init github-actions --force
agentscope ci init github-actions --mode direct
agentscope ci init github-actions --mode action
agentscope ci init github-actions --package-manager pnpm
agentscope ci init github-actions --package-manager npm
agentscope ci init github-actions --allow-missing-evidence
agentscope ci init github-actions --summary .agentscope/ci/summary.md
```

The command writes `.github/workflows/agentscope-gate.yml`. It does not run `git add`, commit changes, call GitHub APIs, or modify `.agentscope/config.yaml`.

## Direct Workflow

Direct mode is the default:

```bash
agentscope ci init github-actions --mode direct
```

It runs `agentscope gate --json` directly.

### pnpm

```yaml
- name: Install dependencies
  run: |
    corepack enable
    pnpm install --frozen-lockfile

- name: Run AgentScope gate
  shell: bash
  run: |
    mkdir -p .agentscope/ci
    set +e
    pnpm exec agentscope gate --json > .agentscope/ci/gate-result.json
    code=$?
    cat .agentscope/ci/gate-result.json
    exit $code
```

### npm

```yaml
- name: Install dependencies
  run: |
    npm ci

- name: Run AgentScope gate
  shell: bash
  run: |
    mkdir -p .agentscope/ci
    set +e
    npx agentscope gate --json > .agentscope/ci/gate-result.json
    code=$?
    cat .agentscope/ci/gate-result.json
    exit $code
```

## Repo-local Reusable Action

Action mode generates a workflow that uses this repository's root `action.yml`:

```bash
agentscope ci init github-actions --mode action
```

The generated gate step is:

```yaml
- name: Run AgentScope Gate
  uses: ./
  with:
    package-manager: pnpm
```

For npm:

```bash
agentscope ci init github-actions --mode action --package-manager npm
```

```yaml
with:
  package-manager: npm
```

For missing-evidence rollout:

```bash
agentscope ci init github-actions --mode action --allow-missing-evidence
```

```yaml
with:
  package-manager: pnpm
  allow-missing-evidence: true
```

The repo-local action can also be used manually:

```yaml
- name: Run AgentScope Gate
  uses: ./
  with:
    package-manager: pnpm
    allow-missing-evidence: false
```

Action outputs:

- `status`
- `score`
- `level`
- `result-path`

The action creates `.agentscope/ci`, runs `agentscope gate --json`, writes `.agentscope/ci/gate-result.json`, parses outputs from that JSON, and finally exits with the gate command's exit code. It does not copy threshold, factor, policy, risk, evidence, hook, or scope-history logic.

Marketplace Action usage is planned but not implemented yet.

## Missing Evidence

By default, missing `.agentscope/evidence/latest.json` fails the gate. This is intentional: CI cannot prove the session was governed without evidence.

For early rollout, you can generate a workflow that skips missing evidence:

```bash
agentscope ci init github-actions --allow-missing-evidence
```

This appends `--allow-missing-evidence` to the gate command. Treat it as a temporary adoption aid, not a long-term enforcement posture.

## Inspect Gate Results

The workflow writes:

```txt
.agentscope/ci/gate-result.json
```

The file contains the `GateResultV1` JSON produced by `agentscope gate --json`. The template also prints it to the job log.

## CI Summary

`agentscope ci-summary` writes a human-readable Markdown summary from the Evidence Package and risk score:

```bash
agentscope ci-summary                              # writes .agentscope/ci/summary.md
agentscope ci-summary --output path/to/summary.md  # custom path
agentscope ci-summary --json                       # also print the summary JSON
```

The summary includes the task, scope hash, risk score / level, denied / asked / high-risk actions, top risk factors, and recommendations. It is **display only**: it applies no threshold, never fails CI, and never changes the gate's exit code.

Add a summary step to a generated workflow with `--summary`:

```bash
agentscope ci init github-actions --summary .agentscope/ci/summary.md
agentscope ci init github-actions --mode action --summary .agentscope/ci/summary.md
```

In `--mode action`, this passes a `summary-path` input to the repo-local action; the action runs `agentscope ci-summary` after the gate and tolerates its failure so the summary step never changes the job result. The summary file is suitable for a GitHub Actions Step Summary or an uploaded artifact (artifact upload is optional and not part of the core template).

## Doctor

Run:

```bash
agentscope ci doctor
agentscope ci doctor --json
```

Doctor checks for:

- `.agentscope/config.yaml`
- `.agentscope/evidence/latest.json`
- `.github/workflows/agentscope-gate.yml`
- `action.yml`
- `package.json`

Missing diagnostic items do not cause exit `1`; doctor is not a gate. If a workflow contains `uses: ./` but `action.yml` is missing, doctor recommends adding the repo-local action.

## Current Limits

The following are **planned but not implemented**:

- Marketplace Action publishing
- SARIF output
- PR comments
- JUnit output
- GitHub API calls
- remote/team policy registry
- cloud sync
- Web UI
- branch protection integration
- file content inspection
- command output capture

Artifact upload of the gate result or CI summary is possible in your own workflow but is not required behavior of the core template.
