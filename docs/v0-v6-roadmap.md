# AgentScope V0-V6 Roadmap

## 总体路线

AgentScope 的开发路线分为七个阶段：

V0: 本地原型
V1: Claude Code MVP
V2: Scope Auto Inference 深化
V3: Evidence + Policy Gate
V4: Team Policy Registry
V5: Multi-Agent Governance
V6: Enterprise Governance

核心主线：

Task
→ Scope Auto Inference
→ Human Approval
→ Runtime Enforcement
→ Evidence Package
→ Risk Scoring
→ Policy Gate

## V0：本地原型版

### 目标

验证 AgentScope 最核心的体验：

agentscope start "Fix login redirect bug"

能够生成一个 Task Scope Contract，并用它检查当前 git diff 是否越界。

V0 不需要接入 Claude Code。

V0 的目标是证明：

自然语言任务可以转换成最小权限边界。

### 必须实现

1. CLI 基础框架
2. `agentscope init`
3. `agentscope start "<task>"`
4. Task Scope Contract 初版生成
5. 用户确认流程
6. `.agentscope/current-scope.yaml`
7. `agentscope show`
8. `agentscope check`
9. 基于 git diff 的 scope 检查

### 推荐命令

agentscope init

生成：

.agentscope/
  config.yaml
  current-scope.yaml
  scopes/
  evidence/

agentscope start "Fix login redirect bug"

生成：

task:
  id: fix-login-redirect
  title: "Fix login redirect bug"

confidence: 0.62

allowed_paths:
  - src/**
  - tests/**

blocked_paths:
  - .env*
  - migrations/**
  - .github/**

allowed_commands:
  - npm test
  - npm run lint

high_risk:
  - package.json
  - package-lock.json
  - pnpm-lock.yaml

agentscope check

输出：

Scope Check

✅ src/auth/login.ts is within allowed paths
✅ tests/auth/login.test.ts is within allowed paths
⚠ package.json is high risk
❌ .github/workflows/deploy.yml is blocked

### V0 Scope Inference 规则

V0 只做简单推断：

- 读取 package.json
- 识别 npm / pnpm / yarn
- 识别 test / lint scripts
- 根据任务关键词匹配路径名
- 默认 blocked_paths
- 默认 high_risk paths
- 默认 allowed_paths 回退到 src/** 和 tests/**

不做复杂 AST。
不做 LLM。
不做 git history 深度分析。
不做 import graph。

### V0 不做

- Claude Code hooks
- Claude Code adapter
- GitHub Action
- Evidence Package 完整 schema
- Risk Scoring 完整规则
- MCP
- Web UI
- 多 agent
- 云端服务

### V0 验收标准

在一个真实 repo 中可以完成：

agentscope init
agentscope start "Fix login redirect bug"
agentscope check

并得到合理的 scope check 结果。

---

## V1：Claude Code MVP

### 目标

做出第一个可开源发布、可录制 demo 的版本。

V1 核心体验：

1. AgentScope 生成 Task Scope Contract
2. 用户确认
3. Claude Code 启动
4. Claude Code 尝试越界操作
5. AgentScope 拦截
6. 生成 evidence.json
7. 输出 risk score

### 必须实现

1. Claude Code adapter
2. Claude Code hook 安装
3. PreToolUse 策略拦截
4. Read / Edit / Write / Bash 支持
5. Event log
6. Evidence Package V1
7. Risk Scoring V1
8. Markdown report V1

### 推荐命令

agentscope install claude-code

作用：

- 检测 `.claude/settings.json`
- 备份原有 settings
- 注入 AgentScope hooks
- 配置 PreToolUse hook
- 指向 current-scope.yaml

agentscope start "Fix login redirect bug"

claude

agentscope evidence

agentscope report

agentscope risk

### V1 策略决策

支持决策：

- allow
- deny
- ask
- warn

策略：

Read:
- 命中 blocked_paths → deny
- 其他 → allow

Edit / Write:
- 命中 blocked_paths → deny
- 命中 high_risk → ask 或 warn
- 不在 allowed_paths → ask 或 deny
- 在 allowed_paths → allow

Bash:
- 命中 dangerous_commands → deny
- 在 allowed_commands → allow
- 未知命令 → ask 或 warn

### V1 Dangerous Command Patterns

默认危险命令：

- rm -rf *
- curl * | sh
- wget * | sh
- chmod 777 *
- git push --force
- sudo *
- dd if=*
- mkfs*
- kubectl apply *
- terraform apply *

### V1 Evidence Package

V1 evidence 文件：

.agentscope/evidence/latest.json

基础字段：

{
  "version": "0.1",
  "task": {
    "id": "fix-login-redirect",
    "title": "Fix login redirect bug"
  },
  "scope": {
    "scope_hash": "sha256:...",
    "allowed_paths": ["src/auth/**", "tests/auth/**"],
    "blocked_paths": [".env*", "migrations/**", ".github/**"],
    "allowed_commands": ["npm test", "npm run lint"],
    "high_risk": ["package.json", "pnpm-lock.yaml"]
  },
  "events": [],
  "diff": {
    "changed_files": []
  },
  "risk": {
    "score": 0,
    "level": "low",
    "factors": []
  }
}

### V1 Risk Scoring

初版规则：

- +40 修改 blocked_paths
- +25 修改 high_risk paths
- +20 发生 denied action
- +20 执行非 allowed command
- +15 修改 allowed_paths 外文件
- -10 所有修改都在 allowed_paths
- -15 测试命令成功

分级：

- 0-24 Low
- 25-49 Medium
- 50-79 High
- 80+ Critical

### V1 不做

- 多 agent
- GitHub Action
- Team Policy Registry
- Scope Auto Inference 深度优化
- Web dashboard
- MCP 专项功能
- 云端服务

### V1 验收标准

能够录制完整 demo：

agentscope start "Fix login redirect bug"
claude

Claude 尝试读取 .env.local，被 AgentScope 拦截。

Claude 修改 src/auth/login.ts。

Claude 执行 npm test。

agentscope report 输出：

- task
- scope
- events
- blocked actions
- risk score

---

## V2：Scope Auto Inference 深化版

### 目标

把 AgentScope 的护城河做深。

V2 要让系统更准确地自动推断本次任务的最小权限边界。

### 必须实现

1. Repo Scanner
2. Project Type Detection
3. Task Keyword Matcher
4. Git History Signal
5. Test Mapping
6. Import Graph Signal 初版
7. Confidence Scoring
8. Rationale 输出
9. Scope Diff

### Repo Scanner

识别：

- src/
- app/
- pages/
- routes/
- components/
- tests/
- __tests__/
- spec/
- e2e/
- migrations/
- infra/
- .github/

识别项目类型：

- Next.js
- React
- Vue
- Express
- NestJS
- FastAPI
- Django
- Spring Boot
- Monorepo

输出 repo profile：

{
  "framework": "nextjs",
  "package_manager": "pnpm",
  "source_roots": ["src", "app"],
  "test_roots": ["tests", "__tests__"],
  "high_risk_roots": ["migrations", ".github", "infra"]
}

### Task Keyword Matcher

任务：

Fix login redirect bug

提取关键词：

- login
- redirect
- auth
- session
- route

匹配路径：

- src/auth/**
- src/routes/login/**
- tests/auth/**

匹配文件：

- login.ts
- auth.ts
- session.ts
- redirect.ts
- login.test.ts

### Git History Signal

使用 git log 查找：

- 最近相关变更文件
- 经常一起修改的文件
- 历史 bugfix 涉及路径

例如：

src/auth/login.ts appeared in 7 recent auth-related commits.
tests/auth/login.test.ts often changes with src/auth/login.ts.

### Test Mapping

从源文件推断测试文件：

src/auth/login.ts

可能对应：

- tests/auth/login.test.ts
- src/auth/__tests__/login.test.ts
- src/auth/login.spec.ts

输出 required tests：

required_commands:
  - npm test -- auth

如果无法精确推断，回退：

allowed_commands:
  - npm test

### Import Graph Signal

V2 先支持 TypeScript / JavaScript。

轻量解析：

- import statements
- export statements
- relative imports

目的：

- 找源文件和测试文件关系
- 找受影响模块
- 提高 confidence

不要在 V2 做完整语言服务器。

### Confidence Scoring

输出：

confidence: 0.87

分级：

- 0.90+ high
- 0.70-0.89 medium-high
- 0.50-0.69 medium
- <0.50 low，需要用户编辑

### Rationale

必须解释为什么推断这些路径：

rationale:
  - "Task contains auth-related keywords: login, redirect"
  - "Matched src/auth/login.ts by filename"
  - "Matched tests/auth/login.test.ts by test mapping"
  - "Recent commits for login modified src/auth/session.ts"

### Scope Diff

如果用户编辑 scope，显示差异：

You added:
+ src/routes/**

You removed:
- tests/auth/**

Warning:
Removing tests/auth/** may reduce test evidence quality.

### V2 不做

- LLM 默认推断
- 云端索引
- 复杂 AST
- 多 agent
- 企业 dashboard

可以支持可选：

agentscope start "Fix login redirect bug" --ai-infer

但默认必须是本地推断。

### V2 验收标准

对于常见任务能生成合理 scope：

- Fix login redirect bug
- Update navbar style
- Add validation to signup form
- Fix payment webhook test
- Update CI node version
- Add database migration for users

---

## V3：Evidence + Policy Gate 成熟版

### 目标

让 AgentScope 进入工程流程。

V3 的核心：

Evidence Package 成为机器可验证的审计产物。
Policy Gate 成为 CI 的判断依据。

### 必须实现

1. Evidence schema 稳定化
2. scope_hash
3. diff_hash
4. transcript_hash
5. evidence_hash
6. Test Evidence
7. GitHub Action
8. PR Check Summary
9. Policy Gate Rules
10. SARIF 输出可选

### Evidence Schema

文件：

agentscope-evidence.schema.json

字段：

{
  "version": "1.0",
  "task": {},
  "scope": {},
  "agent": {},
  "events": [],
  "diff": {},
  "commands": [],
  "tests": [],
  "blocked_actions": [],
  "risk": {},
  "hashes": {}
}

### Hashes

scope_hash:

证明 session 使用的是哪份 scope。

diff_hash:

证明 evidence 对应的是当前 diff。

transcript_hash:

证明 evidence 对应某个真实 agent session。

evidence_hash:

证明 evidence 本身未被篡改。

### Test Evidence

记录：

{
  "tests": [
    {
      "command": "npm test",
      "exit_code": 0,
      "started_at": "...",
      "ended_at": "...",
      "verified": true
    }
  ]
}

### GitHub Action

用法：

- uses: yourname/agentscope-action@v1

功能：

- 读取 evidence.json
- 重新计算 diff_hash
- 检查 scope adherence
- 检查 blocked_paths
- 检查 high_risk changes
- 检查 test evidence
- 计算 risk score
- 输出 PR summary

### Policy Gate Rules

配置：

policy_gate:
  fail_on:
    - critical_risk
    - modified_blocked_path
    - missing_evidence
    - missing_scope_hash

  warn_on:
    - high_risk_path_changed
    - tests_missing
    - blocked_action_occurred

  thresholds:
    max_risk_score: 70

### PR 输出

AgentScope Policy Gate

Risk: 37/100 Medium

✅ Scope Adherence
✅ No protected files modified
✅ Tests verified
⚠ package.json changed
⚠ One blocked action occurred

### V3 验收标准

在 GitHub PR 中显示 AgentScope check。

CI 能验证：

- evidence.json 是否存在
- diff_hash 是否匹配
- scope_hash 是否存在
- 是否修改 blocked paths
- risk score 是否超过阈值

---

## V4：Team Policy Registry

### 目标

让 AgentScope 从个人工具升级为团队工具。

V4 解决：

不同团队、不同任务类型需要可复用 policy 模板。

### 必须实现

1. Policy Templates
2. Team Registry
3. Policy Inheritance
4. CODEOWNERS 集成
5. Organization Defaults
6. Policy Doctor

### 内置模板

- docs-only
- frontend-bugfix
- backend-bugfix
- fullstack-feature
- dependency-update
- database-migration
- ci-change
- security-fix
- refactor
- test-only

### Team Registry

路径：

.agentscope/policies/
  frontend-bugfix.yaml
  backend-bugfix.yaml
  migration.yaml
  security-fix.yaml

命令：

agentscope start --template frontend-bugfix "Fix navbar dropdown"

### Policy Inheritance

支持：

extends: base

allowed_paths:
  - src/components/**

blocked_paths:
  - migrations/**

base policy：

base:
  blocked_paths:
    - .env*
    - secrets/**
  dangerous_commands:
    - rm -rf *
    - curl * | sh

### CODEOWNERS 集成

如果修改高敏路径：

- payments/**
- infra/**
- security/**
- .github/**

则：

- 增加 risk score
- 要求 owner review
- 或进入 warn / fail

### Organization Defaults

支持：

.agentscope/org-policy.yaml

示例：

global_blocked_paths:
  - .env*
  - prod/**
  - customer-data/**

global_dangerous_commands:
  - git push --force
  - kubectl apply *
  - terraform apply *

### Policy Doctor

命令：

agentscope policy doctor

检查：

- policy 是否冲突
- allowed_paths 是否覆盖 blocked_paths
- required_commands 是否存在
- 模板是否引用不存在路径
- risk rules 是否重复
- policy inheritance 是否循环

### V4 验收标准

团队可以维护 `.agentscope/policies/`。

开发者可以运行：

agentscope start --template backend-bugfix "Fix webhook retry"

CI 使用同一套 policy gate。

---

## V5：Multi-Agent Governance

### 目标

从 Claude Code 专属升级为多 agent 统一治理层。

AgentScope 长期定位不是 Claude Code Extension，而是：

Open Policy + Evidence Layer for AI Coding Agents

### 必须实现

1. Agent Adapter Interface
2. Unified Tool Event Model
3. Adapter Capability Matrix
4. Evidence Import
5. 多 agent check
6. MCP 作为 tool source 处理

### Agent Adapter Interface

interface AgentAdapter {
  name: string
  install(): Promise<void>
  enforce(scope: ScopeContract): Promise<void>
  collectEvidence(): Promise<EvidencePackage>
  uninstall(): Promise<void>
}

支持方向：

- claude-code
- codex
- cursor
- gemini-cli
- custom

### Unified Tool Event Model

统一事件：

{
  "agent": "claude-code",
  "event_type": "tool_call",
  "tool_source": "builtin",
  "tool_name": "Edit",
  "action": "write",
  "target": "src/auth/login.ts",
  "decision": "allow",
  "timestamp": "..."
}

MCP 工具：

{
  "tool_source": "mcp",
  "tool_name": "github.create_pr"
}

MCP 不作为产品核心，只作为 tool source。

### Adapter Capability Matrix

不同 agent 支持程度不同：

Claude Code:
- enforcement: full
- evidence: full
- transcript: full

Cursor:
- enforcement: partial
- evidence: partial
- transcript: unavailable

Codex:
- enforcement: partial
- evidence: partial

Custom:
- enforcement: none
- evidence: import-only

AgentScope 要诚实显示能力矩阵。

### Evidence Import

允许导入其他 agent 日志：

agentscope import --agent custom ./agent-log.json

然后仍然可以：

agentscope check
agentscope risk

### V5 验收标准

AgentScope Core 与 Claude Code 解耦。

Claude Code 仍是最佳支持，但核心抽象已经支持多 agent。

---

## V6：Enterprise Governance

### 目标

让 AgentScope 具备企业级治理能力。

V6 不是早期目标，但架构要预留扩展空间。

### 可能功能

1. Central Policy Server
2. Signed Evidence Package
3. OPA / Rego 集成
4. SIEM / Audit Log 集成
5. Dashboard
6. Organization Risk Analytics

### Central Policy Server

命令：

agentscope server

功能：

- policy 分发
- evidence 收集
- risk dashboard
- team audit
- session 查询

### Signed Evidence Package

对 evidence 签名：

- scope_hash
- diff_hash
- transcript_hash
- evidence_hash
- signature

目标：

防止事后篡改 evidence。

### OPA / Rego 集成

支持企业策略：

deny[msg] {
  input.diff.modified_paths[_] == ".github/workflows/deploy.yml"
  not input.task.template == "ci-change"
  msg := "CI workflow modified outside ci-change task"
}

### SIEM / Audit Log 集成

输出到：

- Datadog
- Splunk
- OpenTelemetry
- CloudWatch
- Elastic

### Dashboard

展示：

- AI sessions 数量
- blocked actions 数量
- high risk PRs
- risk trends
- repo risk ranking
- agent risk comparison
- policy violations

### Organization Risk Analytics

示例：

过去 30 天：

- Claude Code sessions: 420
- High risk PRs: 19
- Blocked .env access: 37
- Missing tests: 82
- Most common violation: package.json changed outside dependency-update

## 实际开发顺序建议

### 第 1 周

完成 V0：

- CLI
- config
- task scope contract
- basic repo scanner
- basic diff check

### 第 2-3 周

完成 V1：

- Claude Code adapter
- PreToolUse hook
- Read/Edit/Write/Bash policy
- event log
- evidence.json
- risk score
- markdown report

### 第 4-5 周

完成 V2：

- repo profile
- task keyword matching
- test mapping
- git history signal
- confidence score
- rationale

### 第 6 周

完成 V3：

- evidence schema
- diff_hash
- scope_hash
- GitHub Action
- PR comment
- risk threshold

### 第 7-8 周

完成 V4：

- policy templates
- policy inheritance
- team registry
- policy doctor

## 功能优先级

最高优先级：

1. agentscope start
2. Task Scope Contract
3. Scope Auto Inference 初版
4. Human Approval
5. Claude Code Adapter
6. Runtime Policy Enforcement
7. Evidence Package
8. Risk Scoring
9. Policy Gate
10. Team Policy Registry

## 早期不要做

不要在 V0-V2 做：

- Web dashboard
- 多 agent 完整支持
- MCP 专项管理
- LLM-as-judge
- 云端 policy server
- 复杂安全扫描
- 复杂 AST 分析
- IDE 插件
- 企业 SSO
- 可视化 session replay