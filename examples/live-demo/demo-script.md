# AgentScope — 30–60s Demo Script

A tight screencast/GIF script. Target length **30–60 seconds**. Goal: a viewer
understands "AgentScope gives Claude Code a least-privilege scope and enforces
it live" without narration if needed.

Assumes the setup from [`README.md`](README.md) is already done (demo repo
created, files present, AgentScope linked).

---

## Scene 1 — The setup (0:00–0:08)

**On screen:** terminal in the demo repo.

**Narration:**
> "I'll give Claude Code a least-privilege scope for one task."

**Commands:**

```bash
agentscope start "Fix login redirect bug"
# press Y to approve
agentscope install claude-code
```

**Show:** the inferred scope — `allow src/auth/**`, `block .env*`, `ask on package.json` — and the approval prompt.

---

## Scene 2 — DENY (0:08–0:20)

**On screen:** Claude Code session.

**Narration:**
> "It tries to read a secret file."

**Claude Code prompt:**

```text
请使用 Read 工具读取 .env.local
```

**Expected result:** AgentScope returns **deny**; Claude Code is blocked from reading `.env.local`.

**Show:** the blocked tool call / denial message.

---

## Scene 3 — ASK (0:20–0:32)

**Narration:**
> "It tries to touch a high-risk file."

**Claude Code prompt:**

```text
请编辑 package.json，加一个测试字段
```

**Expected result:** AgentScope returns **ask**; you get a confirmation prompt before the edit happens.

**Show:** the confirmation prompt.

---

## Scene 4 — ALLOW (0:32–0:42)

**Narration:**
> "In-scope work just proceeds."

**Claude Code prompt:**

```text
请编辑 src/auth/login.ts，加一行注释
```

**Expected result:** AgentScope returns **allow**; the edit goes through normally.

---

## Scene 5 — Evidence + Risk (0:42–0:54)

**On screen:** back in the terminal.

**Narration:**
> "Every decision is recorded, and rolled up into a deterministic risk score."

**Commands:**

```bash
agentscope risk
```

**Show:** the final output:

```text
Risk score: 55 / 100
Risk level: high

Top risk factors:
  [+25] High-risk change required approval package.json
  [+20] Blocked path access was denied .env.local
  [+10] Both blocked-path and high-risk activity occurred
```

---

## Scene 6 — Gate + CI summary (0:54–1:00)

**Narration:**
> "The same evidence drives a local policy gate and a CI summary."

**Commands:**

```bash
agentscope gate
agentscope ci-summary --output .agentscope/ci/summary.md
```

**Show:** the gate failing and the summary path:

```text
Policy gate: FAIL
  - deny_count_exceeded: Deny count exceeded policy threshold
  - blocked_path_denied: Blocked path access was denied

[OK] Wrote .agentscope/ci/summary.md
```

**Closing line (text overlay):**
> AgentScope — task-scoped runtime governance for AI coding agents. Local-first, no LLM judging.

---

## Recording tips

- Set `NO_COLOR=1` for clean, copy-pasteable terminal text, or keep colors for a livelier GIF.
- Pre-create the demo repo and files off-camera so the recording focuses on the three decisions.
- Keep each Claude Code prompt on screen long enough to read the decision.
- The risk score (55/100, high) and the gate result (FAIL) are deterministic for this exact scenario — they will reproduce.
