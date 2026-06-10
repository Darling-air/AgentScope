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

* repo context packer
* AGENTS.md / CLAUDE.md 生成器
* Claude Code 总结报告插件
* MCP 专用扫描器
* AI PR reviewer
* prompt 模板集合

AgentScope 的护城河是：

Task Scope Contract + Runtime Policy Enforcement + Evidence Package + Policy Gate

## 当前开发阶段

当前阶段：V1.2

当前子阶段名称：

Claude Code Hook Installer

## 已完成阶段

### V0 已完成

* `agentscope init`
* `agentscope start "<task>"`
* `agentscope show`
* `agentscope check`
* 本地 Task Scope Contract 生成
* 基于 git diff 的 scope check
* core / cli 分离
* TypeScript + Vitest 测试基础

### V1.0 已完成

* `ToolEvent`
* `PolicyDecision`
* `PolicyEngine`
* `CommandMatcher`
* Read / Edit / Write / Bash 策略判断
* agent-agnostic runtime policy foundation
* policy engine 测试覆盖

### V1.1 已完成

* Claude Code PreToolUse payload schema
* Claude Code payload → ToolEvent translator
* PolicyDecision → Claude Code hook response mapper
* dry-run hook entrypoint
* `agentscope hook claude-code pre-tool-use`
* fixture-based tests
* safe ask fallback
* CLI 可从 stdin 读取 hook payload 并输出 hook response JSON

## V1.2 目标

V1.2 的目标是安全安装 Claude Code PreToolUse hook。

本阶段要证明：

V1.1 dry-run hook entrypoint
→ 安全注入 Claude Code settings
→ Claude Code live session 可以调用 AgentScope hook
→ Read / Edit / Write / Bash 在运行时受 Task Scope Contract 约束

## V1.2 必须实现

1. `agentscope install claude-code`
2. `agentscope uninstall claude-code`
3. `--dry-run` 安装预览
4. `--shared` 选择写入 `.claude/settings.json`
5. 默认写入 `.claude/settings.local.json`
6. settings 文件读取、解析、写入
7. 写入前自动备份
8. idempotent injection：重复安装不重复插入 hook
9. uninstall 能恢复或移除 AgentScope hook
10. 针对 settings transform 的 fixture tests
11. README 中说明 V1.2 的安装和卸载方式

## V1.2 允许实现

当前阶段允许实现：

* `src/core/adapters/claude-code/settings.ts`
* Claude Code settings loader
* Claude Code settings writer
* Claude Code settings backup
* settings hook transform
* `agentscope install claude-code`
* `agentscope uninstall claude-code`
* `--dry-run`
* `--shared`
* settings fixture tests
* live hook command 生成
* README 中标注 Claude Code hook install 进入 V1.2

## V1.2 不要实现

当前阶段不要实现：

* Evidence Package 完整版
* Risk Score V1
* `agentscope risk`
* GitHub Action
* PR Policy Gate
* SARIF 输出
* Team Policy Registry
* Multi-Agent adapters
* Cursor adapter
* Codex adapter
* Gemini CLI adapter
* MCP 专项治理
* OPA / Rego
* signed evidence
* 云端服务
* Web dashboard
* 企业审计平台
* LLM-as-judge
* 默认 LLM scope inference

如果任务要求实现上述功能，请提醒用户这些属于后续阶段，不应在 V1.2 实现。

## V1 开发顺序

### V1.0：Core Enforcement Foundation

状态：已完成。

### V1.1：Claude Code Hook Translator + Dry-run Hook Entrypoint

状态：已完成。

### V1.2：Claude Code Hook Installer

状态：当前阶段。

目标：

把 V1.1 的 dry-run hook entrypoint 安全写入 Claude Code settings。

### V1.3：Evidence Event Recorder

状态：后续阶段。

目标：

记录 runtime policy decisions。

### V1.4：Risk Score V1

状态：后续阶段。

目标：

基于 V1 events 和现有 diff check 计算初版风险分。

## V1.2 settings 策略

Claude Code settings 有多个位置。

AgentScope V1.2 默认写入：

```txt
.claude/settings.local.json
```

原因：

* 这是本地个人配置
* 不应默认提交到 git
* 更适合首次安装和试验
* 避免无意修改团队共享配置

只有用户显式传入：

```bash
agentscope install claude-code --shared
```

才写入：

```txt
.claude/settings.json
```

卸载命令同理：

```bash
agentscope uninstall claude-code
agentscope uninstall claude-code --shared
```

## V1.2 hook matcher 策略

V1.2 只拦截以下工具：

* Read
* Edit
* Write
* Bash

不要拦截所有工具。

不要做 MCP 专项治理。

MCP 只作为未来 ToolEvent 的 `tool_source` 之一。

## V1.2 hook command 策略

注入的 hook command 应调用当前项目可用的 AgentScope CLI。

优先选择稳定、可运行的方式。

开发阶段可以使用：

```bash
pnpm agentscope hook claude-code pre-tool-use
```

或项目 bin 可用时使用：

```bash
agentscope hook claude-code pre-tool-use
```

如果需要绝对路径，请确保跨平台兼容，特别是 Windows 路径。

V1.2 必须考虑 Windows 环境。

当前用户项目路径可能类似：

```txt
G:/AgentScope
```

## V1.2 settings 注入原则

必须满足：

1. 不破坏已有 settings 字段
2. 不删除用户已有 hooks
3. 不重复插入 AgentScope hook
4. 已存在 AgentScope hook 时更新 command
5. 写入前创建备份
6. `--dry-run` 只打印 diff 或 before/after，不写文件
7. settings JSON 格式化输出，便于 review
8. 解析失败时不要覆盖原文件
9. 缺少 `.claude/` 目录时可以创建
10. 默认安装到 `.claude/settings.local.json`

## V1.2 hook 标识

AgentScope 注入的 hook 必须有可识别标记。

建议使用 command 中的稳定标记：

```txt
agentscope hook claude-code pre-tool-use
```

也可以在 hook entry 中加入 metadata 字段，如果 Claude Code settings 允许保留未知字段；如果不确定，不要依赖未知字段。

检测重复 hook 时，优先通过 command 包含以下字符串判断：

```txt
agentscope hook claude-code pre-tool-use
```

## V1.2 备份策略

写入前备份：

默认本地 settings：

```txt
.claude/settings.local.json
.claude/settings.local.json.agentscope-backup
```

共享 settings：

```txt
.claude/settings.json
.claude/settings.json.agentscope-backup
```

如果备份已存在：

* 不要覆盖
* 输出提示
* 继续更新 settings 可以允许，但要保留原始备份

uninstall 时：

优先策略：

1. 如果 backup 存在，提示可恢复 backup
2. 默认只移除 AgentScope hook，不恢复整个文件
3. 可提供 `--restore-backup` 恢复备份

V1.2 可以只实现：

```bash
agentscope uninstall claude-code
```

用于移除 AgentScope hook。

`--restore-backup` 可选实现；如果实现，必须测试。

## 核心数据结构

### Task Scope Contract

Task Scope Contract 表示一次 AI coding session 被允许做什么、不允许做什么、哪些操作属于高风险。

### ToolEvent

ToolEvent 表示 agent 的一次工具调用或命令执行请求。

V1 已支持：

```ts
type ToolEvent = {
  id: string
  timestamp: string
  agent: string
  event_type: "tool_call" | "command"
  tool_source: "builtin" | "shell" | "mcp" | "custom"
  tool_name?: "Read" | "Edit" | "Write" | "Bash" | string
  action?: "read" | "write" | "edit" | "execute"
  target?: string
  command?: string
  metadata?: Record<string, unknown>
}
```

### PolicyDecision

PolicyDecision 表示 AgentScope 对某次 ToolEvent 的判断。

```ts
type PolicyDecision = {
  decision: "allow" | "deny" | "ask" | "warn"
  reason: string
  matched_rule?: string
  risk_delta?: number
}
```

## V1.2 不要修改 PolicyEngine 语义

V1.2 的重点是安装器。

不要在本阶段大改：

* ToolEvent schema
* PolicyDecision schema
* PolicyEngine precedence
* CommandMatcher semantics
* ScopeContract schema

如发现必须修改，请保持最小改动并补充测试。

## Token 成本原则

AgentScope 不应该成为上下文膨胀器。

必须遵守：

1. 默认使用本地确定性逻辑
2. 不默认调用 LLM 推断 scope
3. 不把完整 policy registry 注入 Claude
4. 不把 evidence.json 注入 Claude
5. 只向 agent 注入最小必要 scope 摘要
6. 风险计算、diff 检查、evidence 生成都应在本地完成
7. Hook deny / ask 返回信息必须简短
8. settings installer 不应注入长 prompt

原则：

Use tokens only to inform the agent.
Use deterministic local code to govern the agent.

## 技术栈

继续使用：

* TypeScript
* Node.js
* pnpm
* Commander
* Zod
* yaml
* picomatch
* execa 或 child_process 调用 git
* Vitest

当前项目使用 single-package layout：

* `src/core`
* `src/cli`

V1.2 继续保持 single-package layout。

不要为了 V1.2 强行迁移 monorepo。

## 目录结构建议

当前阶段建议保持：

```txt
src/
  cli/
  core/
    schema/
    scope/
    config/
    git/
    check/
    policy/
    events/
    evidence/
    risk/
    adapters/
      claude-code/
```

V1.2 优先新增：

```txt
src/core/adapters/claude-code/
  settings.ts
  settings-transform.ts
  settings-backup.ts
```

CLI 可新增或扩展：

```txt
src/cli/commands/install.ts
src/cli/commands/uninstall.ts
```

也可以使用：

```txt
src/cli/commands/claude-code.ts
```

但命令必须是：

```bash
agentscope install claude-code
agentscope uninstall claude-code
```

## 代码设计原则

1. Core logic 不依赖 CLI
2. Claude Code 只能作为 adapter
3. settings transform 必须是纯函数优先
4. 文件写入逻辑和 transform 逻辑分离
5. CLI 只做编排
6. 所有 settings fixture 必须测试
7. 不要破坏已有 settings
8. 不要重复插入 hook
9. 不要默认写共享 settings
10. 不要把策略逻辑写进 installer
11. 不要在 V1.2 引入 Evidence/Risk 大功能

## 测试要求

V1.2 至少覆盖：

### Settings transform

* empty settings → inject AgentScope PreToolUse hook
* existing unrelated hooks preserved
* existing PreToolUse hooks preserved
* repeated install is idempotent
* existing AgentScope hook gets updated
* shared/local target path resolved correctly
* malformed JSON does not overwrite
* uninstall removes only AgentScope hook
* uninstall preserves unrelated hooks

### CLI behavior

* `agentscope install claude-code --dry-run`
* `agentscope install claude-code`
* `agentscope install claude-code --shared`
* `agentscope uninstall claude-code`
* missing `.claude/` directory gets created
* backup file created before write

### Hook command

* generated command contains `agentscope hook claude-code pre-tool-use`
* command is short
* command is cross-platform safe enough for Windows / macOS / Linux

## 当前优先级

当前最高优先级：

1. 不破坏 V0 / V1.0 / V1.1
2. 安全安装 Claude Code hook
3. 默认写入 `.claude/settings.local.json`
4. 支持 `--shared`
5. 支持 `--dry-run`
6. 支持 uninstall
7. settings transform 测试充分
8. 不实现 Evidence/Risk/CI
