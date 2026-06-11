# AgentScope Product Vision

## 1. 项目一句话定位

AgentScope 是 AI Coding Session 的最小权限治理层。

它将一次自然语言开发任务转换成一个可执行、可审计、可验证的 Task Scope Contract，并在 AI coding agent 执行过程中约束其文件访问、命令执行、工具调用和代码修改范围。

长期定位：

AgentScope = Open Policy + Evidence Layer for AI Coding Agents

更形象地说：

AgentScope 是 AI Agent 时代的 IAM + CloudTrail + Policy Gate。

> **当前实现状态（v0.1.0）：** 已落地 Task Scope Contract、Claude Code 运行时强制（PreToolUse hook：allow / deny / ask）、Evidence Package、确定性 Risk Score、Local Policy Gate（`agentscope gate`）、CI workflow template、repo-local GitHub Action、CI Summary（`agentscope ci-summary`）。本文档描述的是完整产品愿景；其中 **SARIF / PR comments、Marketplace Action publishing、Team Policy Registry、多 agent 治理、cloud sync 仍是规划方向，尚未实现**。已实现范围以 [v0-v6-roadmap.md](v0-v6-roadmap.md) 的进度概览为准。

## 2. 为什么需要 AgentScope

AI coding agents 正在从“辅助补全”变成“主动执行者”。

它们可以：

- 读取代码
- 修改文件
- 执行命令
- 调用工具
- 创建 PR
- 修复测试
- 重构模块

这带来一个新问题：

AI agent 不是不会写代码，而是边界感不稳定。

常见问题：

- 用户让它修一个小 bug，它顺手重构整个模块
- 用户让它改 UI，它修改了 package.json
- 用户让它补测试，它跑了 install 并改了 lockfile
- 用户让它修 auth bug，它尝试读取 .env.local
- 用户让它改业务代码，它修改 CI/CD workflow
- 用户不知道它是否跑过测试
- 用户不知道它有没有越权尝试
- 团队不知道 AI 生成的 PR 是否符合开发流程

这些问题不是靠“更长的 CLAUDE.md”完全解决的。

CLAUDE.md、AGENTS.md、Cursor rules 本质上仍然是 prompt-level guidance。

AgentScope 要做的是把规则升级为 runtime policy。

## 3. 核心洞察

现有 AI coding 工具的关注点通常是：

- 如何给 agent 更多上下文
- 如何让 agent 更会写代码
- 如何生成更好的提示词
- 如何让 agent 自动创建 PR
- 如何总结 agent 做了什么

AgentScope 的关注点不同：

本次任务下，agent 应该拥有什么最小权限？

这就是 Task Scope Contract。

它解决的是：

- 本次任务允许修改哪些路径？
- 哪些路径绝对不能碰？
- 哪些文件属于高风险修改？
- 允许执行哪些命令？
- 哪些命令应该阻止？
- 哪些操作需要人工确认？
- 最终 diff 是否遵守了 scope？
- 这次 session 是否有可审计证据？

## 4. 核心产品闭环

AgentScope 的完整闭环：

Task
→ Scope Auto Inference
→ Human Approval
→ Runtime Enforcement
→ Evidence Package
→ Risk Scoring
→ Policy Gate

### 4.1 Task

输入是自然语言任务，例如：

Fix login redirect bug

### 4.2 Scope Auto Inference

AgentScope 根据以下信号自动推断任务边界：

- task keywords
- repo structure
- file names
- package scripts
- test mapping
- git history
- import graph
- CODEOWNERS
- team policy templates

输出：

- allowed_paths
- blocked_paths
- allowed_commands
- high_risk paths
- required tests
- confidence
- rationale

### 4.3 Human Approval

用户确认或编辑 scope。

AgentScope 不应该让用户从零写配置。

理想体验：

agentscope start "Fix login redirect bug"

输出：

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

Approve? [Y/n/e]

### 4.4 Runtime Enforcement

在 agent 执行过程中，AgentScope 根据 scope contract 判断每个 tool event：

- allow
- deny
- ask
- warn

事件类型包括：

- file read
- file edit
- file write
- shell command
- tool call
- MCP tool call
- future agent-specific tools

注意：

MCP 不应该是产品核心，只是 tool source 之一。

AgentScope 的抽象应该是：

Any Tool
→ Unified Policy Layer
→ Evidence Package

### 4.5 Evidence Package

Evidence Package 是机器可验证的审计产物。

它不是阅读型 Summary。

不应只是：

- Files changed
- Commands run
- Summary

而应该包含：

- task
- scope_hash
- transcript_hash
- diff_hash
- commands
- blocked_actions
- tests
- risk factors
- evidence_hash

Evidence Package 应该能被 CI 重新校验。

### 4.6 Risk Scoring

AgentScope 需要把事件转化为风险分数。

例如：

+20 修改 package.json
+30 修改 CI workflow
+40 修改 migration
+50 检测到 secret
+25 缺少 evidence
+20 有 blocked action
-15 测试通过
-10 所有修改都在 scope 内

输出：

Risk: 37/100 Medium

### 4.7 Policy Gate

Policy Gate 不是 AI PR Review。

它不判断代码风格、不写 review 建议、不替代 reviewer。

它只做确定性策略检查：

- scope-adherence
- protected-files
- risky-commands
- secrets-scan
- test-evidence
- evidence-integrity
- risk-threshold

它更像 SonarQube / Snyk / Checkov，但面向 AI coding sessions。

## 5. 不做什么

AgentScope 明确不做以下方向。

### 5.1 不做 Repo Context Packer

不做 Repomix 类项目。

不以“把整个代码库打包给 AI”为主线。

AgentScope 不是上下文供给层，而是治理层。

### 5.2 不做 AGENTS.md / CLAUDE.md 生成器

不做 Caliber 类项目。

AgentScope 不以生成或同步 AI rules 文件为核心。

已有 CLAUDE.md / AGENTS.md 可以作为输入信号，但不是主产品。

### 5.3 不做 Context Evaluator

不做纯静态评分器。

可以检查上下文文件是否与 scope 冲突，但不要把“给 CLAUDE.md 打分”作为核心卖点。

### 5.4 不做 MCP Scanner

MCP 生态变化快，且已有安全扫描工具。

AgentScope 不应该绑定 MCP。

MCP 只是 Tool Source。

### 5.5 不做 AI PR Reviewer

不做“让 Claude review PR”的工具。

AgentScope 是 Policy Gate，不是 Review Bot。

### 5.6 不做阅读型报告插件

Report 是展示层，不是护城河。

真正有价值的是 Evidence Package。

## 6. 核心用户

### 6.1 个人开发者

他们想安全地使用 Claude Code / Codex / Cursor 改真实仓库。

痛点：

- 怕 agent 改多
- 怕 agent 读敏感文件
- 怕 agent 乱跑命令
- 想知道本次修改是否越界

### 6.2 开源维护者

他们可能接受 AI-generated PR。

痛点：

- 不知道 PR 是否由 agent 生成
- 不知道 agent 是否跑过测试
- 不知道 agent 是否修改高风险文件
- 想用 CI 做最小治理

### 6.3 工程团队

他们想让 AI coding agents 进入真实工作流。

痛点：

- 缺少团队 policy
- 缺少审计证据
- 缺少风险分级
- 缺少统一治理层

## 7. 产品护城河

AgentScope 的护城河不是“限制命令”。

Claude Code 原生就有 permissions 和 hooks。

AgentScope 的护城河是：

1. Task Scope Auto Inference
2. Task Scope Contract
3. Agent-agnostic Policy Engine
4. Evidence Package schema
5. Risk Scoring Engine
6. Policy Gate workflow
7. Team Policy Registry
8. Multi-Agent Governance

一句话：

Claude Code 提供底层能力。
AgentScope 把底层能力产品化为任务级治理流程。

## 8. 最小权限原则

AgentScope 的基本哲学：

每次 AI coding session 都应该默认最小权限。

这意味着：

- agent 不应该默认能读所有文件
- agent 不应该默认能改所有路径
- agent 不应该默认能执行任意命令
- agent 不应该默认能调用所有工具
- agent 不应该默认能修改 CI、migration、lockfile、secret 配置

权限应该来自任务，而不是来自项目全局。

## 9. Token 成本原则

AgentScope 不应该增加大量 token。

正确设计：

- scope inference 默认本地执行
- policy enforcement 本地执行
- evidence generation 本地执行
- risk scoring 本地执行
- 只给 agent 注入极短 scope 摘要

错误设计：

- 把完整 policy 注入 agent
- 让 LLM 每一步判断是否允许
- 让 LLM 生成 evidence
- 把完整 transcript 塞回上下文
- 把项目长期 roadmap 注入每次 session

原则：

Use tokens only to inform the agent.
Use deterministic local code to govern the agent.

## 10. 终局愿景

短期：

Claude Code 的 Task Scope Contract 工具。

中期：

AI coding session 的 Evidence + Risk + Policy Gate。

长期：

多 agent 统一治理层。

未来团队里可能同时使用：

- Claude Code
- Cursor Agent
- Codex
- Gemini CLI
- Devin
- GitHub Copilot agents
- Custom internal agents

企业真正需要的不是某个 agent 的插件，而是统一治理层。

AgentScope 的长期愿景是：

Open Policy + Evidence Layer for AI Coding Agents.