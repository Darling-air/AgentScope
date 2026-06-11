import { describe, it, expect } from "vitest";
import {
  applyScopeOverride,
  isEmptyOverridePatch,
} from "./override.js";
import type { ScopeContract } from "../schema/scope-contract.js";

function baseScope(): ScopeContract {
  return {
    version: "0.1",
    task: { id: "fix-login", title: "Fix login", raw_input: "Fix login" },
    confidence: 0.8,
    allowed_paths: ["src/auth/**", "src/**/login*"],
    blocked_paths: [".env*", "infra/**"],
    high_risk: ["package.json"],
    allowed_commands: ["npm test"],
    rationale: ["Inference: auth task."],
    created_at: "2026-06-10T10:00:00.000Z",
  };
}

describe("isEmptyOverridePatch", () => {
  it("is true for {} and for empty add/remove arrays", () => {
    expect(isEmptyOverridePatch({})).toBe(true);
    expect(
      isEmptyOverridePatch({ allowed_paths: { add: [], remove: [] } }),
    ).toBe(true);
  });

  it("is false when any list has entries", () => {
    expect(isEmptyOverridePatch({ allowed_paths: { add: ["x"] } })).toBe(false);
  });
});

describe("applyScopeOverride", () => {
  it("adds an allowed path", () => {
    const s = applyScopeOverride(baseScope(), {
      allowed_paths: { add: ["app/auth/**"] },
    });
    expect(s.allowed_paths).toContain("app/auth/**");
  });

  it("removes an allowed path (exact match)", () => {
    const s = applyScopeOverride(baseScope(), {
      allowed_paths: { remove: ["src/**/login*"] },
    });
    expect(s.allowed_paths).not.toContain("src/**/login*");
    expect(s.allowed_paths).toContain("src/auth/**");
  });

  it("adds and removes blocked paths", () => {
    const s = applyScopeOverride(baseScope(), {
      blocked_paths: { add: ["private/**"], remove: ["infra/**"] },
    });
    expect(s.blocked_paths).toContain("private/**");
    expect(s.blocked_paths).not.toContain("infra/**");
  });

  it("adds a high-risk path", () => {
    const s = applyScopeOverride(baseScope(), {
      high_risk: { add: ["scripts/release/**"] },
    });
    expect(s.high_risk).toContain("scripts/release/**");
  });

  it("removes a high-risk path", () => {
    const s = applyScopeOverride(baseScope(), {
      high_risk: { remove: ["package.json"] },
    });
    expect(s.high_risk).not.toContain("package.json");
  });

  it("adds and removes commands", () => {
    const s = applyScopeOverride(baseScope(), {
      allowed_commands: { add: ["npm run test:auth"], remove: ["npm test"] },
    });
    expect(s.allowed_commands).toContain("npm run test:auth");
    expect(s.allowed_commands).not.toContain("npm test");
  });

  it("de-duplicates while preserving order", () => {
    const s = applyScopeOverride(baseScope(), {
      allowed_paths: { add: ["src/auth/**", "z/**", "src/auth/**"] },
    });
    expect(s.allowed_paths).toEqual([
      "src/auth/**",
      "src/**/login*",
      "z/**",
    ]);
  });

  it("removes by exact match only (not prefix/substring)", () => {
    const s = applyScopeOverride(baseScope(), {
      allowed_paths: { remove: ["src/auth"] },
    });
    expect(s.allowed_paths).toContain("src/auth/**");
  });

  it("returns an equivalent scope with no new rationale for an empty patch", () => {
    const before = baseScope();
    const s = applyScopeOverride(before, {});
    expect(s.allowed_paths).toEqual(before.allowed_paths);
    expect(s.rationale).toEqual(before.rationale);
  });

  it("records a rationale line for each add and effective remove", () => {
    const s = applyScopeOverride(baseScope(), {
      allowed_paths: { add: ["app/auth/**"], remove: ["src/**/login*"] },
      blocked_paths: { add: ["private/**"] },
      high_risk: { add: ["scripts/release/**"] },
      allowed_commands: { add: ["npm run test:auth"] },
    });
    expect(s.rationale).toContain("Override: added allowed path app/auth/**.");
    expect(s.rationale).toContain("Override: removed allowed path src/**/login*.");
    expect(s.rationale).toContain("Override: added blocked path private/**.");
    expect(s.rationale).toContain("Override: added high-risk path scripts/release/**.");
    expect(s.rationale).toContain("Override: added allowed command npm run test:auth.");
  });

  it("does not record a removed-rationale for a non-matching remove", () => {
    const s = applyScopeOverride(baseScope(), {
      allowed_paths: { remove: ["does/not/exist"] },
    });
    expect(s.rationale.some((r) => r.includes("does/not/exist"))).toBe(false);
  });

  it("does not mutate the original scope", () => {
    const before = baseScope();
    const snapshot = JSON.parse(JSON.stringify(before));
    applyScopeOverride(before, {
      allowed_paths: { add: ["app/auth/**"], remove: ["src/auth/**"] },
    });
    expect(before).toEqual(snapshot);
  });

  it("preserves task id / title / created_at / confidence", () => {
    const before = baseScope();
    const s = applyScopeOverride(before, {
      allowed_paths: { add: ["x/**"] },
    });
    expect(s.task).toEqual(before.task);
    expect(s.created_at).toBe(before.created_at);
    expect(s.confidence).toBe(before.confidence);
  });
});
