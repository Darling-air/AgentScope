# AgentScope CI Workflow Template

V3.1 makes `agentscope gate` easy to run in GitHub Actions. It is a workflow template, not a Marketplace Action.

## How CI Gate Works

The workflow does three things:

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
agentscope ci init github-actions --package-manager pnpm
agentscope ci init github-actions --package-manager npm
agentscope ci init github-actions --allow-missing-evidence
```

The command writes `.github/workflows/agentscope-gate.yml`. It does not run `git add`, commit changes, call GitHub APIs, or modify `.agentscope/config.yaml`.

## pnpm Workflow

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

## npm Workflow

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
- `package.json`

Missing diagnostic items do not cause exit `1`; doctor is not a gate.

## Current Limits

V3.1 does not implement:

- Marketplace Action
- reusable GitHub Action
- SARIF
- PR comment
- JUnit output
- GitHub API calls
- remote/team policy registry
- cloud sync
- Web UI
- branch protection integration
- file content inspection
- command output capture
