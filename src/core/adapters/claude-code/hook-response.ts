import type { PolicyDecision } from "../../policy/policy-decision.js";

/**
 * Claude Code PreToolUse hook response.
 *
 * Claude Code reads this JSON from the hook's stdout and applies the
 * `permissionDecision`. We keep reasons short on purpose — the response is fed
 * back to the agent, so it must not leak the full scope, policy, or roadmap,
 * and must never contain a stack trace.
 */
export interface ClaudeHookResponse {
  hookSpecificOutput: {
    hookEventName: "PreToolUse";
    permissionDecision: "allow" | "deny" | "ask";
    permissionDecisionReason: string;
  };
}

/** Trim a reason to a single short line, with a hard cap, for agent feedback. */
function shortReason(reason: string, max = 160): string {
  const oneLine = reason.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Maps an AgentScope PolicyDecision to a Claude Code hook response.
 *
 * allow -> allow
 * deny  -> deny  ("Blocked by AgentScope: ...")
 * ask   -> ask   ("AgentScope requires confirmation: ...")
 * warn  -> ask   ("AgentScope warning requires confirmation: ...")  [V1.1]
 */
export function mapPolicyDecisionToClaudeHookResponse(
  decision: PolicyDecision,
): ClaudeHookResponse {
  const reason = shortReason(decision.reason);

  let permissionDecision: ClaudeHookResponse["hookSpecificOutput"]["permissionDecision"];
  let permissionDecisionReason: string;

  switch (decision.decision) {
    case "allow":
      permissionDecision = "allow";
      permissionDecisionReason = "AgentScope allowed this action.";
      break;
    case "deny":
      permissionDecision = "deny";
      permissionDecisionReason = `Blocked by AgentScope: ${reason}`;
      break;
    case "warn":
      permissionDecision = "ask";
      permissionDecisionReason = `AgentScope warning requires confirmation: ${reason}`;
      break;
    case "ask":
    default:
      permissionDecision = "ask";
      permissionDecisionReason = `AgentScope requires confirmation: ${reason}`;
      break;
  }

  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision,
      permissionDecisionReason,
    },
  };
}
