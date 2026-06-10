import type { ClaudePreToolUsePayload } from "./pre-tool-use-payload.js";
import type { ToolEvent } from "../../events/tool-event.js";
import { normalizeTargetPath } from "./path-normalizer.js";

/**
 * Translates a Claude Code PreToolUse payload into an agent-agnostic ToolEvent.
 *
 * Read / Edit / Write / Bash map to their natural shapes. Any other tool name
 * becomes a `custom` tool_call carrying whatever `file_path`/`command` we can
 * find, so the PolicyEngine can fall back to `ask` rather than crashing.
 *
 * The event id and timestamp are injected by the caller so the translator
 * stays pure and deterministic (easy to test). The CLI entrypoint supplies
 * real values at runtime.
 */
export interface TranslateOptions {
  id: string;
  timestamp: string;
}

function readFilePath(input: Record<string, unknown>): string | undefined {
  const value = input.file_path;
  return typeof value === "string" ? value : undefined;
}

/**
 * Resolve the file_path for a file event into a normalized ToolEvent.target.
 *
 * Claude Code may report an absolute path (POSIX or Windows) while the scope's
 * blocked/allowed globs are written repo-relative with `/`. We normalize the
 * path against `payload.cwd` so e.g. `G:/AgentScope/.env.local` becomes
 * `.env.local` and is correctly matched by `blocked_paths`.
 */
function resolveTarget(
  payload: ClaudePreToolUsePayload,
): string | undefined {
  const raw = readFilePath(payload.tool_input);
  if (raw === undefined) {
    return undefined;
  }
  return normalizeTargetPath(raw, payload.cwd);
}

function readCommand(input: Record<string, unknown>): string | undefined {
  const value = input.command;
  return typeof value === "string" ? value : undefined;
}

export function translatePreToolUsePayload(
  payload: ClaudePreToolUsePayload,
  options: TranslateOptions,
): ToolEvent {
  const base = {
    id: options.id,
    timestamp: options.timestamp,
    agent: "claude-code",
  } as const;

  switch (payload.tool_name) {
    case "Read":
      return {
        ...base,
        event_type: "tool_call",
        tool_source: "builtin",
        tool_name: "Read",
        action: "read",
        target: resolveTarget(payload),
      };

    case "Edit":
      return {
        ...base,
        event_type: "tool_call",
        tool_source: "builtin",
        tool_name: "Edit",
        action: "edit",
        target: resolveTarget(payload),
      };

    case "Write":
      return {
        ...base,
        event_type: "tool_call",
        tool_source: "builtin",
        tool_name: "Write",
        action: "write",
        target: resolveTarget(payload),
      };

    case "Bash":
      return {
        ...base,
        event_type: "command",
        tool_source: "shell",
        tool_name: "Bash",
        action: "execute",
        command: readCommand(payload.tool_input),
      };

    default:
      // Unsupported tool: keep the original name, mark as custom, and carry
      // any path/command we recognize. The PolicyEngine handles this as a
      // safe `ask` fallback.
      return {
        ...base,
        event_type: "tool_call",
        tool_source: "custom",
        tool_name: payload.tool_name,
        target: resolveTarget(payload),
        command: readCommand(payload.tool_input),
      };
  }
}
