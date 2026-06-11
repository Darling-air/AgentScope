import { describe, it, expect } from "vitest";
import {
  applyAddRemove,
  normalizeConfig,
  defaultEffectiveConfig,
  BUILTIN_DEFAULTS,
} from "./effective-config.js";
import { AgentScopeConfigSchema } from "../schema/config.js";

function parse(yamlLikeObject: unknown) {
  return AgentScopeConfigSchema.parse(yamlLikeObject);
}

describe("applyAddRemove", () => {
  it("appends add values", () => {
    expect(applyAddRemove(["a"], { add: ["b"], remove: [] })).toEqual(["a", "b"]);
  });

  it("removes exact matches only", () => {
    expect(applyAddRemove(["a", "ab"], { add: [], remove: ["a"] })).toEqual([
      "ab",
    ]);
  });

  it("does not remove by prefix/substring", () => {
    expect(
      applyAddRemove(["src/**", "src/auth/**"], { add: [], remove: ["src"] }),
    ).toEqual(["src/**", "src/auth/**"]);
  });

  it("de-duplicates while preserving first-seen order", () => {
    expect(applyAddRemove(["a", "b"], { add: ["a", "c", "b"], remove: [] })).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("handles an undefined patch", () => {
    expect(applyAddRemove(["a", "b"], undefined)).toEqual(["a", "b"]);
  });
});

describe("defaultEffectiveConfig", () => {
  it("returns a clone (mutating it does not affect BUILTIN_DEFAULTS)", () => {
    const c = defaultEffectiveConfig();
    c.policy.blocked_paths.push("mutated/**");
    expect(BUILTIN_DEFAULTS.policy.blocked_paths).not.toContain("mutated/**");
  });
});

describe("normalizeConfig", () => {
  it("returns built-in defaults for an empty config", () => {
    const cfg = normalizeConfig(parse({ version: 1 }));
    expect(cfg.policy.blocked_paths).toEqual(BUILTIN_DEFAULTS.policy.blocked_paths);
    expect(cfg.inference.confidence_threshold).toBe(0.65);
  });

  it("applies policy add/remove patches", () => {
    const cfg = normalizeConfig(
      parse({
        version: 1,
        policy: {
          blocked_paths: { add: ["private/**"], remove: ["infra/**"] },
        },
      }),
    );
    expect(cfg.policy.blocked_paths).toContain("private/**");
    expect(cfg.policy.blocked_paths).not.toContain("infra/**");
  });

  it("overrides inference threshold and fallback", () => {
    const cfg = normalizeConfig(
      parse({
        version: 1,
        inference: {
          confidence_threshold: 0.8,
          fallback: { enabled: false, allowed_paths: ["app/**"] },
        },
      }),
    );
    expect(cfg.inference.confidence_threshold).toBe(0.8);
    expect(cfg.inference.fallback.enabled).toBe(false);
    expect(cfg.inference.fallback.allowed_paths).toEqual(["app/**"]);
  });

  it("folds in a legacy defaults block", () => {
    const cfg = normalizeConfig(
      parse({
        defaults: {
          blocked_paths: [".env*"],
          dangerous_commands: ["rm -rf *", "legacy-danger *"],
        },
      }),
    );
    expect(cfg.policy.blocked_paths).toEqual([".env*"]);
    expect(cfg.policy.dangerous_commands).toContain("legacy-danger *");
  });

  it("applies structured patches on top of a legacy block", () => {
    const cfg = normalizeConfig(
      parse({
        defaults: { blocked_paths: [".env*"] },
        policy: { blocked_paths: { add: ["private/**"], remove: [] } },
      }),
    );
    expect(cfg.policy.blocked_paths).toEqual([".env*", "private/**"]);
  });
});
