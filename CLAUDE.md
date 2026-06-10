# AgentScope 开发上下文

当前阶段：**V1.4 Risk Score V1**

AgentScope 的产品定位是：

> AI Coding Session 的 Task-Scoped Governance Layer
> 用 Task Scope Contract 对 AI coding agent 的工具调用进行最小权限治理、运行时拦截、审计证据记录和风险评估。

AgentScope 不是 repo context packer，不是 CLAUDE.md 生成器，不是 MCP scanner，也不是 AI PR reviewer。

核心闭环是：

```txt
Task
→ Scope Auto Inference
→ Human Approval
→ Runtime Enforcement
→ Evidence Package
→ Risk Scoring
→ Policy Gate
```

当前已经完成：

```txt
V0   本地 Task Scope Contract 原型
V1.0 Core Policy Engine
V1.1 Claude Code Hook Translator + Dry-run Entrypoint
V1.2 Claude Code Hook Installer + Live Runtime Enforcement
V1.3 Evidence Event Recorder
```

V1.3 已验证：

```txt
✅ .agentscope/evidence/latest.json 会被创建
✅ EvidencePackageV1 会记录 task、scope、scope_hash
✅ EvidenceEvent 会记录 ToolEvent + PolicyDecision
✅ policy_interventions 只记录 deny / ask / warn
✅ session_id / transcript_path 会被捕获
✅ Read .env.local → deny evidence event
✅ Write package.json → ask evidence event
✅ Write src/auth/login.ts → allow evidence event
✅ agentscope evidence show 可用
✅ agentscope evidence clear 可用
✅ agentscope report 可用
✅ evidence 不记录文件内容、命令输出、Claude 回复正文
✅ pnpm build / typecheck / lint / test 已通过
```

不要回退 V1.0-V1.3。不要重写 PolicyEngine、Claude Code installer、path normalization 或 Evidence schema，除非 V1.4 需要最小兼容改动。

---

# V1.4 目标

V1.4 只做一件事：

> 基于 `.agentscope/evidence/latest.json` 计算 deterministic risk score，并通过 CLI 展示。

V1.4 的核心输入是 V1.3 Evidence Package。
V1.4 的输出是 Risk Score Report。

---

# V1.4 关键原则

```txt
Evidence first, score second.
Risk scoring reads evidence.
Risk scoring does not decide runtime permissions.
Risk scoring does not block commands.
Risk scoring does not fail CI.
```

V1.4 不改变 Claude Code hook 的 allow / deny / ask 行为。
V1.4 不改变 PolicyEngine 语义。
V1.4 不实现 Policy Gate。

Policy Gate 是后续版本。
V1.4 只是可解释、确定性的风险评分。

---

# V1.4 应实现的能力

## 1. Risk Score 数据结构

新增 RiskScoreV1：

```ts
type RiskLevel = "low" | "medium" | "high" | "critical"

type RiskFactor = {
  id: string
  label: string
  severity: "info" | "low" | "medium" | "high" | "critical"
  points: number
  event_id?: string
  tool_name?: string
  action?: string
  target?: string
  matched_rule?: string
}

type RiskScoreV1 = {
  version: "0.1"
  score: number
  level: RiskLevel
  summary: string
  task: {
    id: string
    title: string
  }
  scope_hash: string
  counts: {
    total_events: number
    allow: number
    deny: number
    ask: number
    warn: number
    policy_interventions: number
  }
  factors: RiskFactor[]
  recommendations: string[]
  evidence: {
    path?: string
    created_at: string
    updated_at: string
  }
}
```

Score 范围：

```txt
0-100
```

Risk level：

```txt
0-24    low
25-49   medium
50-74   high
75-100  critical
```

---

## 2. Deterministic Risk Engine

实现纯函数：

```ts
calculateRiskScore(evidence: EvidencePackageV1, options?: { evidencePath?: string }): RiskScoreV1
```

要求：

```txt
同一个 evidence 输入必须得到同一个 risk output。
不得调用 LLM。
不得访问网络。
不得读取文件内容。
不得依赖当前时间。
```

Risk score 可以基于以下信号：

```txt
deny events
ask events
warn events
policy_decision.risk_delta
matched_rule
tool_event.action
tool_event.target
tool_event.tool_name
是否命中 blocked_paths
是否命中 high_risk
是否涉及 dangerous command
policy_interventions 数量
```

推荐 V1 scoring 规则：

```txt
每个 deny：
  使用 max(policy_decision.risk_delta, 15)
  如果 matched_rule 以 dangerous_commands 开头，至少 40 分
  如果 matched_rule 以 blocked_paths 开头，至少 20 分

每个 ask：
  使用 max(policy_decision.risk_delta, 8)
  如果 matched_rule 以 high_risk 开头，至少 25 分
  如果 action 是 write/edit 且没有 matched_rule，至少 15 分

每个 warn：
  使用 max(policy_decision.risk_delta, 5)

每个 allow：
  默认 0 分
  如果 policy_decision.risk_delta 为正，可以计入该正分
  如果 risk_delta 为负，不要让总分低于 0
```

Session-level factors：

```txt
policy_interventions >= 3 → +10
deny >= 2 → +10
同时存在 blocked_paths 和 high_risk intervention → +10
dangerous command 出现过 → +15
```

总分最后 clamp 到：

```txt
0 <= score <= 100
```

这只是 V1 规则，必须保持简单、可解释、可测试。

---

## 3. Risk Factors

每个非零分来源都应该产生 RiskFactor。

示例：

```json
{
  "id": "blocked_path_denied",
  "label": "Blocked path access was denied",
  "severity": "high",
  "points": 20,
  "event_id": "...",
  "tool_name": "Read",
  "action": "read",
  "target": ".env.local",
  "matched_rule": "blocked_paths:.env*"
}
```

Risk factor 的目标是解释：

```txt
为什么这个 session 有这个风险分？
哪些 action 贡献了分数？
```

不要只输出一个裸分数。

---

## 4. Recommendations

根据 factors 生成 deterministic recommendations。

示例：

```txt
如果有 blocked_paths deny：
  "Review why the agent attempted to access blocked paths."

如果有 high_risk ask：
  "Manually review high-risk file changes before merging."

如果有 dangerous command：
  "Investigate denied dangerous shell commands."

如果风险为 low：
  "No major policy concerns detected in this session."
```

Recommendations 不要调用 LLM。
不要生成过度夸张的安全结论。

---

## 5. CLI

新增命令：

```bash
agentscope risk
agentscope risk --json
```

行为：

```txt
读取 .agentscope/evidence/latest.json
计算 RiskScoreV1
输出 human-readable risk report
```

Human-readable 输出至少包括：

```txt
Risk score
Risk level
Task
Scope hash
Event counts
Top risk factors
Recommendations
Evidence path
```

`--json` 输出完整 RiskScoreV1 JSON。

如果 evidence 不存在，友好提示，不要 crash。

---

## 6. 更新 agentscope report

V1.3 的 `agentscope report` 之前明确说 Risk Scoring 未实现。
V1.4 后需要更新：

```txt
agentscope report
```

应包含 risk score summary：

```txt
Risk score: 45 / 100
Risk level: medium
```

但 `agentscope report` 仍然不是 Policy Gate。
不要让 report 因高风险返回非零 exit code。
不要实现 threshold。
不要实现 CI fail。

---

# V1.4 不做什么

不要实现：

```txt
❌ Policy Gate
❌ GitHub Action
❌ CI failure
❌ risk threshold enforcement
❌ agentscope gate
❌ SARIF
❌ signed evidence
❌ transcript hash
❌ diff hash
❌ MCP-specific risk model
❌ cloud sync
❌ Web UI
❌ LLM-based risk judging
❌ secret scanning
❌ file content inspection
❌ command output capture
```

Policy Gate 是后续版本。
V1.4 只计算和展示风险。

---

# 代码组织建议

优先新增：

```txt
src/core/risk/risk-score.ts
src/core/risk/risk-engine.ts
src/core/risk/risk-recommendations.ts
src/core/risk/index.ts
```

CLI 新增：

```txt
src/cli/commands/risk.ts
```

可复用 V1.3：

```txt
src/core/evidence/evidence-summary.ts
src/core/evidence/evidence-store.ts
src/core/evidence/evidence-package.ts
```

并更新：

```txt
src/core/index.ts
src/cli/index.ts
src/cli/commands/report.ts
README.md
docs/v0-v6-roadmap.md
```

---

# 测试要求

至少覆盖：

```txt
RiskScore schema parse
Risk level boundary:
  0-24 low
  25-49 medium
  50-74 high
  75-100 critical

Empty / no-risk evidence → low score
Read .env.local deny → produces blocked path factor
Write package.json ask → produces high-risk factor
Dangerous command deny → produces critical/high factor
Multiple interventions add session-level factor
Score clamps to 100
Allow events do not create risk unless positive risk_delta
Negative risk_delta never makes total score below 0
Recommendations generated deterministically
agentscope risk works
agentscope risk --json works
agentscope risk handles missing evidence
agentscope report includes risk score
agentscope report does not implement policy gate behavior
```

继续保持：

```txt
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

全部通过。

---

# 验收标准

V1.4 通过条件：

```txt
1. agentscope risk 可以读取 latest evidence 并输出 score。
2. agentscope risk --json 输出 RiskScoreV1。
3. Read .env.local deny 会贡献风险因子。
4. Write package.json ask 会贡献风险因子。
5. Write src/auth/login.ts allow 默认不增加风险。
6. agentscope report 显示 risk score 和 risk level。
7. V1.4 没有改变 hook allow / deny / ask 行为。
8. V1.4 没有实现 Policy Gate。
9. V1.4 没有 CI threshold / failure behavior。
10. build/typecheck/lint/test 全绿。
```

---

# 开发原则

保持实现简单、确定、可解释。
Risk score 必须能从 evidence 逐项解释。
不要追求复杂安全模型。
V1.4 是为后续 Policy Gate 提供基础，不是最终安全产品。
