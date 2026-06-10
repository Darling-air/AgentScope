import { describe, it, expect } from "vitest";
import { mapPolicyDecisionToClaudeHookResponse } from "./hook-response.js";
import type { PolicyDecision } from "../../policy/policy-decision.js";

function decision(partial: Partial<PolicyDecision>): PolicyDecision {
  return { decision: "ask", reason: "because", ...partial };
}

describe("mapPolicyDecisionToClaudeHookResponse", () => {
  it("maps allow -> allow", () => {
    const r = mapPolicyDecisionToClaudeHookResponse(
      decision({ decision: "allow", reason: "src/auth/login.ts allowed" }),
    );
    expect(r.hookSpecificOutput.hookEventName).toBe("PreToolUse");
    expect(r.hookSpecificOutput.permissionDecision).toBe("allow");
    expect(r.hookSpecificOutput.permissionDecisionReason).toBe(
      "AgentScope allowed this action.",
    );
  });

  it("maps deny -> deny with a Blocked-by-AgentScope reason", () => {
    const r = mapPolicyDecisionToClaudeHookResponse(
      decision({ decision: "deny", reason: ".env.local matches blocked path .env*" }),
    );
    expect(r.hookSpecificOutput.permissionDecision).toBe("deny");
    expect(r.hookSpecificOutput.permissionDecisionReason).toMatch(
      /^Blocked by AgentScope: /,
    );
  });

  it("maps ask -> ask", () => {
    const r = mapPolicyDecisionToClaudeHookResponse(
      decision({ decision: "ask", reason: "package.json is high risk" }),
    );
    expect(r.hookSpecificOutput.permissionDecision).toBe("ask");
    expect(r.hookSpecificOutput.permissionDecisionReason).toMatch(
      /^AgentScope requires confirmation: /,
    );
  });

  it("maps warn -> ask", () => {
    const r = mapPolicyDecisionToClaudeHookResponse(
      decision({ decision: "warn", reason: "heads up" }),
    );
    expect(r.hookSpecificOutput.permissionDecision).toBe("ask");
    expect(r.hookSpecificOutput.permissionDecisionReason).toMatch(
      /^AgentScope warning requires confirmation: /,
    );
  });

  it("keeps the reason short and single-line", () => {
    const long = "x ".repeat(500);
    const r = mapPolicyDecisionToClaudeHookResponse(
      decision({ decision: "deny", reason: long }),
    );
    const reason = r.hookSpecificOutput.permissionDecisionReason;
    expect(reason.length).toBeLessThanOrEqual(200);
    expect(reason).not.toContain("\n");
  });
});
