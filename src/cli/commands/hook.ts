import { runClaudePreToolUseHook } from "../../core/adapters/claude-code/hook-entrypoint.js";

/** Reads all of stdin as a string. Resolves "" if stdin is empty/closed. */
function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    const stdin = process.stdin;

    // If stdin is a TTY with no piped input, don't hang forever.
    if (stdin.isTTY) {
      resolve("");
      return;
    }

    stdin.setEncoding("utf8");
    stdin.on("data", (chunk) => {
      data += chunk;
    });
    stdin.on("end", () => resolve(data));
    stdin.on("error", () => resolve(data));
  });
}

/**
 * `agentscope hook claude-code pre-tool-use`
 *
 * Dry-run hook: reads a Claude Code PreToolUse payload from stdin, evaluates it
 * against the active scope, and writes a Claude Code hook response to stdout.
 *
 * This never crashes on bad input — invalid JSON or a missing scope produces a
 * safe `ask` response and exit code 0, so a misconfigured hook keeps the human
 * in the loop instead of breaking the agent.
 */
export async function hookClaudeCodePreToolUseCommand(): Promise<void> {
  const raw = await readStdin();

  let payload: unknown;
  if (raw.trim() === "") {
    payload = undefined; // entrypoint will degrade to a safe ask
  } else {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = undefined; // invalid JSON -> safe ask
    }
  }

  const response = await runClaudePreToolUseHook(payload);
  process.stdout.write(`${JSON.stringify(response)}\n`);
  process.exitCode = 0;
}
