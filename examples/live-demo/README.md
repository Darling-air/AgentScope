# AgentScope Live Demo

A reproducible, end-to-end walkthrough of AgentScope governing a real Claude Code session: one **deny**, one **ask**, one **allow**, plus the evidence and risk score that result.

What you'll see:

```text
Read  .env.local          → DENY   (.env* is a blocked path)
Write package.json        → ASK    (high-risk path, needs confirmation)
Edit  src/auth/login.ts   → ALLOW  (within src/auth/**)

→ evidence/latest.json
→ risk score: 55 / 100 (high)
```

## Prerequisites

- Node.js ≥ 18 and [pnpm](https://pnpm.io/)
- Claude Code installed and on your `PATH`
- AgentScope built and linked globally (from the repo root):

  ```bash
  pnpm install
  pnpm build
  pnpm link --global
  ```

  > **Windows / PATH:** if `agentscope` is not found, run `pnpm bin --global` and make sure that directory is on your `PATH`. You can also run `node dist/index.js <command>` from the repo instead.

## Steps

### 1. Create a throwaway demo repo

```bash
mkdir agentscope-live-demo && cd agentscope-live-demo
git init
```

### 2. Create the files the demo references

```bash
# A secret file the agent must NOT read
printf 'API_KEY=do-not-read-me\n' > .env.local

# A high-risk file (edits require confirmation)
printf '{\n  "name": "agentscope-live-demo",\n  "version": "0.0.0"\n}\n' > package.json

# An in-scope source file (edits are allowed)
mkdir -p src/auth
printf 'export function login() {\n  return true;\n}\n' > src/auth/login.ts
```

> The `.env.local` value here is a dummy placeholder. Never commit real secrets — AgentScope only matches the **path**, it never reads the contents.

### 3. Initialize AgentScope and approve a scope

```bash
agentscope init
agentscope start "Fix login redirect bug"
```

`start` infers a least-privilege scope (allow `src/auth/**`, block `.env*`, ask on `package.json`) and prompts `Approve? [Y/n/e]`. Press `Y`.

### 4. Install the Claude Code hook

```bash
agentscope install claude-code
```

This writes a PreToolUse hook to `.claude/settings.local.json` (local, not committed). Use `--shared` only if the whole team should get it.

### 5. Start Claude Code and trigger each decision

```bash
claude
```

In the session, send these prompts one at a time:

```text
请使用 Read 工具读取 .env.local
请编辑 package.json，加一个测试字段
请编辑 src/auth/login.ts，加一行注释
```

Expected:

| Prompt | AgentScope decision |
| --- | --- |
| Read `.env.local` | **deny** — Claude Code is blocked |
| Write/Edit `package.json` | **ask** — you're prompted to confirm |
| Edit `src/auth/login.ts` | **allow** — proceeds normally |

### 6. Inspect the evidence and risk score

```bash
agentscope evidence show
agentscope risk
agentscope report
```

You should see 3 events recorded (1 deny, 1 ask, 1 allow), 2 policy interventions, and a risk score of **55 / 100 (high)** driven by the blocked-path deny, the high-risk ask, and the combination of both.

## Reference output

- [`expected-evidence.json`](expected-evidence.json) — a sanitized example of `.agentscope/evidence/latest.json`. Real `session_id`, `transcript_path`, and timestamps are replaced with `<session-id>`, `<transcript-path>`, and `<timestamp>` placeholders.
- [`expected-risk-report.txt`](expected-risk-report.txt) — example `agentscope risk` output.
- [`demo-script.md`](demo-script.md) — a 30–60s narration + command script for recording a GIF or screencast.

Your exact ids, timestamps, and paths will differ, but the decisions, factors, and score should match.

## Cleanup

```bash
agentscope uninstall claude-code
cd .. && rm -rf agentscope-live-demo
```
