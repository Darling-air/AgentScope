# AgentScope

**Least-privilege, task-scoped governance for AI coding agents.**

AgentScope turns a single natural-language coding task into an explicit, auditable **Task Scope Contract** — a declaration of which paths a session may touch, which are off-limits, which are high-risk, and which commands are allowed. It then checks your actual `git` changes against that contract.

> AgentScope = Least-privilege sessions for AI coding agents.

This repository is currently at **V0**: a local, deterministic prototype. There is no LLM call and no network access.

> V1 development is underway with an agent-agnostic policy engine foundation — the internal `PolicyEngine` (`ToolEvent` → `PolicyDecision`) that agent adapters build on.
>
> **V1.1** added a *dry-run* Claude Code hook translator: `agentscope hook claude-code pre-tool-use` reads a Claude Code `PreToolUse` payload from stdin and emits a hook response on stdout.
>
> **V1.2** adds the **Claude Code hook installer**: `agentscope install claude-code` registers the PreToolUse hook in your Claude Code settings so a live session is actually governed by the active scope. Still **not** implemented: Evidence Package, Risk Scoring, and the GitHub Action / PR Policy Gate.

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

## Governing Claude Code (V1.2)

`agentscope install claude-code` registers AgentScope's PreToolUse hook in your Claude Code settings. Once installed, Claude Code calls `agentscope hook claude-code pre-tool-use` before every `Read` / `Edit` / `Write` / `Bash` tool use, and AgentScope returns `allow` / `ask` / `deny` based on the active scope.

```bash
agentscope init
agentscope start "Fix login redirect bug"
agentscope install claude-code
claude
```

Now, if Claude tries to read `.env.local`, the hook returns `deny` (because `.env*` is a blocked path in the scope), and Claude Code blocks the read. Editing `package.json` returns `ask` (high-risk), editing `src/auth/login.ts` returns `allow`, and `rm -rf node_modules` returns `deny` (dangerous command).

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

## Files AgentScope writes

```
.agentscope/
  config.yaml            # project defaults (created by `init`)
  current-scope.yaml     # the active Task Scope Contract
  scopes/
    <task-id>.yaml       # a per-task snapshot of each approved scope
  evidence/              # reserved for V1+ (currently unused)
```

AgentScope never reads the *contents* of your source or secret files — it only matches file **paths** against glob patterns.

## Not supported yet

These are planned for later milestones:

- ✅ Claude Code PreToolUse hook + installer — *done in V1.0–V1.2*
- Evidence Package (full schema + hashes) — *V1.3 / V3*
- Risk Scoring (`agentscope risk`) — *V1.3*
- GitHub Action / Policy Gate in CI — *V3*
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
    fs/                  # project path resolution
  cli/                   # Commander entrypoint + command orchestration
    commands/            # init, start, show, check

docs/
  product-vision.md
  v0-v6-roadmap.md
  architecture.md
```

## License

MIT
