# AgentScope 开发上下文

当前阶段：**V3.4 Release Hardening / Demo Polish**

AgentScope 的产品定位：

> Task-scoped runtime governance for AI coding agents.
> AgentScope turns an AI coding task into a least-privilege scope, enforces it at runtime, records evidence, computes deterministic risk, and gates the result locally or in CI.

AgentScope 不是 repo context packer，不是 CLAUDE.md 生成器，不是 MCP scanner，也不是 AI PR reviewer。

核心闭环：

```txt
Task
→ Scope Auto Inference
→ Human Approval / Override
→ Runtime Enforcement
→ Evidence Package
→ Risk Scoring
→ Policy Gate
→ CI Enforcement
→ CI Summary Output
```

当前已经完成：

```txt
V0   ✅ Local Task Scope Contract prototype
V1.0 ✅ Core Policy Engine
V1.1 ✅ Claude Code Hook Translator + Hook Entrypoint
V1.2 ✅ Claude Code Hook Installer + Live Runtime Enforcement
V1.3 ✅ Evidence Event Recorder
V1.4 ✅ Deterministic Risk Score V1
V1.5 ✅ GitHub-ready Demo Polish
V2.0 ✅ Scope Inference V2
V2.1 ✅ Project-local Policy Config
V2.2 ✅ Scope Review / Override UX
V2.3 ✅ Multi-task Scope History
V3.0 ✅ Policy Gate CLI
V3.1 ✅ CI Workflow Template
V3.2 ✅ Reusable GitHub Action
V3.3 ✅ CI Summary Output
```

当前真实能力：

```txt
✅ agentscope init
✅ agentscope config show / show --json / validate
✅ agentscope start "<task>"
✅ agentscope start "<task>" --dry-run / --json
✅ agentscope show
✅ agentscope check
✅ agentscope scope explain / diff / apply / list / use
✅ agentscope hook claude-code pre-tool-use
✅ agentscope install claude-code
✅ agentscope uninstall claude-code
✅ agentscope evidence show / clear
✅ agentscope risk / risk --json
✅ agentscope report
✅ agentscope gate / gate --json / gate --allow-missing-evidence
✅ agentscope ci init github-actions
✅ agentscope ci doctor
✅ agentscope ci-summary / ci-summary --json / ci-summary --output
✅ repo-local GitHub Action via action.yml
```

不要回退 V1.0-V3.3。
不要重写 PolicyEngine、Claude Code adapter、Evidence schema、Risk engine、Scope Inference V2、Effective Config、Scope Override、Scope History、Gate Engine、CI template、Action wrapper 或 CI Summary。

V3.4 只聚焦 **release hardening、demo polish、documentation、packaging readiness、smoke testing**。

不要实现新治理能力。
不要实现 SARIF。
不要实现 PR comment。
不要实现 Marketplace 发布。
不要实现 remote/team policy。
不要实现云端功能。

---

# V3.4 目标

V3.4 只做一件事：

> 把 AgentScope 打磨到可以公开发布、展示、录屏、拿 GitHub star 的 v0.1.0 release candidate 状态。

这一阶段不是功能扩张，而是：

```txt
make the project easy to understand
make the demo easy to reproduce
make the package safe to publish
make the CLI help consistent
make the docs trustworthy
```

---

# V3.4 核心原则

```txt
No new governance model.
No behavior-changing rewrite.
No schema churn unless strictly necessary.
No breaking CLI changes.
No speculative enterprise/cloud features.
Release polish over feature growth.
```

允许做：

```txt
✅ README polish
✅ docs polish
✅ examples polish
✅ package metadata polish
✅ CLI help polish
✅ release checklist
✅ changelog
✅ smoke test script
✅ demo fixture cleanup
✅ action/workflow docs cleanup
```

不允许做：

```txt
❌ new runtime policy semantics
❌ new risk scoring rules
❌ new evidence schema
❌ new gate rules
❌ SARIF
❌ PR comment
❌ Marketplace release
❌ npm publish
❌ cloud/team registry
❌ file content inspection
❌ command output capture
```

---

# V3.4 应实现的能力

## 1. README Hero Demo 更新到 V3.3 能力

README 首页应清楚展示完整价值链：

```txt
Task: Fix login redirect bug

Scope:
  allow src/auth/**
  block .env*
  ask on package.json

Claude Code:
  Read .env.local          → DENY
  Write package.json       → ASK
  Edit src/auth/login.ts   → ALLOW

AgentScope:
  evidence/latest.json
  risk score: 55 / 100
  gate: FAIL
  ci summary: .agentscope/ci/summary.md
```

README 顶部应突出：

```txt
Task-scoped runtime governance for AI coding agents.
```

README 应快速说明：

```txt
1. What AgentScope is
2. Why task-scoped governance matters
3. Quickstart
4. Claude Code integration
5. Evidence / Risk / Gate
6. CI / GitHub Actions
7. Local-first / deterministic / no LLM judging
8. Current status and limitations
```

避免过度营销，不要写尚未实现的能力。

---

## 2. Quickstart 独立文档

新增或整理：

```txt
docs/quickstart.md
```

内容应可复制执行，覆盖：

```bash
pnpm install
pnpm build
pnpm link --global

agentscope init
agentscope start "Fix login redirect bug"
agentscope install claude-code
claude

agentscope evidence show
agentscope risk
agentscope gate
agentscope ci-summary
```

Windows 注意事项：

```txt
pnpm global bin / PATH
```

缺 evidence、gate fail、allow-missing-evidence 的区别要解释清楚。

---

## 3. Demo 文档和示例整理

更新或新增：

```txt
examples/live-demo/README.md
examples/live-demo/demo-script.md
examples/live-demo/expected-evidence.json
examples/live-demo/expected-risk-report.txt
examples/live-demo/expected-gate-result.json
examples/live-demo/expected-ci-summary.md
```

要求：

```txt
- 不包含真实 secret。
- 不包含用户本地路径。
- session_id / transcript_path / timestamp 使用 placeholder。
- risk score / gate result / summary 与当前规则一致。
- demo 能体现 deny / ask / allow 三类结果。
```

Demo script 应适合录屏：

```txt
1. init
2. start task
3. install claude-code
4. trigger .env.local deny
5. trigger package.json ask
6. trigger src/auth/login.ts allow
7. show evidence
8. show risk
9. show gate
10. show ci summary
```

---

## 4. Package metadata / npm readiness 检查

检查并修正：

```txt
package.json:
  name
  version
  description
  type
  bin
  files
  keywords
  license
  repository
  homepage
  bugs
  engines
  scripts
```

要求：

```txt
- version 保持 0.1.0，除非项目已有不同计划。
- bin 指向 dist/index.js。
- files 只包含发布需要的内容。
- 不包含本地测试产物、临时文件、.agentscope/evidence 实例、真实 secrets。
- package metadata 应适合 npm publish，但 V3.4 不执行 npm publish。
```

建议增加或检查：

```txt
.npmignore 或 package.json files
```

如果已有 `files` 字段，优先使用 `files` 字段控制发布内容。

---

## 5. CLI help 全面 polish

检查所有命令 help 文案是否一致：

```txt
agentscope --help
agentscope start --help
agentscope scope --help
agentscope config --help
agentscope evidence --help
agentscope risk --help
agentscope report --help
agentscope gate --help
agentscope ci --help
agentscope ci-summary --help
```

要求：

```txt
- 不再出现 prototype / dry-run-only 等过期描述。
- 不承诺未实现能力。
- gate / report / risk 的区别清楚。
- ci init / action / summary 的关系清楚。
```

---

## 6. Release docs

新增：

```txt
CHANGELOG.md
docs/release-checklist.md
```

`CHANGELOG.md` 添加：

```txt
## 0.1.0 - Unreleased

- Local task scope contract
- Claude Code runtime enforcement
- Evidence package
- Deterministic risk score
- Scope inference/config/override/history
- Local policy gate
- CI workflow template
- Repo-local GitHub Action
- CI summary output
```

`docs/release-checklist.md` 应包含：

```txt
1. Clean git status
2. pnpm install
3. pnpm build
4. pnpm typecheck
5. pnpm lint
6. pnpm test
7. CLI smoke test
8. package contents check
9. README demo check
10. tag/release instructions
```

不要执行发布，不要创建 git tag。

---

## 7. Smoke test script

新增：

```txt
scripts/smoke-test.mjs
```

目标：

```txt
在临时 repo 中验证核心 CLI 链路，不依赖 Claude Code live session。
```

Smoke test 应覆盖：

```txt
agentscope init
agentscope start "Fix login redirect bug" --dry-run
agentscope config validate
agentscope ci doctor
agentscope gate --allow-missing-evidence
agentscope ci-summary --output .agentscope/ci/summary.md
```

如果可行，也可创建 fixture evidence 后验证：

```txt
agentscope risk
agentscope gate
agentscope ci-summary
```

要求：

```txt
- 不访问网络。
- 不依赖真实 Claude Code。
- 不修改用户当前 repo。
- 使用临时目录。
- 成功 exit 0，失败 exit 1。
```

在 `package.json` 添加：

```json
"smoke": "node scripts/smoke-test.mjs"
```

---

## 8. Docs consistency pass

检查并更新：

```txt
docs/architecture.md
docs/product-vision.md
docs/v0-v6-roadmap.md
docs/ci.md
docs/quickstart.md
README.md
examples/github-actions/README.md
```

确保术语一致：

```txt
Task Scope Contract
Evidence Package
Risk Score
Policy Gate
CI Summary
Claude Code hook
repo-local reusable action
```

确保未实现的能力标为 planned，而不是 done。

---

# V3.4 不做什么

不要实现：

```txt
❌ SARIF
❌ PR comment
❌ Marketplace Action publishing
❌ GitHub API integration
❌ JUnit output
❌ artifact upload as required behavior
❌ remote/team policy registry
❌ cloud sync
❌ Web UI
❌ branch protection integration
❌ MCP-specific CI gate
❌ LLM-based policy judging
❌ secret scanning
❌ file content inspection
❌ command output capture
```

不要改变：

```txt
❌ agentscope gate semantics
❌ GateResultV1 schema
❌ RiskScoreV1 schema
❌ Evidence schema
❌ PolicyEngine runtime decisions
❌ Claude Code hook response mapping
❌ Scope inference semantics
❌ Effective config schema
❌ Scope override behavior
❌ Scope history behavior
```

---

# 测试要求

至少覆盖：

## Smoke test

```txt
scripts/smoke-test.mjs exists
pnpm smoke runs successfully
smoke test uses temp directory
smoke test does not require Claude Code
smoke test does not require network
```

## Docs / package sanity

```txt
README mentions gate and CI summary
README does not claim SARIF / PR comment / Marketplace as implemented
CHANGELOG.md exists
docs/release-checklist.md exists
docs/quickstart.md exists
package.json bin/files metadata are sane
CLI help does not contain stale prototype wording
```

## Regression

```txt
agentscope gate behavior unchanged
risk/report/evidence behavior unchanged
hook deny/ask/allow unchanged
scope history commands unchanged
ci init / ci doctor unchanged
ci-summary unchanged
config commands still work
```

继续保持：

```bash
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm smoke
```

全部通过。

---

# 验收标准

V3.4 通过条件：

```txt
1. README 讲清楚完整 AgentScope demo。
2. docs/quickstart.md 可复制执行。
3. examples/live-demo 覆盖 evidence/risk/gate/ci-summary。
4. package metadata 适合 v0.1.0 发布准备。
5. CLI help 没有过期描述。
6. CHANGELOG.md 和 docs/release-checklist.md 存在。
7. scripts/smoke-test.mjs 存在且 pnpm smoke 通过。
8. docs 不声称未实现的能力。
9. 没有改变 gate/risk/evidence/hook/scope 行为。
10. build/typecheck/lint/test/smoke 全绿。
```

---

# 开发原则

V3.4 的目标是：

```txt
make AgentScope understandable, reproducible, and release-ready
```

这不是功能阶段。
这是发布前打磨阶段。
优先清晰、稳定、可信。
