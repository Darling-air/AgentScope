import { describe, it, expect } from "vitest";
import { diffScopes, isEmptyScopeDiff } from "./diff.js";
import type { ScopeContract } from "../schema/scope-contract.js";

function scope(overrides: Partial<ScopeContract>): ScopeContract {
  return {
    version: "0.1",
    task: { id: "t", title: "t", raw_input: "t" },
    confidence: 0.8,
    allowed_paths: [],
    blocked_paths: [],
    high_risk: [],
    allowed_commands: [],
    rationale: [],
    created_at: "2026-06-10T10:00:00.000Z",
    ...overrides,
  };
}

describe("diffScopes", () => {
  it("computes added/removed/unchanged for allowed paths", () => {
    const current = scope({ allowed_paths: ["a", "b", "c"] });
    const next = scope({ allowed_paths: ["b", "c", "d"] });
    const d = diffScopes(current, next);
    expect(d.allowed_paths.added).toEqual(["d"]);
    expect(d.allowed_paths.removed).toEqual(["a"]);
    expect(d.allowed_paths.unchanged).toEqual(["b", "c"]);
  });

  it("diffs blocked paths", () => {
    const d = diffScopes(
      scope({ blocked_paths: [".env*", "infra/**"] }),
      scope({ blocked_paths: [".env*", "private/**"] }),
    );
    expect(d.blocked_paths.added).toEqual(["private/**"]);
    expect(d.blocked_paths.removed).toEqual(["infra/**"]);
    expect(d.blocked_paths.unchanged).toEqual([".env*"]);
  });

  it("diffs high-risk paths", () => {
    const d = diffScopes(
      scope({ high_risk: ["package.json"] }),
      scope({ high_risk: ["package.json", "scripts/release/**"] }),
    );
    expect(d.high_risk.added).toEqual(["scripts/release/**"]);
    expect(d.high_risk.removed).toEqual([]);
  });

  it("diffs allowed commands", () => {
    const d = diffScopes(
      scope({ allowed_commands: ["npm test"] }),
      scope({ allowed_commands: ["npm run lint"] }),
    );
    expect(d.allowed_commands.added).toEqual(["npm run lint"]);
    expect(d.allowed_commands.removed).toEqual(["npm test"]);
  });

  it("preserves order (added in next order, removed/unchanged in current order)", () => {
    const current = scope({ allowed_paths: ["x", "y", "z"] });
    const next = scope({ allowed_paths: ["z", "y", "w", "q"] });
    const d = diffScopes(current, next);
    expect(d.allowed_paths.added).toEqual(["w", "q"]); // next order
    expect(d.allowed_paths.removed).toEqual(["x"]); // current order
    expect(d.allowed_paths.unchanged).toEqual(["y", "z"]); // current order
  });

  it("uses exact string comparison (no glob interpretation)", () => {
    const d = diffScopes(
      scope({ allowed_paths: ["src/**"] }),
      scope({ allowed_paths: ["src/auth/**"] }),
    );
    expect(d.allowed_paths.added).toEqual(["src/auth/**"]);
    expect(d.allowed_paths.removed).toEqual(["src/**"]);
    expect(d.allowed_paths.unchanged).toEqual([]);
  });

  it("is deterministic", () => {
    const a = diffScopes(
      scope({ allowed_paths: ["a", "b"] }),
      scope({ allowed_paths: ["b", "c"] }),
    );
    const b = diffScopes(
      scope({ allowed_paths: ["a", "b"] }),
      scope({ allowed_paths: ["b", "c"] }),
    );
    expect(a).toEqual(b);
  });

  it("does not mutate inputs", () => {
    const current = scope({ allowed_paths: ["a", "b"] });
    const next = scope({ allowed_paths: ["b", "c"] });
    const cSnap = JSON.parse(JSON.stringify(current));
    const nSnap = JSON.parse(JSON.stringify(next));
    diffScopes(current, next);
    expect(current).toEqual(cSnap);
    expect(next).toEqual(nSnap);
  });
});

describe("isEmptyScopeDiff", () => {
  it("is true when nothing changed", () => {
    const s = scope({ allowed_paths: ["a"] });
    expect(isEmptyScopeDiff(diffScopes(s, s))).toBe(true);
  });

  it("is false when something changed", () => {
    const d = diffScopes(
      scope({ allowed_paths: ["a"] }),
      scope({ allowed_paths: ["a", "b"] }),
    );
    expect(isEmptyScopeDiff(d)).toBe(false);
  });
});
