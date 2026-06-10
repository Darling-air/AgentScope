import type { ScopeContract } from "../schema/scope-contract.js";
import type { ToolEvent } from "../events/tool-event.js";
import type { PolicyDecision } from "./policy-decision.js";
import { findMatchingPattern } from "./path-matcher.js";
import { findMatchingCommand } from "./command-matcher.js";

/**
 * PolicyEngine (V1.0).
 *
 * Deterministic, agent-agnostic. Given a ScopeContract and a ToolEvent, it
 * returns a single PolicyDecision. No network, no LLM, no agent-specific logic.
 *
 * Rule precedence (architecture.md §7 — deny wins):
 *   1. blocked_paths
 *   2. dangerous_commands
 *   3. high_risk
 *   4. allowed_paths
 *   5. allowed_commands
 *   6. fallback (ask)
 */

/**
 * Default dangerous command patterns. ScopeContract does not (yet) carry a
 * dangerous_commands field, so the engine uses these unless the caller passes
 * an explicit list (e.g. sourced from config defaults). Kept in sync with the
 * defaults written by `agentscope init`.
 */
export const DEFAULT_DANGEROUS_COMMANDS: string[] = [
  "rm -rf *",
  "curl * | sh",
  "wget * | sh",
  "git push --force",
  "sudo *",
];

export interface PolicyEngineOptions {
  /** Dangerous command patterns; defaults to DEFAULT_DANGEROUS_COMMANDS. */
  dangerousCommands?: string[];
}

/** True when the event represents a file read. */
function isReadEvent(event: ToolEvent): boolean {
  return event.tool_name === "Read" || event.action === "read";
}

/** True when the event represents a file edit/write. */
function isWriteEvent(event: ToolEvent): boolean {
  return (
    event.tool_name === "Edit" ||
    event.tool_name === "Write" ||
    event.action === "edit" ||
    event.action === "write"
  );
}

/** True when the event represents a shell command execution. */
function isCommandEvent(event: ToolEvent): boolean {
  return (
    event.tool_name === "Bash" ||
    event.action === "execute" ||
    event.event_type === "command"
  );
}

function evaluateRead(scope: ScopeContract, target: string): PolicyDecision {
  const blocked = findMatchingPattern(target, scope.blocked_paths);
  if (blocked) {
    return {
      decision: "deny",
      reason: `${target} matches blocked path ${blocked}`,
      matched_rule: `blocked_paths:${blocked}`,
      risk_delta: 20,
    };
  }
  // Reads of anything not blocked are allowed.
  return {
    decision: "allow",
    reason: `${target} is not a blocked path; read allowed`,
    risk_delta: 0,
  };
}

function evaluateWrite(scope: ScopeContract, target: string): PolicyDecision {
  const blocked = findMatchingPattern(target, scope.blocked_paths);
  if (blocked) {
    return {
      decision: "deny",
      reason: `${target} matches blocked path ${blocked}`,
      matched_rule: `blocked_paths:${blocked}`,
      risk_delta: 40,
    };
  }

  const highRisk = findMatchingPattern(target, scope.high_risk);
  if (highRisk) {
    return {
      decision: "ask",
      reason: `${target} matches high risk path ${highRisk}`,
      matched_rule: `high_risk:${highRisk}`,
      risk_delta: 25,
    };
  }

  const allowed = findMatchingPattern(target, scope.allowed_paths);
  if (allowed) {
    return {
      decision: "allow",
      reason: `${target} matches allowed path ${allowed}`,
      matched_rule: `allowed_paths:${allowed}`,
      risk_delta: -10,
    };
  }

  return {
    decision: "ask",
    reason: `${target} is not in allowed_paths`,
    matched_rule: "allowed_paths",
    risk_delta: 15,
  };
}

function evaluateCommand(
  scope: ScopeContract,
  command: string,
  dangerousCommands: string[],
): PolicyDecision {
  const dangerous = findMatchingCommand(command, dangerousCommands);
  if (dangerous) {
    return {
      decision: "deny",
      reason: `Command matches dangerous pattern ${dangerous}`,
      matched_rule: `dangerous_commands:${dangerous}`,
      risk_delta: 40,
    };
  }

  const allowed = findMatchingCommand(command, scope.allowed_commands);
  if (allowed) {
    return {
      decision: "allow",
      reason: `Command matches allowed command ${allowed}`,
      matched_rule: `allowed_commands:${allowed}`,
      risk_delta: -10,
    };
  }

  return {
    decision: "ask",
    reason: "Command is not listed in allowed_commands",
    matched_rule: "allowed_commands",
    risk_delta: 10,
  };
}

/**
 * Evaluates a single ToolEvent against a ScopeContract and returns a decision.
 *
 * File events with no `target` and command events with no `command` cannot be
 * classified; they fall back to `ask` so the human stays in the loop.
 */
export function evaluateToolEvent(
  scope: ScopeContract,
  event: ToolEvent,
  options: PolicyEngineOptions = {},
): PolicyDecision {
  const dangerousCommands =
    options.dangerousCommands ?? DEFAULT_DANGEROUS_COMMANDS;

  // Command events first when clearly a command, so a missing target on a Bash
  // event does not get misrouted into the file rules.
  if (isCommandEvent(event)) {
    const command = event.command?.trim();
    if (!command) {
      return {
        decision: "ask",
        reason: "Command event has no command string to evaluate",
        matched_rule: "fallback",
        risk_delta: 10,
      };
    }
    return evaluateCommand(scope, command, dangerousCommands);
  }

  if (isReadEvent(event)) {
    if (!event.target) {
      return {
        decision: "ask",
        reason: "Read event has no target to evaluate",
        matched_rule: "fallback",
        risk_delta: 10,
      };
    }
    return evaluateRead(scope, event.target);
  }

  if (isWriteEvent(event)) {
    if (!event.target) {
      return {
        decision: "ask",
        reason: "Write event has no target to evaluate",
        matched_rule: "fallback",
        risk_delta: 10,
      };
    }
    return evaluateWrite(scope, event.target);
  }

  // Unknown tool: stay safe, ask the human.
  return {
    decision: "ask",
    reason: `Unrecognized tool event (tool_name=${event.tool_name ?? "?"}); deferring to human`,
    matched_rule: "fallback",
    risk_delta: 10,
  };
}
