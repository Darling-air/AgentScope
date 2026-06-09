# CLAUDE.md

## 项目名称

AgentScope

## 项目定位

AgentScope 是 AI Coding Session 的 Task-Scoped Governance / 最小权限治理层。

它的核心目标不是让 AI agent 写更多代码，而是让每一次 AI coding session 都具备：

1. 明确的任务边界
2. 最小权限原则
3. 可执行的运行时策略
4. 可验证的 Evidence Package
5. 可计算的 Risk Score
6. 可进入 CI 的 Policy Gate

核心流程：

Task
→ Scope Auto Inference
→ Human Approval
→ Runtime Enforcement
→ Evidence Package
→ Risk Scoring
→ Policy Gate

## 一句话原则

AgentScope = Least-privilege sessions for AI coding agents.

不要把 AgentScope 做成：
- repo context packer
- AGENTS.md / CLAUDE.md 生成器
- Claude Code 总结报告插件
- MCP 专用扫描器
- AI PR reviewer
- prompt 模板集合

AgentScope 的护城河是：

Task Scope Contract + Evidence Package + Policy Gate

## 当前开发阶段

当前阶段：V0

V0 目标：

实现一个本地原型，让用户可以运行：

agentscope init
agentscope start "Fix login redirect bug"
agentscope check

V0 只需要证明：

自然语言任务
→ Task Scope Contract
→ git diff scope check

## V0 必须实现

1. CLI 基础框架
2. `agentscope init`
3. `agentscope start "<task>"`
4. 基础 Task Scope Contract 生成
5. 用户确认流程
6. `.agentscope/current-scope.yaml`
7. `agentscope check`
8. 基于 git diff 检查：
   - 是否修改 allowed_paths
   - 是否修改 blocked_paths
   - 是否修改 high_risk paths

## V0 不要实现

当前阶段不要实现：

- Claude Code hooks
- Claude Code adapter
- GitHub Action
- MCP 专项功能
- Web UI
- 多 agent 支持
- 云端服务
- LLM-as-judge
- 复杂 AST 分析
- 企业级 dashboard

如果任务要求实现上述功能，请先拒绝扩展，并提醒当前阶段只做 V0。

## 产品核心概念

### Task Scope Contract

Task Scope Contract 是本项目最重要的数据结构。

它表示一次 AI coding session 被允许做什么、不允许做什么、哪些操作属于高风险。

示例：

task:
  id: fix-login-redirect
  title: "Fix login redirect bug"

confidence: 0.72

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
  - package-lock.json
  - pnpm-lock.yaml

### Evidence Package

Evidence Package 不是普通总结报告。

它是机器可验证的审计产物，未来应包含：

- task
- scope_hash
- transcript_hash
- diff_hash
- commands
- blocked_actions
- tests
- risk score

V0 阶段暂时不需要完整实现。

### Policy Gate

Policy Gate 不是 AI PR Review。

它不评价代码写得好不好，而是判断：

- 是否越过 Task Scope Contract
- 是否修改 protected files
- 是否缺少 evidence
- 是否缺少测试证据
- 风险分数是否超过阈值

V0 阶段暂时不需要实现。

## Token 成本原则

AgentScope 不应该成为上下文膨胀器。

必须遵守：

1. 默认使用本地确定性逻辑
2. 不默认调用 LLM 推断 scope
3. 不把完整 policy registry 注入 Claude
4. 不把 evidence.json 注入 Claude
5. 只向 agent 注入最小必要 scope 摘要
6. 风险计算、diff 检查、evidence 生成都应在本地完成

原则：

Use tokens only to inform the agent.
Use deterministic local code to govern the agent.

## 技术栈建议

优先使用：

- TypeScript
- Node.js
- pnpm
- Commander 或 Clipanion
- Zod
- picomatch
- simple-git 或 execa 调用 git
- YAML parser
- Vitest

## 目录结构建议

推荐结构：

packages/
  cli/
  core/
  scope-inference/
  policy-engine/
  evidence/
  risk/
  adapters/
    claude-code/

docs/
  product-vision.md
  v0-v6-roadmap.md
  architecture.md

.agentscope/
  config.yaml
  current-scope.yaml
  scopes/
  evidence/

## 代码设计原则

1. Core logic 不依赖 Claude Code
2. Claude Code 只能作为 adapter
3. Task Scope Contract 必须 agent-agnostic
4. Evidence Package 必须 agent-agnostic
5. Risk Scoring 必须可测试、可解释、确定性
6. CLI 只做编排，不堆业务逻辑
7. 所有 schema 使用 Zod 定义
8. 所有路径匹配统一经过 policy-engine
9. 所有风险因子都必须有 reason
10. 不要在 V0 引入不必要抽象

## 命名约定

使用英文命名代码概念：

- ScopeContract
- ScopeInferenceEngine
- PolicyEngine
- EvidencePackage
- RiskScoringEngine
- AgentAdapter
- ToolEvent
- PolicyDecision

不要使用拼音或中文变量名。

## 测试要求

新增核心逻辑必须有测试。

至少覆盖：

- task title to task id
- path pattern matching
- blocked path detection
- high risk path detection
- allowed path detection
- scope check result
- config loading
- scope file generation

## 当前优先级

当前最高优先级：

1. 让 CLI 能跑
2. 让 Task Scope Contract 能生成
3. 让用户能确认 scope
4. 让 `agentscope check` 能检查 git diff
5. 保持架构为后续 Claude Code adapter 留出口

不要提前做复杂功能。