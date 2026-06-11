import { existsSync } from "node:fs";
import { ClaudePreToolUsePayloadSchema } from "./pre-tool-use-payload.js";
import { translatePreToolUsePayload } from "./pre-tool-use-translator.js";
import {
  mapPolicyDecisionToClaudeHookResponse,
  type ClaudeHookResponse,
} from "./hook-response.js";
import { getProjectPaths } from "../../fs/project-paths.js";
import { loadConfigResult } from "../../config/load-config.js";
import { readScope } from "../../scope/scope-io.js";
import {
  evaluateToolEvent,
  DEFAULT_DANGEROUS_COMMANDS,
} from "../../policy/policy-engine.js";
import { buildEvidenceEvent, recordEvidence } from "../../evidence/index.js";
import type { ScopeContract } from "../../schema/scope-contract.js";
import type { ToolEvent } from "../../events/tool-event.js";
import type { PolicyDecision } from "../../policy/policy-decision.js";
import type { ClaudePreToolUsePayload } from "./pre-tool-use-payload.js";

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

  // 4. Load dangerous commands from the effective config; fall back to defaults
  // on any error. An invalid/unreadable config must never weaken enforcement
  // or crash the hook, so loadConfigResult never throws and we keep the safe
  // built-in dangerous-command list when it fails.
  let dangerousCommands = DEFAULT_DANGEROUS_COMMANDS;
  const configResult = loadConfigResult(paths);
  if (configResult.ok) {
    dangerousCommands = configResult.config.policy.dangerous_commands;
  }

  // 5. Translate -> evaluate -> map to a Claude response.
  const event = translatePreToolUsePayload(payload, {
    id: makeEventId(payload.session_id),
    timestamp: new Date().toISOString(),
  });

  const decision = evaluateToolEvent(scope, event, { dangerousCommands });

  // 6. Best-effort: append an evidence event. This must never affect the
  // returned response, so any failure is swallowed silently here.
  recordEvidenceBestEffort(paths.evidenceLatestFile, scope, event, decision, payload);

  return mapPolicyDecisionToClaudeHookResponse(decision);
}

/**
 * Records one evidence event for this decision. Deliberately swallows every
 * error: evidence is an audit side effect and must never break enforcement or
 * change the hook response. Nothing is written to stdout/stderr here.
 */
function recordEvidenceBestEffort(
  latestFile: string,
  scope: ScopeContract,
  toolEvent: ToolEvent,
  decision: PolicyDecision,
  payload: ClaudePreToolUsePayload,
): void {
  try {
    const now = new Date().toISOString();
    const evidenceEvent = buildEvidenceEvent({
      id: toolEvent.id,
      timestamp: toolEvent.timestamp,
      agent: {
        name: "claude-code",
        session_id: payload.session_id,
        transcript_path: payload.transcript_path,
      },
      toolEvent,
      decision,
    });
    recordEvidence({ latestFile, scope, event: evidenceEvent, now });
  } catch {
    // Never let evidence recording affect the hook response.
  }
}

/** Builds a best-effort unique event id; the value is not security-sensitive. */
function makeEventId(sessionId?: string): string {
  const suffix = Math.random().toString(36).slice(2, 10);
  return sessionId ? `${sessionId}:${suffix}` : `evt-${suffix}`;
}
