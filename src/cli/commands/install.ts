import {
  installClaudeHook,
  SettingsParseError,
  type InstallResult,
} from "../../core/adapters/claude-code/settings.js";
import { color } from "../ui.js";
import path from "node:path";

export interface InstallOptions {
  shared?: boolean;
  dryRun?: boolean;
}

/** Renders a path relative to cwd for tidy output, falling back to absolute. */
function rel(p: string): string {
  const r = path.relative(process.cwd(), p);
  return r && !r.startsWith("..") ? r.split(path.sep).join("/") : p;
}

function printHookBlock(result: InstallResult): void {
  console.log(color.cyan("Hook:"));
  console.log(`  PreToolUse matcher: ${result.matcher}`);
  console.log(`  Command: ${result.command}`);
}

/**
 * `agentscope install claude-code [--shared] [--dry-run]`
 *
 * Installs the AgentScope PreToolUse hook into the project's Claude Code
 * settings. Defaults to .claude/settings.local.json; --shared targets
 * .claude/settings.json. --dry-run prints what would change and writes nothing.
 */
export function installClaudeCodeCommand(options: InstallOptions): void {
  let result: InstallResult;
  try {
    result = installClaudeHook({
      cwd: process.cwd(),
      shared: options.shared,
      dryRun: options.dryRun,
    });
  } catch (err) {
    if (err instanceof SettingsParseError) {
      console.error(color.red(err.message));
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  console.log("");

  if (result.dryRun) {
    console.log(color.bold("AgentScope Claude Code hook install dry-run"));
    console.log("");
    console.log(color.cyan("Target:"));
    console.log(`  ${rel(result.settingsPath)}`);
    console.log("");
    printHookBlock(result);
    console.log("");
    console.log(color.cyan("After (settings preview):"));
    for (const line of result.after.trimEnd().split("\n")) {
      console.log(`  ${line}`);
    }
    console.log("");
    console.log(color.dim("No files were modified."));
    process.exitCode = 0;
    return;
  }

  console.log(color.green("AgentScope Claude Code hook installed."));
  console.log("");
  console.log(color.cyan("Target:"));
  console.log(`  ${rel(result.settingsPath)}`);
  console.log("");
  printHookBlock(result);
  console.log("");
  console.log(color.cyan("Backup:"));
  if (result.backup?.created) {
    console.log(`  ${rel(result.backup.backupPath)}`);
  } else if (result.backup?.alreadyExisted) {
    console.log(
      `  ${rel(result.backup.backupPath)} ${color.dim("(existing backup kept)")}`,
    );
  } else {
    console.log(color.dim("  (no prior settings file; nothing to back up)"));
  }

  if (result.updatedExisting) {
    console.log("");
    console.log(color.dim("Updated the existing AgentScope hook (idempotent)."));
  }
  process.exitCode = 0;
}
