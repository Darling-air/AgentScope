import { existsSync } from "node:fs";
import { ClaudePreToolUsePayloadSchema } from "./pre-tool-use-payload.js";
import { translatePreToolUsePayload } from "./pre-tool-use-translator.js";
import {
  mapPolicyDecisionToClaudeHookResponse,
  type ClaudeHookResponse,
} from "./hook-response.js";
import { getProjectPaths } from "../../fs/project-paths.js";
import { loadConfig } from "../../config/load-config.js";
import { readScope } from "../../scope/scope-io.js";
import {
  evaluateToolEvent,
  DEFAULT_DANGEROUS_COMMANDS,
} from "../../policy/policy-engine.js";

/**
 * Dry-run Claude Code PreToolUse hook entrypoint.
 *
 * Given a raw hook payload (already JSON-parsed, or any unknown value) and a
 * working directory, this resolves the active scope + config, runs the
 * PolicyEngine, and returns a Claude Code hook response.
 *
 * It is designed to NEVER throw: any failure (invalid payload, missing scope,
 * unreadable config) degrades to a safe `ask` response with a short reason, so
 * a misconfigured hook keeps the human in the loop rather than crashing the
 * agent or silently allowing an action.
 */
function safeAsk(reason: string): ClaudeHookResponse {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: `AgentScope requires confirmation: ${reason}`,
    },
  };
}

export async function runClaudePreToolUseHook(
  inputJson: unknown,
  cwd: string = process.cwd(),
): Promise<ClaudeHookResponse> {
  // 1. Validate the payload shape.
  const parsed = ClaudePreToolUsePayloadSchema.safeParse(inputJson);
  if (!parsed.success) {
    return safeAsk("could not parse a valid PreToolUse payload");
  }
  const payload = parsed.data;

  // 2. Resolve the project root (payload.cwd wins if present and usable).
  const root = payload.cwd && existsSync(payload.cwd) ? payload.cwd : cwd;
  const paths = getProjectPaths(root);

  // 3. Require an active scope; without one we cannot make a scoped decision.
  if (!existsSync(paths.currentScopeFile)) {
    return safeAsk(
      'no active scope found; run agentscope start "<task>" first',
    );
  }

  let scope;
  try {
    scope = readScope(paths.currentScopeFile);
  } catch {
    return safeAsk("the active scope file is missing or invalid");
  }

  // 4. Load dangerous commands from config; fall back to defaults on any error.
  let dangerousCommands = DEFAULT_DANGEROUS_COMMANDS;
  try {
    dangerousCommands = loadConfig(paths).defaults.dangerous_commands;
  } catch {
    // Keep defaults; an invalid config should not weaken enforcement.
    dangerousCommands = DEFAULT_DANGEROUS_COMMANDS;
  }

  // 5. Translate -> evaluate -> map to a Claude response.
  const event = translatePreToolUsePayload(payload, {
    id: makeEventId(payload.session_id),
    timestamp: new Date().toISOString(),
  });

  const decision = evaluateToolEvent(scope, event, { dangerousCommands });
  return mapPolicyDecisionToClaudeHookResponse(decision);
}

/** Builds a best-effort unique event id; the value is not security-sensitive. */
function makeEventId(sessionId?: string): string {
  const suffix = Math.random().toString(36).slice(2, 10);
  return sessionId ? `${sessionId}:${suffix}` : `evt-${suffix}`;
}
