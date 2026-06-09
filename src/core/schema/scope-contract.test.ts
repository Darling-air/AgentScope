import { describe, it, expect } from "vitest";
import {
  ScopeContractSchema,
  SCOPE_CONTRACT_VERSION,
} from "./scope-contract.js";

function validScope() {
  return {
    version: SCOPE_CONTRACT_VERSION,
    task: {
      id: "fix-login-redirect",
      title: "Fix login redirect bug",
      raw_input: "Fix login redirect bug",
    },
    confidence: 0.72,
    allowed_paths: ["src/**"],
    blocked_paths: [".env*"],
    allowed_commands: ["npm test"],
    high_risk: ["package.json"],
    rationale: ["because"],
    created_at: "2026-06-09T10:00:00.000Z",
  };
}

describe("ScopeContractSchema", () => {
  it("accepts a valid contract", () => {
    expect(ScopeContractSchema.safeParse(validScope()).success).toBe(true);
  });

  it("defaults rationale to an empty array when missing", () => {
    const s = validScope() as Record<string, unknown>;
    delete s.rationale;
    const parsed = ScopeContractSchema.parse(s);
    expect(parsed.rationale).toEqual([]);
  });

  it("rejects confidence above 1", () => {
    const s = { ...validScope(), confidence: 1.5 };
    expect(ScopeContractSchema.safeParse(s).success).toBe(false);
  });

  it("rejects a missing task id", () => {
    const s = validScope();
    s.task.id = "";
    expect(ScopeContractSchema.safeParse(s).success).toBe(false);
  });

  it("rejects a missing version", () => {
    const s = validScope() as Record<string, unknown>;
    delete s.version;
    expect(ScopeContractSchema.safeParse(s).success).toBe(false);
  });
});
