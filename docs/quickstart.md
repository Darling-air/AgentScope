# Quickstart

A copy-pasteable, end-to-end walkthrough of AgentScope, from build to CI summary.
Everything is local and deterministic — no LLM judging, no network calls.

## Prerequisites

- Node.js ≥ 18 and [pnpm](https://pnpm.io/)
- A project that is a **git repository**
- [Claude Code](https://www.anthropic.com/claude-code) installed and on your
  `PATH` (only needed for the live runtime-enforcement steps)

## 1. Build and link the CLI

From the AgentScope repo:

```bash
pnpm install
pnpm build
pnpm link --global
```

> **Windows / PATH note:** if `agentscope` is not found after
> `pnpm link --global`, the pnpm global bin directory is probably not on your
> `PATH`. Find it with `pnpm bin --global` and add it to `PATH`. Alternatively,
> skip linking and run the CLI directly from the repo with
> `node dist/index.js <command>` or `pnpm agentscope <command>`.

## 2. Set up a least-privilege scope

Run these from the project you want to govern:

```bash
agentscope init                              # writes .agentscope/config.yaml
agentscope start "Fix login redirect bug"    # infers a scope, asks to approve
```

`start` infers a deterministic scope (for this task: allow `src/auth/**`, block
`.env*`, ask on `package.json`) and prompts `Approve? [Y/n/e]`. Press `Y`.

## 3. Install the Claude Code hook and start coding

```bash
agentscope install claude-code               # writes .claude/settings.local.json
claude
```

Once installed, Claude Code calls AgentScope before every `Read` / `Edit` /
`Write` / `Bash` and gets back `allow` / `ask` / `deny` based on the active
scope. In the session, try prompts that exercise each decision:

```text
Read .env.local           → DENY   (.env* is a blocked path)
Write package.json        → ASK    (high-risk path, needs confirmation)
Edit src/auth/login.ts    → ALLOW  (within src/auth/**)
```

## 4. Inspect what happened

```bash
agentscope evidence show     # summary of recorded policy decisions
agentscope risk              # deterministic risk score + factors + recommendations
agentscope gate              # local policy gate: exit 0 pass/skipped, 1 fail
agentscope ci-summary        # human-readable Markdown summary (display only)
```

## `risk` vs `report` vs `gate`

These three read the same Evidence Package but serve different purposes:

| Command | What it does | Exit code |
| --- | --- | --- |
| `agentscope risk` | Computes the deterministic risk score, factors, and recommendations. | Always `0` |
| `agentscope report` | Prints an audit summary (counts, denied/asked actions, risk score). | Always `0` |
| `agentscope gate` | Evaluates evidence + risk against the effective gate policy and enforces it. | `0` pass/skipped, `1` fail |

Only `gate` enforces. `risk` and `report` are read-only summaries that never
fail and never change hook enforcement.

## Missing evidence

`agentscope gate` **fails by default** when `.agentscope/evidence/latest.json`
is missing — CI cannot prove a session was governed without evidence. For early
rollout, you can explicitly skip that case:

```bash
agentscope gate --allow-missing-evidence     # missing evidence -> skipped (exit 0)
```

Treat `--allow-missing-evidence` as a temporary adoption aid, not a long-term
enforcement posture.

## CI summary does not affect exit codes

`agentscope ci-summary` writes a human-readable Markdown summary (default
`.agentscope/ci/summary.md`, override with `--output <file>`, add `--json` for
the JSON form). It is **display only**: it never applies a threshold, never
fails CI, and never changes the gate's exit code. Use it for a GitHub Actions
Step Summary or as an uploaded artifact.

## CI

Generate a GitHub Actions workflow that runs the gate:

```bash
agentscope ci init github-actions            # direct workflow (default)
agentscope ci init github-actions --mode action   # uses the repo-local action.yml
agentscope ci doctor                         # check CI readiness
```

See [docs/ci.md](ci.md) for the full CI guide and
[examples/live-demo/](../examples/live-demo/README.md) for a reproducible
deny / ask / allow walkthrough with reference outputs.
