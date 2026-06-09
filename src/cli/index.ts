import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { startCommand } from "./commands/start.js";
import { showCommand } from "./commands/show.js";
import { checkCommand } from "./commands/check.js";
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

async function main(): Promise<void> {
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    console.error(color.red(`Unexpected error: ${(err as Error).message}`));
    process.exitCode = 1;
  }
}

void main();
