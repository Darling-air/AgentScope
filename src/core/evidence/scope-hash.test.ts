import { describe, it, expect } from "vitest";
import { computeScopeHash, buildScopeSnapshot } from "./scope-hash.js";
import type { ScopeContract } from "../schema/scope-contract.js";

const baseInput = {
  task: { id: "fix-login-redirect", title: "Fix login redirect bug" },
  allowed_paths: ["src/auth/**", "tests/auth/**"],
  blocked_paths: [".env*", "migrations/**"],
  allowed_commands: ["npm test"],
  high_risk: ["package.json"],
};

describe("computeScopeHash", () => {
  it("starts with sha256:", () => {
    expect(computeScopeHash(baseInput)).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("is stable for identical scope content", () => {
    expect(computeScopeHash(baseInput)).toBe(computeScopeHash(baseInput));
  });

  it("changes when allowed_paths change", () => {
    const other = { ...baseInput, allowed_paths: ["src/**"] };
    expect(computeScopeHash(other)).not.toBe(computeScopeHash(baseInput));
  });

  it("changes when array order changes (order is meaningful)", () => {
    const reordered = {
      ...baseInput,
      allowed_paths: ["tests/auth/**", "src/auth/**"],
    };
    expect(computeScopeHash(reordered)).not.toBe(computeScopeHash(baseInput));
  });

  it("is unaffected by object key order", () => {
    const reorderedKeys = {
      high_risk: ["package.json"],
      allowed_commands: ["npm test"],
      blocked_paths: [".env*", "migrations/**"],
      allowed_paths: ["src/auth/**", "tests/auth/**"],
      task: { title: "Fix login redirect bug", id: "fix-login-redirect" },
    };
    expect(computeScopeHash(reorderedKeys)).toBe(computeScopeHash(baseInput));
  });

  it("ignores fields outside the stable snapshot (e.g. title-only? no — title matters)", () => {
    const differentTitle = {
      ...baseInput,
      task: { ...baseInput.task, title: "Different" },
    };
    expect(computeScopeHash(differentTitle)).not.toBe(
      computeScopeHash(baseInput),
    );
  });
});

describe("buildScopeSnapshot", () => {
  const scope: ScopeContract = {
    version: "0.1",
    task: {
      id: "fix-login-redirect",
      title: "Fix login redirect bug",
      raw_input: "Fix login redirect bug",
    },
    confidence: 0.8,
    allowed_paths: ["src/auth/**", "tests/auth/**"],
    blocked_paths: [".env*", "migrations/**"],
    allowed_commands: ["npm test"],
    high_risk: ["package.json"],
    rationale: ["some rationale"],
    created_at: "2026-06-10T10:00:00.000Z",
  };

  it("copies the scope path/command fields into the snapshot", () => {
    const snap = buildScopeSnapshot(scope);
    expect(snap.allowed_paths).toEqual(scope.allowed_paths);
    expect(snap.blocked_paths).toEqual(scope.blocked_paths);
    expect(snap.allowed_commands).toEqual(scope.allowed_commands);
    expect(snap.high_risk).toEqual(scope.high_risk);
  });

  it("computes a hash matching computeScopeHash for the same fields", () => {
    const snap = buildScopeSnapshot(scope);
    expect(snap.scope_hash).toBe(computeScopeHash(baseInput));
  });

  it("is unaffected by confidence / rationale / created_at", () => {
    const a = buildScopeSnapshot(scope);
    const b = buildScopeSnapshot({
      ...scope,
      confidence: 0.1,
      rationale: ["totally different"],
      created_at: "2000-01-01T00:00:00.000Z",
    });
    expect(a.scope_hash).toBe(b.scope_hash);
  });
});
