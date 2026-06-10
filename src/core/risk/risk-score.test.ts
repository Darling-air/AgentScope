import { describe, it, expect } from "vitest";
import {
  RiskScoreV1Schema,
  RISK_SCORE_VERSION,
  levelForScore,
} from "./risk-score.js";

const validRisk = {
  version: RISK_SCORE_VERSION,
  score: 45,
  level: "medium",
  summary: "Risk 45/100 (medium) from 3 event(s), 2 policy intervention(s).",
  task: { id: "fix-login-redirect", title: "Fix login redirect bug" },
  scope_hash: "sha256:abc",
  counts: {
    total_events: 3,
    allow: 1,
    deny: 1,
    ask: 1,
    warn: 0,
    policy_interventions: 2,
  },
  factors: [
    {
      id: "blocked_path_denied",
      label: "Blocked path access was denied",
      severity: "high",
      points: 20,
      event_id: "evt-1",
      tool_name: "Read",
      action: "read",
      target: ".env.local",
      matched_rule: "blocked_paths:.env*",
    },
  ],
  recommendations: ["Review why the agent attempted to access blocked paths."],
  evidence: {
    path: ".agentscope/evidence/latest.json",
    created_at: "2026-06-10T10:00:00.000Z",
    updated_at: "2026-06-10T10:05:00.000Z",
  },
};

describe("RiskScoreV1Schema", () => {
  it("parses a valid RiskScoreV1", () => {
    expect(RiskScoreV1Schema.safeParse(validRisk).success).toBe(true);
  });

  it("rejects a score above 100", () => {
    const bad = { ...validRisk, score: 101 };
    expect(RiskScoreV1Schema.safeParse(bad).success).toBe(false);
  });

  it("rejects a negative score", () => {
    const bad = { ...validRisk, score: -1 };
    expect(RiskScoreV1Schema.safeParse(bad).success).toBe(false);
  });

  it("rejects an invalid level", () => {
    const bad = { ...validRisk, level: "extreme" };
    expect(RiskScoreV1Schema.safeParse(bad).success).toBe(false);
  });

  it("rejects an invalid factor severity", () => {
    const bad = {
      ...validRisk,
      factors: [{ ...validRisk.factors[0], severity: "spicy" }],
    };
    expect(RiskScoreV1Schema.safeParse(bad).success).toBe(false);
  });

  it("rejects a wrong version literal", () => {
    const bad = { ...validRisk, version: "9.9" };
    expect(RiskScoreV1Schema.safeParse(bad).success).toBe(false);
  });
});

describe("levelForScore", () => {
  it("maps 0-24 to low", () => {
    expect(levelForScore(0)).toBe("low");
    expect(levelForScore(24)).toBe("low");
  });

  it("maps 25-49 to medium", () => {
    expect(levelForScore(25)).toBe("medium");
    expect(levelForScore(49)).toBe("medium");
  });

  it("maps 50-74 to high", () => {
    expect(levelForScore(50)).toBe("high");
    expect(levelForScore(74)).toBe("high");
  });

  it("maps 75-100 to critical", () => {
    expect(levelForScore(75)).toBe("critical");
    expect(levelForScore(100)).toBe("critical");
  });
});
