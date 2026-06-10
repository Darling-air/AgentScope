import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { startCommand } from "./commands/start.js";
import { showCommand } from "./commands/show.js";
import { checkCommand } from "./commands/check.js";
import { hookClaudeCodePreToolUseCommand } from "./commands/hook.js";
import { installClaudeCodeCommand } from "./commands/install.js";
import { uninstallClaudeCodeCommand } from "./commands/uninstall.js";
import { color } from "./ui.js";

const program = new Command();

program
  .name("agentscope")
  .description(
    "Least-privilege, task-scoped governance for AI coding agents (V0 prototype).",
  )
  .version("0.0.0");

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
  .action(async (task: string) => {
    await startCommand(task);
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
// Dry-run hook translator: stdin payload -> policy decision -> stdout response.
const hook = program
  .command("hook")
  .description("Agent hook entrypoints (dry-run in V1.1)");

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

async function main(): Promise<void> {
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    console.error(color.red(`Unexpected error: ${(err as Error).message}`));
    process.exitCode = 1;
  }
}

void main();
