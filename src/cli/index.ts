import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { startCommand, type StartOptions } from "./commands/start.js";
import { showCommand } from "./commands/show.js";
import { checkCommand } from "./commands/check.js";
import { hookClaudeCodePreToolUseCommand } from "./commands/hook.js";
import { installClaudeCodeCommand } from "./commands/install.js";
import { uninstallClaudeCodeCommand } from "./commands/uninstall.js";
import {
  evidenceShowCommand,
  evidenceClearCommand,
} from "./commands/evidence.js";
import { reportCommand } from "./commands/report.js";
import { riskCommand } from "./commands/risk.js";
import { gateCommand, type GateCommandOptions } from "./commands/gate.js";
import {
  configShowCommand,
  configValidateCommand,
} from "./commands/config.js";
import {
  scopeExplainCommand,
  scopeDiffCommand,
  scopeApplyCommand,
} from "./commands/scope.js";
import {
  scopeListCommand,
  scopeUseCommand,
} from "./commands/scope-history.js";
import { collect } from "./override-flags.js";
import { color } from "./ui.js";

const program = new Command();

program
  .name("agentscope")
  .description("Task-scoped runtime governance for AI coding agents.")
  .version("0.1.0");

program
  .command("init")
  .description("Create .agentscope/ with default config")
  .action(() => {
    initCommand();
  });

program
  .command("start")
  .description("Infer a Task Scope Contract from a task and approve it")
  .argument("<task>", "natural language task description")
  .option("--dry-run", "Show the inferred scope without writing or prompting")
  .option("--json", "Output the inferred scope as JSON (no write, no prompt)")
  .option("--add-allowed <pattern>", "Add an allowed path (repeatable)", collect, [])
  .option("--remove-allowed <pattern>", "Remove an allowed path (repeatable)", collect, [])
  .option("--add-blocked <pattern>", "Add a blocked path (repeatable)", collect, [])
  .option("--remove-blocked <pattern>", "Remove a blocked path (repeatable)", collect, [])
  .option("--add-high-risk <pattern>", "Add a high-risk path (repeatable)", collect, [])
  .option("--remove-high-risk <pattern>", "Remove a high-risk path (repeatable)", collect, [])
  .option("--add-command <command>", "Add an allowed command (repeatable)", collect, [])
  .option("--remove-command <command>", "Remove an allowed command (repeatable)", collect, [])
  .action(async (task: string, options: StartOptions) => {
    await startCommand(task, options);
  });

program
  .command("show")
  .description("Show the current Task Scope Contract")
  .action(() => {
    showCommand();
  });

program
  .command("check")
  .description("Check current git changes against the active scope")
  .action(() => {
    checkCommand();
  });

// `agentscope hook claude-code pre-tool-use`
// Hook translator: stdin payload -> policy decision -> stdout response.
const hook = program
  .command("hook")
  .description("Agent hook entrypoints");

const hookClaudeCode = hook
  .command("claude-code")
  .description("Claude Code hook entrypoints");

hookClaudeCode
  .command("pre-tool-use")
  .description(
    "Evaluate a Claude Code PreToolUse payload from stdin and emit a hook response on stdout",
  )
  .action(async () => {
    await hookClaudeCodePreToolUseCommand();
  });

// `agentscope install claude-code [--shared] [--dry-run]`
const install = program
  .command("install")
  .description("Install AgentScope into an agent's settings");

install
  .command("claude-code")
  .description("Install the AgentScope PreToolUse hook into Claude Code settings")
  .option("--shared", "Target .claude/settings.json instead of settings.local.json")
  .option("--dry-run", "Show what would change without writing any files")
  .action((options: { shared?: boolean; dryRun?: boolean }) => {
    installClaudeCodeCommand(options);
  });

// `agentscope uninstall claude-code [--shared]`
const uninstall = program
  .command("uninstall")
  .description("Remove AgentScope from an agent's settings");

uninstall
  .command("claude-code")
  .description("Remove the AgentScope PreToolUse hook from Claude Code settings")
  .option("--shared", "Target .claude/settings.json instead of settings.local.json")
  .action((options: { shared?: boolean }) => {
    uninstallClaudeCodeCommand(options);
  });

// `agentscope evidence show|clear`
const evidence = program
  .command("evidence")
  .description("Inspect or clear the local Evidence Package");

evidence
  .command("show")
  .description("Show a summary of recorded policy decisions")
  .option("--json", "Print the raw evidence JSON instead of a summary")
  .action((options: { json?: boolean }) => {
    evidenceShowCommand(options);
  });

evidence
  .command("clear")
  .description("Delete .agentscope/evidence/latest.json")
  .action(() => {
    evidenceClearCommand();
  });

// `agentscope report`
program
  .command("report")
  .description("Print an audit summary (counts, denied/asked actions, risk score) from the Evidence Package")
  .action(() => {
    reportCommand();
  });

// `agentscope gate [--json] [--allow-missing-evidence]`
program
  .command("gate")
  .description("Evaluate the local policy gate from evidence, risk, and config")
  .option("--json", "Output the full GateResultV1 as JSON")
  .option("--allow-missing-evidence", "Skip the gate when evidence/latest.json is missing")
  .action((options: GateCommandOptions) => {
    gateCommand(options);
  });

// `agentscope risk [--json]`
program
  .command("risk")
  .description("Compute a deterministic risk score from the Evidence Package")
  .option("--json", "Print the full RiskScoreV1 JSON instead of a summary")
  .action((options: { json?: boolean }) => {
    riskCommand(options);
  });

// `agentscope config show|validate`
const config = program
  .command("config")
  .description("Inspect or validate the effective project config");

config
  .command("show")
  .description("Show the normalized effective config")
  .option("--json", "Print the effective config as JSON")
  .action((options: { json?: boolean }) => {
    configShowCommand(options);
  });

config
  .command("validate")
  .description("Validate .agentscope/config.yaml")
  .action(() => {
    configValidateCommand();
  });

// `agentscope scope explain|list|use|diff|apply`
const scope = program
  .command("scope")
  .description("Review, restore, diff, and override Task Scope Contracts");

scope
  .command("explain")
  .description("Explain the active scope (paths, commands, rationale)")
  .option("--json", "Output the active scope as JSON")
  .action((options: { json?: boolean }) => {
    scopeExplainCommand(options);
  });

scope
  .command("list")
  .description("List saved historical task scopes")
  .option("--json", "Output saved scopes as JSON")
  .action((options: { json?: boolean }) => {
    scopeListCommand(options);
  });

scope
  .command("use")
  .description("Restore a historical task scope to current-scope.yaml")
  .argument("<task-id>", "saved task id")
  .option("--json", "Output the restored scope as JSON")
  .action((taskId: string, options: { json?: boolean }) => {
    scopeUseCommand(taskId, options);
  });

scope
  .command("diff")
  .description("Diff the active scope against a saved historical scope")
  .requiredOption("--task <task-id>", "saved task id to compare against")
  .option("--json", "Output the diff as JSON")
  .action((options: { task?: string; json?: boolean }) => {
    scopeDiffCommand(options);
  });

scope
  .command("apply")
  .description("Apply override flags to the active scope (writes current-scope.yaml)")
  .option("--dry-run", "Show the patched scope without writing")
  .option("--json", "Output the patched scope as JSON (no write)")
  .option("--add-allowed <pattern>", "Add an allowed path (repeatable)", collect, [])
  .option("--remove-allowed <pattern>", "Remove an allowed path (repeatable)", collect, [])
  .option("--add-blocked <pattern>", "Add a blocked path (repeatable)", collect, [])
  .option("--remove-blocked <pattern>", "Remove a blocked path (repeatable)", collect, [])
  .option("--add-high-risk <pattern>", "Add a high-risk path (repeatable)", collect, [])
  .option("--remove-high-risk <pattern>", "Remove a high-risk path (repeatable)", collect, [])
  .option("--add-command <command>", "Add an allowed command (repeatable)", collect, [])
  .option("--remove-command <command>", "Remove an allowed command (repeatable)", collect, [])
  .action((options: Parameters<typeof scopeApplyCommand>[0]) => {
    scopeApplyCommand(options);
  });

async function main(): Promise<void> {
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    console.error(color.red(`Unexpected error: ${(err as Error).message}`));
    process.exitCode = 1;
  }
}

void main();
