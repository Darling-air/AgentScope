# AgentScope Architecture

Current architecture note (v0.1.0):

- `agentscope risk` computes `RiskScoreV1` only.
- `agentscope report` remains a read-only audit summary and does not enforce thresholds.
- `agentscope gate` reads local evidence, computes risk, loads effective config gate policy, evaluates `GateResultV1`, and exits `0` on pass/skipped or `1` on fail.
- CI integration is implemented: a GitHub Actions workflow template, a repo-local reusable Action (`action.yml`), and a human-readable CI summary (`agentscope ci-summary`).
- SARIF, PR comments, Marketplace Action publishing, GitHub API calls, remote/team policy, cloud sync, and branch protection integration are **not implemented** (planned).

## 1. 架构目标

AgentScope 的架构必须支持以下长期目标：

1. Task Scope Contract 是核心抽�?
2. Core logic 必须与具�?agent 解�?
3. Claude Code 是第一�?adapter，但不是唯一目标
4. Policy Engine 必须是确定性的
5. Evidence Package 必须是机器可验证�?
6. Risk Scoring 必须可解释、可测试
7. CLI 只做编排，不承载核心业务逻辑
8. 默认本地运行，避免不必要 token 消�?
9. 后续可扩展到 GitHub Action、Team Policy Registry、多 agent、企业审�?

## 2. 当前真实架构（截�?V2.2�?

当前项目�?**single-package layout**（不�?monorepo），core �?cli 分离。下面是实际存在并已实现的模块：

```txt
src/
  core/                      # 确定性、可测试、无 CLI/agent 依赖
    schema/                  # Zod schema：ScopeContract、config（v1 + legacy 兼容�?
    scope/                   # task-id、scope 读写、create-scope（兼容包装）、override + diff 纯函�?
    scope-inference/         # V2.0 确定�?classifier + rule packs + inference engine
    config/                  # config schema、effective-config 合并、loader（effective config�?
    git/                     # 通过 git 获取 changed files
    check/                   # git diff scope check
    policy/                  # PolicyEngine + path/command matcher（ToolEvent �?PolicyDecision�?
    events/                  # ToolEvent schema
    evidence/                # Evidence Package：schema、scope-hash、store、recorder、summary
    risk/                    # Risk Score：schema、engine、recommendations
    fs/                      # 项目路径解析
    adapters/
      claude-code/           # PreToolUse payload/translator、hook entrypoint、settings installer、path normalizer
  cli/                       # Commander 入口 + 命令编排
    commands/                # init、start、show、check、hook、install、uninstall、evidence、report、risk、config、scope

docs/
  product-vision.md
  v0-v6-roadmap.md
  architecture.md

examples/
  live-demo/                 # 可复现的 deny / ask / allow 演示

.agentscope/                 # 运行时在用户项目中生�?
  config.yaml
  current-scope.yaml
  scopes/
  evidence/
    latest.json
```

实际运行链路（已实现）：

```txt
CLI
�?Scope inference (V0, 本地确定�?
�?ScopeContract (.agentscope/current-scope.yaml)
�?Human approval
�?Claude Code adapter (PreToolUse hook)
�?ToolEvent
�?PolicyEngine �?PolicyDecision (allow / deny / ask)
�?Evidence store (.agentscope/evidence/latest.json)
�?Risk engine (agentscope risk / report，按需读取 evidence)
```

**已实现：** Policy Gate（`agentscope gate`）、CI workflow template、repo-local GitHub Action、CI Summary（`agentscope ci-summary`）。

**尚未实现（planned）：** SARIF / PR comments、Marketplace Action publishing、diff_hash / transcript_hash / evidence_hash、Team Policy Registry、多 agent adapter、cloud sync。

## 2b. 长期目标模块（规划，未实现）

下面是长期可能演进到�?monorepo 结构，仅作方向参考，**当前并未采用**�?

packages/
  cli/
  core/
  scope-inference/
  policy-engine/
  evidence/
  risk/
  adapters/
    claude-code/
  github-action/
  shared/

docs/
  product-vision.md
  v0-v6-roadmap.md
  architecture.md

.agentscope/
  config.yaml
  current-scope.yaml
  scopes/
  evidence/
  policies/

## 3. 数据�?

完整数据流：

User Task
�?CLI
�?ScopeInferenceEngine
�?ScopeContract
�?Human Approval
�?Scope Storage
�?Agent Adapter
�?Tool Events
�?PolicyEngine
�?PolicyDecision
�?EvidenceRecorder
�?RiskScoringEngine
�?EvidencePackage
�?Report / Policy Gate

V0 数据流：

User Task
�?CLI
�?Basic Scope Inference
�?ScopeContract
�?Human Approval
�?current-scope.yaml
�?git diff
�?Scope Check Result

V1 数据流：

User Task
�?ScopeContract
�?Claude Code Adapter
�?PreToolUse Hook
�?ToolEvent
�?PolicyEngine
�?allow / deny / ask
�?EvidenceRecorder
�?RiskScoringEngine
�?evidence.json
�?report

## 4. 核心数据结构

### 4.1 ScopeContract

ScopeContract �?AgentScope 最核心的数据结构�?

TypeScript 概念�?

type ScopeContract = {
  version: string
  task: TaskInfo
  confidence: number
  allowed_paths: string[]
  blocked_paths: string[]
  allowed_commands: string[]
  high_risk: string[]
  required_commands?: string[]
  rationale?: string[]
  created_at: string
}

### 4.2 TaskInfo

type TaskInfo = {
  id: string
  title: string
  raw_input: string
}

task id 规则�?

- lowercase
- kebab-case
- 移除特殊字符
- 最�?64 字符

示例�?

"Fix login redirect bug"
�?fix-login-redirect

### 4.3 ToolEvent

ToolEvent 表示 agent 的一次操作�?

type ToolEvent = {
  id: string
  timestamp: string
  agent: string
  event_type: "tool_call" | "command" | "file_read" | "file_write" | "test" | "blocked_action"
  tool_source: "builtin" | "mcp" | "shell" | "custom"
  tool_name?: string
  action?: "read" | "write" | "edit" | "execute"
  target?: string
  command?: string
  metadata?: Record<string, unknown>
}

示例�?

{
  "agent": "claude-code",
  "event_type": "tool_call",
  "tool_source": "builtin",
  "tool_name": "Edit",
  "action": "write",
  "target": "src/auth/login.ts"
}

### 4.4 PolicyDecision

PolicyDecision 表示策略判断结果�?

type PolicyDecision = {
  decision: "allow" | "deny" | "ask" | "warn"
  reason: string
  matched_rule?: string
  risk_delta?: number
}

示例�?

{
  "decision": "deny",
  "reason": ".env.local matches blocked path .env*",
  "matched_rule": "blocked_paths:.env*",
  "risk_delta": 20
}

### 4.5 EvidencePackage

EvidencePackage 是机器可验证的审计产物�?

type EvidencePackage = {
  version: string
  task: TaskInfo
  scope: {
    scope_hash: string
    allowed_paths: string[]
    blocked_paths: string[]
    allowed_commands: string[]
    high_risk: string[]
  }
  agent: {
    name: string
    version?: string
    session_id?: string
  }
  events: ToolEvent[]
  commands: CommandEvidence[]
  tests: TestEvidence[]
  blocked_actions: BlockedAction[]
  diff: DiffEvidence
  risk: RiskResult
  hashes: EvidenceHashes
}

### 4.6 RiskResult

type RiskResult = {
  score: number
  level: "low" | "medium" | "high" | "critical"
  factors: RiskFactor[]
}

type RiskFactor = {
  delta: number
  reason: string
  source: string
}

示例�?

{
  "score": 37,
  "level": "medium",
  "factors": [
    {
      "delta": 20,
      "reason": "package.json changed",
      "source": "diff"
    },
    {
      "delta": -15,
      "reason": "required tests passed",
      "source": "tests"
    }
  ]
}

## 5. CLI 架构

package: packages/cli

CLI 负责�?

- 解析命令参数
- 调用 core 模块
- 显示交互提示
- 写入文件
- 输出结果

CLI 不应该直接实现复杂业务逻辑�?

命令规划�?

### V0

agentscope init
agentscope start "<task>"
agentscope show
agentscope check

### V1

agentscope install claude-code
agentscope evidence
agentscope report
agentscope risk

### V2

agentscope start "<task>" --explain
agentscope start "<task>" --ai-infer

### V3

agentscope verify
agentscope policy check

### V4

agentscope policy doctor
agentscope policy list
agentscope start --template frontend-bugfix "<task>"

## 6. Scope Inference Engine

package: packages/scope-inference

职责�?

将自然语言任务转换�?ScopeContract�?

输入�?

- task title
- repo profile
- package scripts
- file tree
- git history
- test mapping
- policy templates

输出�?

- ScopeContract
- confidence
- rationale

### V0 实现

V0 使用简单规则：

- 任务关键词匹配文件路�?
- 默认 allowed_paths: src/**, tests/**
- 默认 blocked_paths: .env*, migrations/**, .github/**
- �?package.json 读取 test / lint scripts
- 默认 high_risk: package.json, lockfiles

### V2 实现

V2 增强�?

- repo scanner
- framework detection
- git history signal
- test mapping
- import graph signal
- confidence scoring
- rationale output

### 设计原则

1. 默认本地推断
2. 不默认调�?LLM
3. LLM 推断只能作为可选增�?
4. 每个推断结果必须�?rationale
5. �?confidence 时必须要求用户确认或编辑

## 7. Policy Engine

package: packages/policy-engine

职责�?

根据 ScopeContract 判断 ToolEvent 是否允许�?

输入�?

- ScopeContract
- ToolEvent
- GlobalPolicy 可�?
- TeamPolicy 可�?

输出�?

- PolicyDecision

### 判断顺序

建议顺序�?

1. blocked_paths
2. dangerous_commands
3. high_risk
4. allowed_paths
5. allowed_commands
6. fallback policy

deny 优先级最高�?

### 路径策略

Read:
- target matches blocked_paths �?deny
- otherwise allow

Edit / Write:
- target matches blocked_paths �?deny
- target matches high_risk �?ask or warn
- target not matches allowed_paths �?ask or deny
- target matches allowed_paths �?allow

### 命令策略

Bash:
- command matches dangerous_commands �?deny
- command matches allowed_commands �?allow
- unknown command �?ask or warn

### Tool Source 策略

工具来源�?

- builtin
- shell
- mcp
- custom

MCP 不应该单独成为核心模块�?

MCP tool event 应统一进入 ToolEvent�?

## 8. Evidence Recorder

package: packages/evidence

职责�?

记录 session 证据�?

输入�?

- ScopeContract
- ToolEvent
- PolicyDecision
- git diff
- command results
- test results

输出�?

- evidence.json
- report.md 可�?

### Evidence 文件位置

.agentscope/evidence/latest.json

后续可以支持�?

.agentscope/evidence/2026-06-09T10-00-00Z.json

### Hashes

必须支持�?

- scope_hash
- diff_hash
- transcript_hash
- evidence_hash

V1 可以先实�?scope_hash�?
V3 必须实现 diff_hash �?evidence_hash�?

## 9. Risk Scoring Engine

package: packages/risk

职责�?

根据 evidence 计算风险分数�?

输入�?

- ScopeContract
- DiffEvidence
- ToolEvents
- PolicyDecisions
- TestEvidence

输出�?

- RiskResult

### V1 风险规则

- +40 修改 blocked_paths
- +25 修改 high_risk paths
- +20 发生 denied action
- +20 执行�?allowed command
- +15 修改 allowed_paths 外文�?
- -10 所有修改都�?allowed_paths
- -15 测试命令成功

### 风险等级

0-24 Low
25-49 Medium
50-79 High
80+ Critical

### 设计原则

1. 所�?risk factor 必须可解�?
2. 所有规则必须可测试
3. 默认不用 LLM 判断风险
4. 分数不应黑盒�?
5. CI 可以根据 score 失败或警�?

## 10. Claude Code Adapter

package: packages/adapters/claude-code

职责�?

�?AgentScope 的通用策略映射�?Claude Code hooks / permissions / transcript�?

### V1 目标

支持�?

- install
- uninstall
- PreToolUse hook
- Read / Edit / Write / Bash tool event 转换
- PolicyDecision 转换�?Claude Code 可理解的结果
- Event 写入 evidence recorder

### 不应该做

Claude Code adapter 不应该包含核心策略逻辑�?

它只负责�?

Claude Code event
�?ToolEvent
�?PolicyEngine
�?PolicyDecision
�?Claude Code response

### Hook 输入处理

Claude Code hook 输入应被转换成统一 ToolEvent�?

示例�?

Read .env.local

转换为：

{
  "agent": "claude-code",
  "event_type": "tool_call",
  "tool_source": "builtin",
  "tool_name": "Read",
  "action": "read",
  "target": ".env.local"
}

### Hook 输出处理

PolicyDecision:

deny

转换�?Claude Code hook response�?

Blocked by AgentScope:
.env.local matches blocked path .env*

注意�?

返回�?Claude 的信息必须简短，避免 token 膨胀�?

## 11. GitHub Action

package: packages/github-action

V3 实现�?

职责�?

- 读取 evidence.json
- 重新计算 diff_hash
- 校验 scope_hash
- 运行 risk scoring
- 输出 check summary
- 根据 policy_gate 配置 pass / warn / fail

GitHub Action 不应该调�?LLM�?

它是确定�?Policy Gate�?

## 12. Config 文件

### .agentscope/config.yaml

V2.1 起，config 使用结构化的 add/remove 形状，并�?loader 归一化为 **effective config**（built-in defaults �?legacy `defaults:` block �?`policy.*` add/remove patch）。内部代码只消费 effective config，不直接�?raw config�?

当前真实 shape（V2.1）：

version: 1

policy:
  blocked_paths:
    add: []
    remove: []
  high_risk:
    add: []
    remove: []
  allowed_commands:
    add: []
    remove: []
  dangerous_commands:
    add: []
    remove: []

inference:
  confidence_threshold: 0.65
  fallback:
    enabled: true
    allowed_paths:
      - src/**
      - tests/**
      - __tests__/**
  rule_packs:
    disabled: []
    overrides: {}

说明�?

- 所有字段可选，缺失项回退 built-in defaults�?
- 旧的 top-level `defaults:` block（含 `defaults.dangerous_commands`）仍兼容，folded �?effective config�?
- config 变更只影�?*新生�?*�?scope；已�?`current-scope.yaml` 不会自动改变，需要重�?`agentscope start`�?
- hook �?dangerous command 判断�?`effectiveConfig.policy.dangerous_commands`；config 无效�?hook �?crash、不削弱 enforcement，回退安全内置列表�?
- Local gate policy is implemented by `agentscope gate`. The CI workflow template, repo-local GitHub Action, and CI summary are implemented; SARIF, PR comments, and Marketplace Action publishing remain planned later.

### .agentscope/current-scope.yaml

当前 session scope�?

task:
  id: fix-login-redirect
  title: "Fix login redirect bug"

confidence: 0.87

allowed_paths:
  - src/auth/**
  - tests/auth/**

blocked_paths:
  - .env*
  - migrations/**
  - .github/**

allowed_commands:
  - npm test
  - npm run lint

high_risk:
  - package.json
  - pnpm-lock.yaml

rationale:
  - "Task contains auth-related keywords"
  - "Matched src/auth by path"
  - "Matched tests/auth by test mapping"

## 13. 测试策略

### Unit Tests

必须覆盖�?

- task id generation
- YAML config loading
- path matching
- command matching
- scope inference
- policy decision
- risk scoring
- evidence hash
- diff parsing

### Integration Tests

V0�?

- init
- start
- check

V1�?

- simulated Claude Code tool event
- policy allow
- policy deny
- evidence write
- risk output

### Fixture Repos

建议准备�?

fixtures/
  nextjs-auth/
  react-components/
  node-api/
  monorepo/
  dangerous-diff/

## 14. 错误处理

AgentScope 必须给出明确错误�?

示例�?

- package.json not found
- git repo not found
- current-scope.yaml missing
- invalid scope contract
- invalid config
- no changed files detected
- unsupported Claude Code settings format

错误信息应告诉用户下一步怎么做�?

## 15. 安全原则

1. 不读�?secret 内容，只检查路径或模式
2. 不上传代�?
3. 不默认调用远程服�?
4. 不默认调�?LLM
5. 不在 evidence 中保存敏感文件内�?
6. command log 应避免记�?secret value
7. 支持 redaction

## 16. Token 原则

AgentScope 本身不应显著增加 agent token�?

不要把以下内容注�?agent�?

- 完整 roadmap
- 完整 architecture
- 完整 policy registry
- 完整 evidence
- 完整 transcript
- 完整 git history

只注入最�?scope 摘要�?

Current task scope:
- Allowed edit paths: src/auth/**, tests/auth/**
- Blocked paths: .env*, migrations/**, .github/**
- Allowed commands: npm test, npm run lint
- High-risk changes require confirmation: package.json, pnpm-lock.yaml

## 17. 扩展边界

### V0

只做 CLI + local scope check�?

### V1

�?Claude Code�?

### V2

�?Scope Auto Inference�?

### V3

�?Evidence + GitHub Action�?

### V4

�?Team Policy Registry�?

### V5

�?Multi-Agent Adapters�?

### V6

�?Enterprise Governance�?

不要跨阶段实现过多功能�?
