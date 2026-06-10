import { describe, it, expect } from "vitest";
import { calculateRiskScore } from "./risk-engine.js";
import type { EvidencePackageV1 } from "../evidence/evidence-package.js";
import type { EvidenceEvent } from "../evidence/evidence-event.js";
import type { PolicyDecision } from "../policy/policy-decision.js";
import type { ToolEvent } from "../events/tool-event.js";

let counter = 0;
function nextId(): string {
  counter += 1;
  return `evt-${counter}`;
}

interface EventSpec {
  decision: PolicyDecision["decision"];
  toolName?: string;
  action?: ToolEvent["action"];
  target?: string;
  command?: string;
  matchedRule?: string;
  riskDelta?: number;
}

function makeEvent(spec: EventSpec): EvidenceEvent {
  const id = nextId();
  const toolEvent: ToolEvent = {
    id,
    timestamp: "2026-06-10T10:00:00.000Z",
    agent: "claude-code",
    event_type: spec.command ? "command" : "tool_call",
    tool_source: spec.command ? "shell" : "builtin",
    tool_name: spec.toolName,
    action: spec.action,
    target: spec.target,
    command: spec.command,
  };
  const policy_decision: PolicyDecision = {
    decision: spec.decision,
    reason: `${spec.decision} test`,
    matched_rule: spec.matchedRule,
    risk_delta: spec.riskDelta,
  };
  return {
    id,
    timestamp: toolEvent.timestamp,
    agent: { name: "claude-code" },
    tool_event: toolEvent,
    policy_decision,
  };
}

function makePackage(events: EvidenceEvent[]): EvidencePackageV1 {
  return {
    version: "0.1",
    task: { id: "fix-login-redirect", title: "Fix login redirect bug" },
    scope: {
      scope_hash: "sha256:abc",
      allowed_paths: ["src/auth/**"],
      blocked_paths: [".env*"],
      allowed_commands: ["npm test"],
      high_risk: ["package.json"],
    },
    events,
    policy_interventions: events.filter(
      (e) => e.policy_decision.decision !== "allow",
    ),
    created_at: "2026-06-10T10:00:00.000Z",
    updated_at: "2026-06-10T10:05:00.000Z",
  };
}

function factorIds(risk: ReturnType<typeof calculateRiskScore>): string[] {
  return risk.factors.map((f) => f.id);
}

describe("calculateRiskScore", () => {
  it("is deterministic for the same input", () => {
    const pkg = makePackage([
      makeEvent({
        decision: "deny",
        toolName: "Read",
        action: "read",
        target: ".env.local",
        matchedRule: "blocked_paths:.env*",
      }),
    ]);
    const a = calculateRiskScore(pkg);
    const b = calculateRiskScore(pkg);
    expect(a).toEqual(b);
  });

  it("scores empty evidence as low with no factors", () => {
    const risk = calculateRiskScore(makePackage([]));
    expect(risk.score).toBe(0);
    expect(risk.level).toBe("low");
    expect(risk.factors).toHaveLength(0);
    expect(risk.recommendations).toEqual([
      "No major policy concerns detected in this session.",
    ]);
  });

  it("scores no-risk allow-only evidence as low", () => {
    const risk = calculateRiskScore(
      makePackage([
        makeEvent({
          decision: "allow",
          toolName: "Edit",
          action: "edit",
          target: "src/auth/login.ts",
          matchedRule: "allowed_paths:src/auth/**",
          riskDelta: -10,
        }),
      ]),
    );
    expect(risk.score).toBe(0);
    expect(risk.level).toBe("low");
  });

  it("Read .env.local deny produces blocked_path_denied factor", () => {
    const risk = calculateRiskScore(
      makePackage([
        makeEvent({
          decision: "deny",
          toolName: "Read",
          action: "read",
          target: ".env.local",
          matchedRule: "blocked_paths:.env*",
          riskDelta: 20,
        }),
      ]),
    );
    expect(factorIds(risk)).toContain("blocked_path_denied");
    const factor = risk.factors.find((f) => f.id === "blocked_path_denied");
    expect(factor?.points).toBeGreaterThanOrEqual(20);
    expect(factor?.target).toBe(".env.local");
    expect(risk.recommendations).toContain(
      "Review why the agent attempted to access blocked paths.",
    );
  });

  it("Write package.json ask produces high_risk_approval_required factor", () => {
    const risk = calculateRiskScore(
      makePackage([
        makeEvent({
          decision: "ask",
          toolName: "Write",
          action: "write",
          target: "package.json",
          matchedRule: "high_risk:package.json",
          riskDelta: 25,
        }),
      ]),
    );
    expect(factorIds(risk)).toContain("high_risk_approval_required");
    const factor = risk.factors.find(
      (f) => f.id === "high_risk_approval_required",
    );
    expect(factor?.points).toBeGreaterThanOrEqual(25);
    expect(risk.recommendations).toContain(
      "Manually review high-risk file changes before merging.",
    );
  });

  it("dangerous command deny produces dangerous_command_denied factor (>=40)", () => {
    const risk = calculateRiskScore(
      makePackage([
        makeEvent({
          decision: "deny",
          toolName: "Bash",
          action: "execute",
          command: "rm -rf /",
          matchedRule: "dangerous_commands:rm -rf *",
          riskDelta: 40,
        }),
      ]),
    );
    expect(factorIds(risk)).toContain("dangerous_command_denied");
    const factor = risk.factors.find(
      (f) => f.id === "dangerous_command_denied",
    );
    expect(factor?.points).toBeGreaterThanOrEqual(40);
    // also produces session-level dangerous_command_seen
    expect(factorIds(risk)).toContain("dangerous_command_seen");
    expect(risk.recommendations).toContain(
      "Investigate denied dangerous shell commands.",
    );
  });

  it("generic ask write without matched_rule produces out_of_scope_approval_required", () => {
    const risk = calculateRiskScore(
      makePackage([
        makeEvent({
          decision: "ask",
          toolName: "Write",
          action: "write",
          target: "scripts/tool.ts",
        }),
      ]),
    );
    expect(factorIds(risk)).toContain("out_of_scope_approval_required");
    const factor = risk.factors.find(
      (f) => f.id === "out_of_scope_approval_required",
    );
    expect(factor?.points).toBeGreaterThanOrEqual(15);
    expect(risk.recommendations).toContain(
      "Review whether the task scope should be narrowed or explicitly expanded.",
    );
  });

  it("warn produces a warned_action factor (>=5)", () => {
    const risk = calculateRiskScore(
      makePackage([
        makeEvent({ decision: "warn", toolName: "Edit", action: "edit", target: "x.ts" }),
      ]),
    );
    expect(factorIds(risk)).toContain("warned_action");
    const factor = risk.factors.find((f) => f.id === "warned_action");
    expect(factor?.points).toBeGreaterThanOrEqual(5);
  });

  it("3+ interventions creates many_policy_interventions factor", () => {
    const risk = calculateRiskScore(
      makePackage([
        makeEvent({ decision: "ask", action: "edit", target: "a.ts" }),
        makeEvent({ decision: "ask", action: "edit", target: "b.ts" }),
        makeEvent({ decision: "warn", action: "edit", target: "c.ts" }),
      ]),
    );
    expect(factorIds(risk)).toContain("many_policy_interventions");
    expect(risk.recommendations).toContain(
      "Review this session before trusting the final changes.",
    );
  });

  it("deny >= 2 creates multiple_denied_actions factor", () => {
    const risk = calculateRiskScore(
      makePackage([
        makeEvent({
          decision: "deny",
          target: ".env.local",
          matchedRule: "blocked_paths:.env*",
        }),
        makeEvent({
          decision: "deny",
          target: "secrets/key.pem",
          matchedRule: "blocked_paths:secrets/**",
        }),
      ]),
    );
    expect(factorIds(risk)).toContain("multiple_denied_actions");
  });

  it("blocked + high_risk together creates mixed_blocked_and_high_risk factor", () => {
    const risk = calculateRiskScore(
      makePackage([
        makeEvent({
          decision: "deny",
          target: ".env.local",
          matchedRule: "blocked_paths:.env*",
        }),
        makeEvent({
          decision: "ask",
          action: "write",
          target: "package.json",
          matchedRule: "high_risk:package.json",
        }),
      ]),
    );
    expect(factorIds(risk)).toContain("mixed_blocked_and_high_risk");
  });

  it("allow with negative risk_delta does not reduce score below 0", () => {
    const risk = calculateRiskScore(
      makePackage([
        makeEvent({
          decision: "allow",
          action: "edit",
          target: "src/auth/login.ts",
          riskDelta: -50,
        }),
        makeEvent({
          decision: "allow",
          action: "edit",
          target: "src/auth/session.ts",
          riskDelta: -50,
        }),
      ]),
    );
    expect(risk.score).toBe(0);
    expect(risk.score).toBeGreaterThanOrEqual(0);
  });

  it("allow with positive risk_delta contributes a factor and points", () => {
    const risk = calculateRiskScore(
      makePackage([
        makeEvent({
          decision: "allow",
          action: "edit",
          target: "src/weird.ts",
          riskDelta: 12,
        }),
      ]),
    );
    expect(factorIds(risk)).toContain("positive_risk_delta_allowed");
    expect(risk.score).toBe(12);
  });

  it("clamps the total score to 100", () => {
    const events = [];
    for (let i = 0; i < 10; i++) {
      events.push(
        makeEvent({
          decision: "deny",
          toolName: "Bash",
          action: "execute",
          command: "rm -rf /",
          matchedRule: "dangerous_commands:rm -rf *",
          riskDelta: 40,
        }),
      );
    }
    const risk = calculateRiskScore(makePackage(events));
    expect(risk.score).toBe(100);
    expect(risk.level).toBe("critical");
  });

  it("populates counts from the events", () => {
    const risk = calculateRiskScore(
      makePackage([
        makeEvent({ decision: "allow", action: "edit", target: "a.ts" }),
        makeEvent({
          decision: "deny",
          target: ".env.local",
          matchedRule: "blocked_paths:.env*",
        }),
        makeEvent({
          decision: "ask",
          action: "write",
          target: "package.json",
          matchedRule: "high_risk:package.json",
        }),
      ]),
    );
    expect(risk.counts.total_events).toBe(3);
    expect(risk.counts.allow).toBe(1);
    expect(risk.counts.deny).toBe(1);
    expect(risk.counts.ask).toBe(1);
    expect(risk.counts.policy_interventions).toBe(2);
  });

  it("carries the evidence path through options without reading files", () => {
    const risk = calculateRiskScore(makePackage([]), {
      evidencePath: "/tmp/x/latest.json",
    });
    expect(risk.evidence.path).toBe("/tmp/x/latest.json");
    expect(risk.evidence.created_at).toBe("2026-06-10T10:00:00.000Z");
  });

  it("recommendations are deterministic and reassuring when no risk", () => {
    const a = calculateRiskScore(makePackage([]));
    const b = calculateRiskScore(makePackage([]));
    expect(a.recommendations).toEqual(b.recommendations);
    expect(a.recommendations).toEqual([
      "No major policy concerns detected in this session.",
    ]);
  });
});
