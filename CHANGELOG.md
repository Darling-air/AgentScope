# Changelog

All notable changes to AgentScope are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 0.1.0 - Unreleased

First public release of AgentScope: task-scoped runtime governance for AI coding
agents. Everything runs locally and deterministically — no LLM judging, no
network calls, no file-content inspection.

### Added

- **Local Task Scope Contract** — a least-privilege, per-task declaration of
  allowed / blocked / high-risk paths and allowed commands.
- **Claude Code runtime enforcement** — a PreToolUse hook that returns
  `allow` / `ask` / `deny` before each `Read` / `Edit` / `Write` / `Bash`,
  plus an installer (`agentscope install claude-code`) and uninstaller.
- **Evidence Package** — every decision is appended to
  `.agentscope/evidence/latest.json` as governance metadata only
  (`agentscope evidence show` / `clear`, `agentscope report`).
- **Deterministic Risk Score** — an explainable 0–100 score with a per-factor
  breakdown and recommendations (`agentscope risk`).
- **Scope inference, config, override, and history** — deterministic V2 scope
  inference, project-local `.agentscope/config.yaml`
  (`agentscope config show` / `validate`), per-scope overrides
  (`agentscope scope explain` / `diff` / `apply` and `start` override flags),
  and multi-task scope history (`agentscope scope list` / `use`).
- **Local Policy Gate** — `agentscope gate` evaluates evidence + risk + config
  and exits `0` on pass/skipped, `1` on fail. Missing evidence fails by default;
  `--allow-missing-evidence` skips that case for early rollout.
- **CI workflow template** — `agentscope ci init github-actions` writes a
  GitHub Actions workflow that runs `agentscope gate`, plus
  `agentscope ci doctor` for readiness diagnostics.
- **Repo-local GitHub Action** — a composite `action.yml` that wraps
  `agentscope gate` and exposes `status` / `score` / `level` / `result-path`
  outputs (`--mode action`).
- **CI summary output** — `agentscope ci-summary` generates a human-readable
  Markdown summary (and optional JSON) from evidence + risk. It is display-only
  and never changes the gate exit code.

### Not included (planned for later milestones)

- SARIF output
- PR comments
- Marketplace Action publishing
- GitHub API integration
- Remote / team policy registry and cloud sync

[See the roadmap](docs/v0-v6-roadmap.md) for what comes next.
