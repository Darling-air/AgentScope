# AgentScope

**Task-scoped runtime governance for AI coding agents.**

AgentScope gives Claude Code a least-privilege task scope, enforces it at runtime, records evidence, calculates a deterministic risk score, evaluates a local policy gate, and produces a human-readable CI summary.

It turns a single natural-language coding task into an explicit, auditable **Task Scope Contract** — which paths a session may touch, which are off-limits, which are high-risk, and which commands are allowed — and then enforces that contract live, before each tool runs.

> Use tokens only to inform the agent. Use deterministic local code to govern the agent. No LLM judging, no network calls.

## Demo

```text
Task:
  Fix login redirect bug

Scope:
  allow  src/auth/**
  block  .env*
  ask    on package.json

Claude Code:
  Read  .env.local          → DENY
  Write package.json        → ASK
  Edit  src/auth/login.ts   → ALLOW

AgentScope:
  evidence/latest.json
  risk score: 55 / 100  (high)
  gate:       FAIL
  ci summary: .agentscope/ci/summary.md
```

When Claude Code tries to read `.env.local`, AgentScope denies it. When it tries to modify `package.json`, AgentScope asks for confirmation. When it edits `src/auth/login.ts`, AgentScope allows it — and every decision is recorded as evidence, rolled up into a deterministic risk score, evaluated by a local policy gate, and summarized for CI.

## Why task-scoped governance

An AI coding agent with broad tool access can read secrets, rewrite lockfiles, or run destructive commands — often as a side effect of a small, well-intentioned task. Reviewing the diff afterwards is too late, and asking an LLM to police itself is neither deterministic nor auditable.

AgentScope scopes each task to least privilege *before* work starts, enforces that scope *live* on every tool call, and leaves a verifiable evidence trail. All of it runs locally with deterministic code — the same inputs always produce the same decisions, score, and gate result. No network, no LLM judging, no file-content inspection.

## Core capabilities

- **Task Scope Contract** — a least-privilege, per-task declaration of allowed / blocked / high-risk paths and commands.
- **Claude Code runtime enforcement** — a PreToolUse hook returns `allow` / `ask` / `deny` before each `Read` / `Edit` / `Write` / `Bash`.
- **Evidence Package** — every decision is appended to `.agentscope/evidence/latest.json` (governance metadata only).
- **Deterministic Risk Score** — an explainable 0–100 score with a per-factor breakdown and recommendations.
- **Local Policy Gate** — `agentscope gate` evaluates evidence + risk + config and exits `0` on pass/skipped, `1` on fail.
- **CI integration** — a GitHub Actions workflow template, a repo-local reusable Action, and a human-readable CI summary.
- **Local-first, no LLM judging** — all inference, enforcement, evidence, scoring, and gating run locally with no network access.

## Quickstart

Requires Node.js ≥ 18 and [pnpm](https://pnpm.io/). Run from a project that is a **git repository**.

```bash
# 1. Build and link the CLI
pnpm install
pnpm build
pnpm link --global

# 2. Set up a least-privilege scope for your task
agentscope init
agentscope start "Fix login redirect bug"   # shows the inferred scope, asks to approve

# 3. Install the Claude Code hook, then start coding
agentscope install claude-code
claude
```

In the live Claude Code session, try prompts that exercise each decision:

```text
Read .env.local           → AgentScope denies it
Write package.json        → AgentScope asks for confirmation
Edit src/auth/login.ts    → AgentScope allows it
```

Then inspect what happened:

```bash
agentscope evidence show   # summary of recorded policy decisions
agentscope risk            # deterministic risk score + factors + recommendations
agentscope report          # audit summary: counts, denied/asked actions, risk score
agentscope gate            # local policy gate: exit 0 pass/skipped, 1 fail
agentscope ci-summary      # human-readable Markdown summary (display only)
```

> **Windows / PATH note:** if `agentscope` is not found after `pnpm link --global`, make sure the pnpm global bin directory is on your `PATH`. Run `pnpm bin --global` to find it, then add it to `PATH`. Alternatively, run the CLI directly with `node dist/index.js <command>` or `pnpm agentscope <command>`.

A full, reproducible walkthrough lives in [`examples/live-demo/`](examples/live-demo/README.md), and a copy-pasteable guide in [`docs/quickstart.md`](docs/quickstart.md).

## What `agentscope start` infers

Scope inference is intentionally simple and **deterministic** — no LLM, no network:

- Task title → kebab-case task id
- Keyword matching for likely paths:
  - `login` / `redirect` / `session` / `auth` → `src/auth/**`, `tests/auth/**`
  - `component` / `ui` / `button` / `navbar` → `src/components/**`, `tests/components/**`
  - `ci` / `workflow` / `github` / `action` → `.github/**` moved out of *blocked* into *allowed + high-risk*
  - `migration` / `database` / `schema` → `migrations/**` moved out of *blocked* into *allowed + high-risk*
- No keyword match → fall back to the config's default allowed paths
- Confidence: `0.80` (multiple keyword hits), `0.72` (one), `0.55` (defaults only)

Review or edit the active scope at any time:

```bash
agentscope show               # display the current Task Scope Contract
agentscope check              # compare current git changes against the scope
```

`agentscope check` classifies each changed file as OK / warning / violation and exits `1` only when a blocked path was modified — useful as a complementary, after-the-fact diff check that needs no agent integration.

## Governing Claude Code

The Claude Code PreToolUse hook provides **live runtime enforcement**. `agentscope install claude-code` registers AgentScope's PreToolUse hook in your Claude Code settings. Once installed, Claude Code calls `agentscope hook claude-code pre-tool-use` before every `Read` / `Edit` / `Write` / `Bash` tool use, and AgentScope returns `allow` / `ask` / `deny` based on the active scope.

```bash
agentscope init
agentscope start "Fix login redirect bug"
agentscope install claude-code
claude
```

### Live demo

With the scope for "Fix login redirect bug" active and the hook installed, here is what Claude Code sees during a real session:

| Claude Code tool use | AgentScope decision | Why |
| --- | --- | --- |
| `Read` `.env.local` | **deny** | `.env*` is a blocked path |
| `Edit` `package.json` | **ask** | high-risk path — needs human confirmation |
| `Edit` `src/auth/login.ts` | **allow** | within `src/auth/**` allowed paths |

A `deny` blocks the tool use outright, and an `ask` pauses for the human to approve or reject — so the agent stays inside the Task Scope Contract for the whole session. (`Bash` commands like `rm -rf node_modules` are also `deny`'d as dangerous commands.)

### Dry-run hook preview

You can preview how the policy engine would respond to a Claude Code tool call without installing anything. The command reads a `PreToolUse` payload from stdin and prints a Claude Code hook response:

```bash
echo '{"hook_event_name":"PreToolUse","tool_name":"Read","tool_input":{"file_path":".env.local"}}' \
  | agentscope hook claude-code pre-tool-use
```

```json
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Blocked by AgentScope: .env.local matches blocked path .env*"}}
```

It reads the active `.agentscope/current-scope.yaml` and `config.yaml` from the current project. If there is no active scope, the payload is invalid, or anything else goes wrong, it returns a safe `ask` response (and still exits `0`) so a misconfigured hook never crashes the agent or silently allows an action.

### Path normalization (Windows / POSIX)

Claude Code may pass a `file_path` as either a relative path (`.env.local`) or an absolute one — Windows (`G:\AgentScope\.env.local`) or POSIX (`G:/AgentScope/.env.local`). Scope globs are written repo-relative with forward slashes, so AgentScope normalizes every incoming target before matching: absolute paths under the project root are made **repo-relative**, backslashes become forward slashes, and Windows drive letters are compared case-insensitively. A path outside the project root is normalized but left absolute (never crashes, never wrongly collapses). This keeps enforcement consistent across Windows, macOS, and Linux.

### Where it writes

| Command | Target file |
| --- | --- |
| `agentscope install claude-code` | `.claude/settings.local.json` (default, not committed) |
| `agentscope install claude-code --shared` | `.claude/settings.json` (committed, shared with the team) |

The default is the **local** settings file so installing AgentScope does not change shared project config. Use `--shared` deliberately when the whole team should get the hook.

### Safety

- **Backup**: before the first write, the existing settings file is copied to `<file>.agentscope-backup`. An existing backup is never overwritten, so it always holds your original pre-AgentScope settings.
- **Non-destructive**: install preserves all other hooks and settings — it only adds or refreshes the single AgentScope PreToolUse entry. Installing twice is idempotent (no duplicates).
- **Malformed settings**: if the settings file is not valid JSON, AgentScope refuses to overwrite it and reports an error.
- **Dry run**: `agentscope install claude-code --dry-run` prints the target path and the resulting settings without writing anything or creating a backup.

### Uninstall

```bash
agentscope uninstall claude-code            # removes the hook from settings.local.json
agentscope uninstall claude-code --shared   # removes it from settings.json
```

Uninstall removes **only** the AgentScope hook, leaving your other hooks intact. It does not restore the backup file and does not delete the `.claude/` directory.

## Evidence

Every live policy decision is recorded to a local audit artifact so there is a verifiable trail of what the agent asked to do and what AgentScope decided. After a decision is made, the hook appends an **EvidenceEvent** to `.agentscope/evidence/latest.json`.

Recording is **best-effort**: if writing evidence fails for any reason, the hook still returns its normal `allow` / `ask` / `deny` response. Evidence never breaks enforcement. The evidence records **governance metadata only** — it never captures file contents, command output, or the agent's reply text.

```bash
agentscope evidence show          # human-readable summary of recorded decisions
agentscope evidence show --json   # the raw latest.json
agentscope evidence clear         # delete latest.json (safe no-op if absent)
agentscope report                 # audit summary: counts, denied + asked actions, risk score
```

The `scope_hash` is a `sha256` over a canonical snapshot of the scope (task id/title + the four path/command arrays). On each decision the recorder creates a new package if `latest.json` does not exist, **appends** the event when the current scope's `scope_hash` matches, or **resets** the package when the `scope_hash` differs — so events are never mixed across scopes. Writes are atomic (temp file + rename).

## Risk Score

`agentscope risk` reads the Evidence Package and computes a **deterministic, explainable** risk score. It is a pure function of the evidence: same evidence in, same score out — no LLM, no network, no clock, no file-content inspection. It never changes hook enforcement.

```bash
agentscope risk          # human-readable score, factors, and recommendations
agentscope risk --json   # the full RiskScoreV1 JSON
```

The score is `0–100`, mapped to a level:

| Score | Level |
| --- | --- |
| 0–24 | low |
| 25–49 | medium |
| 50–74 | high |
| 75–100 | critical |

### How the score is computed

Each event contributes points; every non-zero contribution becomes a **factor** so the score is traceable back to specific actions.

Per-event:

- **deny** → `max(risk_delta, 15)`; `dangerous_commands:*` rule → at least 40; `blocked_paths:*` rule → at least 20
- **ask** → `max(risk_delta, 8)`; `high_risk:*` rule → at least 25; a write/edit with no matched rule → at least 15
- **warn** → `max(risk_delta, 5)`
- **allow** → 0, unless it carries a *positive* `risk_delta` (a negative `risk_delta` never pushes the total below 0)

Session-level (added once if the condition holds):

- ≥ 3 policy interventions → +10
- ≥ 2 denies → +10
- both a blocked-path and a high-risk intervention occurred → +10
- a dangerous command was attempted → +15

The total is clamped to `0–100`. Recommendations are derived deterministically from which factors fired.

> **Not a policy gate.** `agentscope risk` computes score only. `agentscope report` prints an audit summary only. Neither enforces thresholds or changes the exit code. Use `agentscope gate` to enforce.

## Policy Gate

`agentscope gate` reads `.agentscope/evidence/latest.json`, calculates `RiskScoreV1`, loads the effective local gate policy, and returns an exit code:

```bash
agentscope gate
# Policy gate: FAIL
# Reasons:
#   - deny_count_exceeded: Deny count exceeded policy threshold
#   - blocked_path_denied: Blocked path access was denied

agentscope gate --json
agentscope gate --allow-missing-evidence
```

Exit codes:

- `0` for pass or skipped
- `1` for fail

Missing evidence fails by default because the gate cannot prove the session was governed. Use `--allow-missing-evidence` to explicitly skip that case during early rollout.

## CI

AgentScope offers two GitHub Actions integration styles, both thin wrappers around `agentscope gate` — they never reimplement gate logic.

```bash
agentscope ci init github-actions                 # direct workflow (default)
agentscope ci init github-actions --mode action   # uses the repo-local action.yml
agentscope ci init github-actions --package-manager npm
agentscope ci init github-actions --allow-missing-evidence
agentscope ci doctor                              # check CI readiness
```

The direct workflow runs `pnpm exec agentscope gate --json` and exits with the gate's exit code, which controls CI pass/fail. The repo-local action exposes `status`, `score`, `level`, and `result-path` outputs:

```yaml
- name: Run AgentScope Gate
  uses: ./
  with:
    package-manager: pnpm
```

### CI summary

`agentscope ci-summary` generates a human-readable Markdown summary from the evidence and risk score:

```bash
agentscope ci-summary                              # writes .agentscope/ci/summary.md
agentscope ci-summary --output path/to/summary.md  # custom path
agentscope ci-summary --json                       # also print the summary JSON
```

The summary includes the task, scope hash, risk score / level, denied / asked / high-risk actions, top risk factors, and recommendations. It is **display only**: it applies no threshold, never fails CI, and never changes the gate's exit code. Wire it into a workflow with `--summary`:

```bash
agentscope ci init github-actions --mode action --summary .agentscope/ci/summary.md
```

See [docs/ci.md](docs/ci.md) for the full guide. CI integration is local-only and CI-only.

## Configuration

`agentscope init` writes `.agentscope/config.yaml`, a project-local file that tunes AgentScope's built-in policy defaults, inference preferences, and gate thresholds. Every list uses an `add` / `remove` structure so you adjust the defaults without restating them. All fields are optional — missing fields fall back to built-in defaults.

```yaml
version: 1

policy:
  blocked_paths:
    add:
      - private/**          # also block this path
    remove:
      - infra/**            # stop blocking this default
  high_risk:
    add:
      - scripts/release/**  # require confirmation for these
  dangerous_commands:
    add:
      - gh secret *         # deny this command at runtime

inference:
  confidence_threshold: 0.65
  fallback:
    enabled: true
    allowed_paths:
      - src/**
      - tests/**

gate:
  enabled: true
  risk:
    max_score: 74
    max_level: high
  decisions:
    max_denies: 0
    max_asks: 10
    allow_warnings: true
  rules:
    fail_on_blocked_path: true
    fail_on_dangerous_command: true
    fail_on_high_risk_without_review: false
```

Inspect and validate the resolved (effective) config:

```bash
agentscope config show          # human-readable effective config
agentscope config show --json   # the effective config as JSON
agentscope config validate      # exit 0 if valid (or no config), exit 1 if invalid
```

- **Config changes affect newly generated scopes only.** Editing `config.yaml` does **not** rewrite your active `.agentscope/current-scope.yaml`. Re-run `agentscope start "<task>"` to apply config changes to a new scope.
- **Runtime dangerous commands** for the Claude Code hook are read from `policy.dangerous_commands`. An invalid config never crashes the hook and never weakens enforcement — it falls back to the safe built-in dangerous-command list.

## Reviewing & overriding a scope

Config is the project-wide layer that shapes *future* inference. **Overrides** are the per-scope layer that adjust *one* Task Scope Contract — without ever touching `config.yaml`. Every override is recorded in the scope's rationale as an `Override: ...` line.

### Override at `start` time

```bash
agentscope start "Fix login redirect bug" \
  --add-allowed "app/auth/**" \
  --remove-allowed "src/**/login*" \
  --add-blocked "private/**" \
  --add-high-risk "scripts/release/**" \
  --add-command "npm run test:auth"
```

Flags (all repeatable): `--add-allowed` / `--remove-allowed`, `--add-blocked` / `--remove-blocked`, `--add-high-risk` / `--remove-high-risk`, `--add-command` / `--remove-command`. They compose with `--dry-run` and `--json`.

### The `scope` command group

```bash
agentscope scope explain                       # explain the active scope
agentscope scope explain --json                # the active scope as JSON

agentscope scope list                                      # saved historical task scopes
agentscope scope use fix-login-redirect-bug                # restore a historical scope
agentscope scope diff --task fix-login-redirect-bug        # active scope vs a saved scope
agentscope scope diff --task fix-login-redirect-bug --json

agentscope scope apply --add-allowed "tests/app/auth/**"            # override the active scope
agentscope scope apply --add-allowed "tests/app/auth/**" --dry-run  # preview, write nothing
agentscope scope apply --add-blocked "private/**" --json            # patched scope as JSON, no write
```

`scope apply` rewrites `current-scope.yaml` from override flags. It does **not** re-run inference and does **not** modify `config.yaml`.

## Files AgentScope writes

```
.agentscope/
  config.yaml            # project defaults (created by `init`)
  current-scope.yaml     # the active Task Scope Contract
  scopes/
    <task-id>.yaml       # a per-task snapshot of each approved scope
  evidence/
    latest.json          # Evidence Package (live policy decisions)
  ci/
    summary.md           # CI summary (written by `ci-summary`)
    gate-result.json     # gate result JSON (written by the CI workflow)
```

The risk score is computed on demand from `latest.json`; it is not persisted. AgentScope never reads the *contents* of your source or secret files — it only matches file **paths** against glob patterns, and evidence stores only governance metadata.

## Status and limitations

AgentScope is at **v0.1.0**. The local + CI loop is complete:

```text
Local:  task → scope → enforcement → evidence → risk → gate
CI:     workflow template → reusable action → gate-result.json → summary.md
```

Implemented and supported:

- Task Scope Contract, deterministic scope inference, project-local config, per-scope overrides, and multi-task scope history
- Claude Code live runtime enforcement (PreToolUse hook + installer)
- Evidence Package, deterministic Risk Score, and audit report
- Local Policy Gate (`agentscope gate`)
- CI workflow template, repo-local reusable GitHub Action, and CI summary output

**Not implemented yet** (planned for later milestones — see [docs/v0-v6-roadmap.md](docs/v0-v6-roadmap.md)):

- SARIF output
- PR comments
- Marketplace Action publishing
- GitHub API integration
- Remote / team policy registry and cloud sync
- Multi-agent governance (Cursor / Codex / Gemini), MCP-specific handling
- Web UI / dashboard, LLM-based inference

This release does **not** call any network or GitHub API, does **not** inspect file contents, and does **not** capture command output.

## Development

```bash
pnpm install      # install dependencies
pnpm build        # build the CLI to dist/
pnpm test         # run the Vitest suite
pnpm lint         # run ESLint
pnpm typecheck    # run tsc --noEmit
pnpm smoke        # end-to-end CLI smoke test in a temp dir (build first)
```

See [docs/release-checklist.md](docs/release-checklist.md) before cutting a release, and [CHANGELOG.md](CHANGELOG.md) for the release notes.

### Project layout

```
src/
  core/                  # deterministic, testable, no CLI/agent dependencies
    schema/              # Zod schemas (ScopeContract, config)
    scope/               # task-id, scope read/write, create-scope, override + diff
    scope-inference/     # deterministic classifier + rule packs + engine
    config/              # config schema, effective-config merge, loader
    git/                 # changed-files via git
    check/               # scope check logic
    policy/              # centralized path matching (picomatch)
    evidence/            # Evidence Package: schema, scope-hash, store, recorder
    risk/                # Risk Score: schema, engine, recommendations
    gate/                # Policy Gate: schema, engine
    ci/                  # CI workflow template, action, ci-summary
    fs/                  # project path resolution
  cli/                   # Commander entrypoint + command orchestration
    commands/            # init, start, show, check, install, evidence, report, risk, gate, ci, ci-summary, config, scope

docs/
  quickstart.md
  ci.md
  architecture.md
  product-vision.md
  v0-v6-roadmap.md
  release-checklist.md

examples/
  live-demo/             # reproducible deny / ask / allow walkthrough with reference outputs
  github-actions/        # copyable workflow + action examples
```

## License

MIT — see [LICENSE](LICENSE).
