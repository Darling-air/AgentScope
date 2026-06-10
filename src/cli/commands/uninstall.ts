import {
  uninstallClaudeHook,
  SettingsParseError,
} from "../../core/adapters/claude-code/settings.js";
import { color } from "../ui.js";
import path from "node:path";

export interface UninstallOptions {
  shared?: boolean;
}

function rel(p: string): string {
  const r = path.relative(process.cwd(), p);
  return r && !r.startsWith("..") ? r.split(path.sep).join("/") : p;
}

/**
 * `agentscope uninstall claude-code [--shared]`
 *
 * Removes only the AgentScope PreToolUse hook from the project's Claude Code
 * settings, preserving any other hooks. Defaults to .claude/settings.local.json;
 * --shared targets .claude/settings.json.
 */
export function uninstallClaudeCodeCommand(options: UninstallOptions): void {
  let result;
  try {
    result = uninstallClaudeHook({
      cwd: process.cwd(),
      shared: options.shared,
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

  if (result.noop) {
    console.log(
      color.yellow("No AgentScope Claude Code hook found; nothing to remove."),
    );
    console.log("");
    console.log(color.cyan("Target:"));
    console.log(`  ${rel(result.settingsPath)}`);
    process.exitCode = 0;
    return;
  }

  console.log(color.green("AgentScope Claude Code hook removed."));
  console.log("");
  console.log(color.cyan("Target:"));
  console.log(`  ${rel(result.settingsPath)}`);
  process.exitCode = 0;
}
