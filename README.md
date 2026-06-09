# AgentScope

**Least-privilege, task-scoped governance for AI coding agents.**

AgentScope turns a single natural-language coding task into an explicit, auditable **Task Scope Contract** — a declaration of which paths a session may touch, which are off-limits, which are high-risk, and which commands are allowed. It then checks your actual `git` changes against that contract.

> AgentScope = Least-privilege sessions for AI coding agents.

This repository is currently at **V0**: a local, deterministic prototype. There is no LLM call, no network access, and no agent integration yet.

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

V0 deliberately does **not** include (these are planned for later milestones):

- Claude Code hooks / runtime enforcement — *V1*
- Claude Code adapter / `agentscope install` — *V1*
- Evidence Package (full schema + hashes) — *V1 / V3*
- Risk Scoring — *V1*
- GitHub Action / Policy Gate in CI — *V3*
- Team Policy Registry & templates — *V4*
- Multi-agent governance, MCP handling — *V5*
- Web UI / dashboard, cloud services, LLM-based inference — later / out of scope

In particular, **runtime enforcement (actually blocking an agent's action) is not part of V0.** V0 only checks the resulting `git` diff after the fact. Claude Code hook enforcement will arrive in V1.

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
