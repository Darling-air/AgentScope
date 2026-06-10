import { describe, it, expect } from "vitest";
import {
  EvidenceEventSchema,
  isPolicyIntervention,
} from "./evidence-event.js";
import {
  EvidencePackageV1Schema,
  EVIDENCE_PACKAGE_VERSION,
} from "./evidence-package.js";

const validEvent = {
  id: "evt-1",
  timestamp: "2026-06-10T10:00:00.000Z",
  agent: { name: "claude-code", session_id: "s1" },
  tool_event: {
    id: "evt-1",
    timestamp: "2026-06-10T10:00:00.000Z",
    agent: "claude-code",
    event_type: "tool_call",
    tool_source: "builtin",
    tool_name: "Read",
    action: "read",
    target: ".env.local",
  },
  policy_decision: {
    decision: "deny",
    reason: ".env.local matches blocked path .env*",
    matched_rule: "blocked_paths:.env*",
  },
};

describe("EvidenceEventSchema", () => {
  it("parses a valid EvidenceEvent", () => {
    const result = EvidenceEventSchema.safeParse(validEvent);
    expect(result.success).toBe(true);
  });

  it("rejects an invalid policy decision", () => {
    const bad = {
      ...validEvent,
      policy_decision: { decision: "nope", reason: "x" },
    };
    expect(EvidenceEventSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an invalid tool event", () => {
    const bad = {
      ...validEvent,
      tool_event: { ...validEvent.tool_event, event_type: "bogus" },
    };
    expect(EvidenceEventSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an agent name other than claude-code", () => {
    const bad = { ...validEvent, agent: { name: "cursor" } };
    expect(EvidenceEventSchema.safeParse(bad).success).toBe(false);
  });
});

describe("isPolicyIntervention", () => {
  it("is true for non-allow decisions", () => {
    const ev = EvidenceEventSchema.parse(validEvent);
    expect(isPolicyIntervention(ev)).toBe(true);
  });

  it("is false for allow decisions", () => {
    const ev = EvidenceEventSchema.parse({
      ...validEvent,
      policy_decision: { decision: "allow", reason: "ok" },
    });
    expect(isPolicyIntervention(ev)).toBe(false);
  });
});

describe("EvidencePackageV1Schema", () => {
  const validPackage = {
    version: EVIDENCE_PACKAGE_VERSION,
    task: { id: "fix-login-redirect", title: "Fix login redirect bug" },
    scope: {
      scope_hash: "sha256:abc",
      allowed_paths: ["src/auth/**"],
      blocked_paths: [".env*"],
      allowed_commands: ["npm test"],
      high_risk: ["package.json"],
    },
    events: [validEvent],
    policy_interventions: [validEvent],
    created_at: "2026-06-10T10:00:00.000Z",
    updated_at: "2026-06-10T10:00:00.000Z",
  };

  it("parses a valid EvidencePackageV1", () => {
    const result = EvidencePackageV1Schema.safeParse(validPackage);
    expect(result.success).toBe(true);
  });

  it("rejects a wrong version literal", () => {
    const bad = { ...validPackage, version: "9.9" };
    expect(EvidencePackageV1Schema.safeParse(bad).success).toBe(false);
  });

  it("rejects a missing scope snapshot", () => {
    const bad = { ...validPackage };
    delete (bad as Record<string, unknown>).scope;
    expect(EvidencePackageV1Schema.safeParse(bad).success).toBe(false);
  });
});
