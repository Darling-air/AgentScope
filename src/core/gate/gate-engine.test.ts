import { describe, it, expect } from "vitest";
import { defaultEffectiveConfig } from "../config/effective-config.js";
import type { RiskFactor, RiskScoreV1 } from "../risk/risk-score.js";
import { evaluatePolicyGate } from "./gate-engine.js";
import { GateResultV1Schema } from "./gate-result.js";

function risk(overrides: Partial<RiskScoreV1> = {}): RiskScoreV1 {
  return {
    version: "0.1",
    score: 10,
    level: "low",
    summary: "Risk 10/100 (low) from 1 event(s), 0 policy intervention(s).",
    task: { id: "safe-task", title: "Safe task" },
    scope_hash: "sha256:test",
    counts: {
      total_events: 1,
      allow: 1,
      deny: 0,
      ask: 0,
      warn: 0,
      policy_interventions: 0,
    },
    factors: [],
    recommendations: [],
    evidence: {
      path: ".agentscope/evidence/latest.json",
      created_at: "2026-06-10T10:00:00.000Z",
      updated_at: "2026-06-10T10:00:00.000Z",
    },
    ...overrides,
  };
}

function factor(id: string): RiskFactor {
  return {
    id,
    label: id,
    severity: "high",
    points: 10,
    event_id: "evt-1",
    target: ".env.local",
    matched_rule: "blocked_paths:.env*",
  };
}

function gate() {
  return defaultEffectiveConfig().gate;
}

describe("evaluatePolicyGate", () => {
  it("passes when risk is under thresholds", () => {
    const result = evaluatePolicyGate({ risk: risk(), gate: gate() });
    expect(result.status).toBe("pass");
    expect(result.passed).toBe(true);
    expect(result.summary).toBe("Policy gate passed.");
    expect(result.reasons).toEqual([]);
    expect(() => GateResultV1Schema.parse(result)).not.toThrow();
  });

  it("skips when gate is disabled", () => {
    const g = gate();
    g.enabled = false;
    const result = evaluatePolicyGate({ risk: risk(), gate: g });
    expect(result.status).toBe("skipped");
    expect(result.passed).toBe(true);
    expect(result.reasons.map((r) => r.id)).toContain("gate_disabled");
  });

  it("fails when score exceeds max_score", () => {
    const result = evaluatePolicyGate({ risk: risk({ score: 75, level: "critical" }), gate: gate() });
    expect(result.reasons.map((r) => r.id)).toContain("risk_score_exceeded");
  });

  it("fails when level exceeds max_level", () => {
    const g = gate();
    g.risk.max_score = 100;
    g.risk.max_level = "medium";
    const result = evaluatePolicyGate({ risk: risk({ score: 60, level: "high" }), gate: g });
    expect(result.reasons.map((r) => r.id)).toContain("risk_level_exceeded");
  });

  it("fails when deny count exceeds max_denies", () => {
    const result = evaluatePolicyGate({
      risk: risk({ counts: { ...risk().counts, deny: 1 } }),
      gate: gate(),
    });
    expect(result.reasons.map((r) => r.id)).toContain("deny_count_exceeded");
  });

  it("fails when ask count exceeds max_asks", () => {
    const g = gate();
    g.decisions.max_asks = 1;
    const result = evaluatePolicyGate({
      risk: risk({ counts: { ...risk().counts, ask: 2 } }),
      gate: g,
    });
    expect(result.reasons.map((r) => r.id)).toContain("ask_count_exceeded");
  });

  it("fails when warnings exist and allow_warnings is false", () => {
    const g = gate();
    g.decisions.allow_warnings = false;
    const result = evaluatePolicyGate({
      risk: risk({ counts: { ...risk().counts, warn: 1 } }),
      gate: g,
    });
    expect(result.reasons.map((r) => r.id)).toContain("warnings_not_allowed");
  });

  it("fails on blocked_path_denied factor", () => {
    const result = evaluatePolicyGate({
      risk: risk({ factors: [factor("blocked_path_denied")] }),
      gate: gate(),
    });
    expect(result.reasons.map((r) => r.id)).toContain("blocked_path_denied");
  });

  it("fails on dangerous_command_denied factor", () => {
    const result = evaluatePolicyGate({
      risk: risk({ factors: [factor("dangerous_command_denied")] }),
      gate: gate(),
    });
    expect(result.reasons.map((r) => r.id)).toContain("dangerous_command_detected");
  });

  it("fails on dangerous_command_seen factor", () => {
    const result = evaluatePolicyGate({
      risk: risk({ factors: [factor("dangerous_command_seen")] }),
      gate: gate(),
    });
    expect(result.reasons.map((r) => r.id)).toContain("dangerous_command_detected");
  });

  it("fails on high_risk_approval_required when enabled", () => {
    const g = gate();
    g.rules.fail_on_high_risk_without_review = true;
    const result = evaluatePolicyGate({
      risk: risk({ factors: [factor("high_risk_approval_required")] }),
      gate: g,
    });
    expect(result.reasons.map((r) => r.id)).toContain("high_risk_requires_review");
  });

  it("produces multiple reasons", () => {
    const result = evaluatePolicyGate({
      risk: risk({
        score: 90,
        level: "critical",
        counts: { ...risk().counts, deny: 2, ask: 11 },
        factors: [factor("blocked_path_denied")],
      }),
      gate: gate(),
    });
    expect(result.status).toBe("fail");
    expect(result.reasons.map((r) => r.id)).toEqual(
      expect.arrayContaining([
        "risk_score_exceeded",
        "risk_level_exceeded",
        "deny_count_exceeded",
        "ask_count_exceeded",
        "blocked_path_denied",
      ]),
    );
  });

  it("is deterministic", () => {
    const r = risk({ factors: [factor("blocked_path_denied")] });
    const g = gate();
    expect(evaluatePolicyGate({ risk: r, gate: g })).toEqual(
      evaluatePolicyGate({ risk: r, gate: g }),
    );
  });

  it("does not mutate risk", () => {
    const r = risk({ factors: [factor("blocked_path_denied")] });
    const before = structuredClone(r);
    evaluatePolicyGate({ risk: r, gate: gate() });
    expect(r).toEqual(before);
  });
});
