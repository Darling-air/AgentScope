# AgentScope

**Least-privilege, task-scoped governance for AI coding agents.**

AgentScope turns a single natural-language coding task into an explicit, auditable **Task Scope Contract** — a declaration of which paths a session may touch, which are off-limits, which are high-risk, and which commands are allowed. It then checks your actual `git` changes against that contract.

> AgentScope = Least-privilege sessions for AI coding agents.

This repository started as a local, deterministic prototype (**V0**) and has grown an agent-agnostic policy engine plus live Claude Code enforcement. There is still no LLM call and no network access.

> The agent-agnostic foundation is the internal `PolicyEngine` (`ToolEvent` → `PolicyDecision`) that agent adapters build on.
>
> **V1.1** added a *dry-run* Claude Code hook translator: `agentscope hook claude-code pre-tool-use` reads a Claude Code `PreToolUse` payload from stdin and emits a hook response on stdout.
>
> **V1.2 — done.** The **Claude Code hook installer** is complete: `agentscope install claude-code` registers the PreToolUse hook in your Claude Code settings, so a live Claude Code session is now governed by the active scope in real time. `Read` / `Edit` / `Write` / `Bash` are enforced at runtime against the Task Scope Contract.
>
> **V1.3 — done.** The **Evidence Event Recorder** is complete: every live policy decision is appended to a local audit artifact at `.agentscope/evidence/latest.json`, and `agentscope evidence show` / `agentscope report` summarize it.
>
> **V1.4 — done.** **Risk Score V1** is complete: `agentscope risk` reads the Evidence Package and computes a deterministic, explainable 0–100 risk score with per-factor breakdown and recommendations, and `agentscope report` now includes that score. This is a read-only summary — it is **not** a policy gate, sets no failing exit code, and never changes hook enforcement. Still **not** implemented: the GitHub Action / PR Policy Gate (V3).

## What V0 can do

- `agentscope init` — scaffold `.agentscope/` with a default config
- `agentscope start "<task>"` — infer a Task Scope Contract from the task, show it, and ask for approval
- `agentscope show` — display the current scope contract
- `agentscope check` — compare current `git` changes against the scope and report OK / warnings / violations

The core idea V0 proves:

```
Natural-language task
  → Task Scope Contract
  → human approval
  → .agentscope/current-scope.yaml
  → git diff scope check
```

Scope inference in V0 is intentionally simple and **deterministic**:

- Task title → kebab-case task id
- Keyword matching for likely paths:
  - `login` / `redirect` / `session` / `auth` → `src/auth/**`, `tests/auth/**`
  - `component` / `ui` / `button` / `navbar` → `src/components/**`, `tests/components/**`
  - `ci` / `workflow` / `github` / `action` → `.github/**` moved out of *blocked* into *allowed + high-risk*
  - `migration` / `database` / `schema` → `migrations/**` moved out of *blocked* into *allowed + high-risk*
- No keyword match → fall back to the config's default allowed paths
- Confidence: `0.80` (multiple keyword hits), `0.72` (one), `0.55` (defaults only)

## Install

Requires Node.js ≥ 18 and [pnpm](https://pnpm.io/).

```bash
pnpm install
pnpm build
```

This produces a runnable CLI at `dist/index.js`. To run it during development:

```bash
node dist/index.js <command>
# or, via the package script:
pnpm agentscope <command>
```

You can also link it globally:

```bash
pnpm link --global
agentscope --help
```

## Usage / V0 demo flow

Run these from the root of a project that is a **git repository**:

```bash
# 1. Set up AgentScope in the project
agentscope init

# 2. Generate and approve a scope for your task
agentscope start "Fix login redirect bug"
#   → shows the inferred contract
#   → Approve? [Y/n/e]
#       Y / Enter  approve and write the scope
#       n          abort, write nothing
#       e          write the scope, then edit .agentscope/current-scope.yaml by hand

# 3. Review the active scope at any time
agentscope show

# 4. Make some changes, then check them against the scope
agentscope check
```

Example `agentscope check` output:

```
AgentScope Check

Task: Fix login redirect bug

Changed files:
✅ src/auth/login.ts
   within allowed paths: src/auth/**
✅ tests/auth/login.test.ts
   within allowed paths: tests/auth/**
⚠ package.json
   high risk path: package.json
❌ .github/workflows/deploy.yml
   blocked path: .github/**

Summary:
  ✅ OK:         2
  ⚠ Warnings:   1
  ❌ Violations: 1

Result:
FAILED
```

Exit codes (designed so this can later gate CI):

- **violation present** → exit code `1`
- **only warnings** → exit code `0`
- **all OK / no changes** → exit code `0`

## Dry-run Claude Code hook (V1.1, experimental)

You can preview how the policy engine would respond to a Claude Code tool call without installing anything. The command reads a `PreToolUse` payload from stdin and prints a Claude Code hook response:

```bash
echo '{"hook_event_name":"PreToolUse","tool_name":"Read","tool_input":{"file_path":".env.local"}}' \
  | agentscope hook claude-code pre-tool-use
```

```json
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Blocked by AgentScope: .env.local matches blocked path .env*"}}
```

It reads the active `.agentscope/current-scope.yaml` and `config.yaml` from the current project. If there is no active scope, the payload is invalid, or anything else goes wrong, it returns a safe `ask` response (and still exits `0`) so a misconfigured hook never crashes the agent or silently allows an action.

This is a **dry-run only**. To wire it into a live Claude Code session, install it (see below).

## Governing Claude Code (V1.2 — done)

**Status: complete.** The Claude Code PreToolUse hook now supports **live runtime enforcement**. `agentscope install claude-code` registers AgentScope's PreToolUse hook in your Claude Code settings. Once installed, Claude Code calls `agentscope hook claude-code pre-tool-use` before every `Read` / `Edit` / `Write` / `Bash` tool use, and AgentScope returns `allow` / `ask` / `deny` based on the active scope.

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
| `Read` `.env.local` | ❌ **deny** | `.env*` is a blocked path |
| `Edit` `package.json` | ⚠ **ask** | high-risk path — needs human confirmation |
| `Edit` `src/auth/login.ts` | ✅ **allow** | within `src/auth/**` allowed paths |

A `deny` blocks the tool use outright, and an `ask` pauses for the human to approve or reject — so the agent stays inside the Task Scope Contract for the whole session. (`Bash` commands like `rm -rf node_modules` are also `deny`'d as dangerous commands.)

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

Uninstall removes **only** the AgentScope hook, leaving your other hooks intact. It does not restore the backup file and does not delete the `.claude/` directory. If you want your exact original settings back, restore the `.agentscope-backup` file manually.

### A note on the hook command

The installed hook runs the bare command `agentscope hook claude-code pre-tool-use`, which requires the `agentscope` CLI to be on your `PATH`. Install it globally (`pnpm link --global` from this repo, or a published package once available) so Claude Code can invoke it. If `agentscope` is not on `PATH`, the hook will fail to run — adjust the command in your settings to an absolute path or a `pnpm`-prefixed invocation if needed.

## Evidence (V1.3 — done)

Every live policy decision is recorded to a local audit artifact so there is a verifiable trail of what the agent asked to do and what AgentScope decided. After a decision is made, the hook appends an **EvidenceEvent** to `.agentscope/evidence/latest.json`.

Recording is **best-effort**: if writing evidence fails for any reason, the hook still returns its normal `allow` / `ask` / `deny` response. Evidence never breaks enforcement, and the hook still emits only the response JSON on stdout. When there is no active scope (the safe-`ask` case), nothing is recorded because there is no task/scope snapshot to attach it to.

The evidence records **governance metadata only** — it never captures file contents, command output, or the agent's reply text.

```bash
agentscope evidence show          # human-readable summary of recorded decisions
agentscope evidence show --json   # the raw latest.json
agentscope evidence clear         # delete latest.json (safe no-op if absent)
agentscope report                 # V1.3 audit summary: counts, denied + asked actions
```

### What gets written

`.agentscope/evidence/latest.json` is an **EvidencePackage**:

```jsonc
{
  "version": "0.1",
  "task": { "id": "...", "title": "...", "raw_input": "..." },
  "scope": {
    "scope_hash": "sha256:...",        // stable hash of the governing scope
    "allowed_paths": [], "blocked_paths": [],
    "allowed_commands": [], "high_risk": []
  },
  "events": [                          // every allow / deny / ask / warn
    {
      "id": "...", "timestamp": "...",
      "agent": { "name": "claude-code", "session_id": "...", "transcript_path": "..." },
      "tool_event": { /* ToolEvent: tool_name, action, target/command */ },
      "policy_decision": { "decision": "deny", "reason": "...", "matched_rule": "..." }
    }
  ],
  "policy_interventions": [],          // projection of non-allow events only
  "created_at": "...", "updated_at": "..."
}
```

The `scope_hash` is a `sha256` over a canonical snapshot of the scope (task id/title + the four path/command arrays). Object key order does not change it; array order is preserved, since scope ordering can be meaningful. On each decision the recorder:

- creates a new package if `latest.json` does not exist,
- **appends** the event when the current scope's `scope_hash` matches, or
- **resets** the package (new `latest.json`) when the `scope_hash` differs — so events are never mixed across scopes.

Writes are atomic (temp file + rename) so an interrupted write never corrupts `latest.json`.

## Risk Score (V1.4 — done)

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

The total is clamped to `0–100`. Recommendations are derived deterministically from which factors fired (e.g. a `blocked_path_denied` factor yields "Review why the agent attempted to access blocked paths."). When nothing risky fired, the recommendation is "No major policy concerns detected in this session."

> **Not a policy gate.** `agentscope risk` and `agentscope report` are read-only summaries. They never set a failing exit code, apply no threshold, and do not fail CI. A CI Policy Gate is a later milestone (V3).

## Files AgentScope writes

```
.agentscope/
  config.yaml            # project defaults (created by `init`)
  current-scope.yaml     # the active Task Scope Contract
  scopes/
    <task-id>.yaml       # a per-task snapshot of each approved scope
  evidence/
    latest.json          # V1.3 Evidence Package (live policy decisions)
```

The risk score (V1.4) is computed on demand from `latest.json`; it is not persisted. AgentScope never reads the *contents* of your source or secret files — it only matches file **paths** against glob patterns, and evidence stores only governance metadata.

## Not supported yet

These are planned for later milestones and are **not implemented yet**:

- ✅ Claude Code PreToolUse hook + installer with live runtime enforcement — *done in V1.0–V1.2*
- ✅ Evidence Event Recorder (`evidence show` / `clear`, `report`) — *done in V1.3*
- ✅ Risk Score V1 (`agentscope risk`) — *done in V1.4*
- ❌ GitHub Action / Policy Gate in CI (threshold, exit codes) — *not yet, V3*
- ❌ Evidence hashes (diff/transcript), signed evidence — *not yet, V3*
- Team Policy Registry & templates — *V4*
- Multi-agent governance (Cursor / Codex / Gemini), MCP-specific handling — *V5*
- Web UI / dashboard, cloud services, LLM-based inference — later / out of scope

Note: `agentscope check` still inspects the resulting `git` diff after the fact. The V1.2 Claude Code hook adds *live* enforcement during a session, but the two are complementary — the diff check does not require any agent integration.

## Development

```bash
pnpm install      # install dependencies
pnpm build        # build the CLI to dist/
pnpm test         # run the Vitest suite
pnpm lint         # run ESLint
pnpm typecheck    # run tsc --noEmit
```

### Project layout

Core logic is kept separate from the CLI so that it stays agent-agnostic and reusable by future adapters:

```
src/
  core/                  # deterministic, testable, no CLI/agent dependencies
    schema/              # Zod schemas (ScopeContract, config)
    scope/               # task-id, scope inference, scope read/write
    config/              # default config + loader
    git/                 # changed-files via git
    check/               # scope check logic
    policy/              # centralized path matching (picomatch)
    evidence/            # V1.3 Evidence Package: schema, scope-hash, store, recorder
    risk/                # V1.4 Risk Score: schema, engine, recommendations
    fs/                  # project path resolution
  cli/                   # Commander entrypoint + command orchestration
    commands/            # init, start, show, check, install, evidence, report, risk

docs/
  product-vision.md
  v0-v6-roadmap.md
  architecture.md
```

## License

MIT
