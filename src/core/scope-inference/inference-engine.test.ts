import { describe, it, expect } from "vitest";
import { inferScope } from "./inference-engine.js";
import {
  defaultEffectiveConfig,
  type EffectiveAgentScopeConfig,
} from "../config/effective-config.js";

const AT = "2026-06-10T10:00:00.000Z";

function inferWith(task: string, config: EffectiveAgentScopeConfig) {
  return inferScope({ rawInput: task, config, createdAt: AT });
}

function infer(task: string) {
  return inferWith(task, defaultEffectiveConfig());
}

describe("inferScope (V2.0/V2.1)", () => {
  it("derives a kebab-case task id and keeps the title/raw_input", () => {
    const { scope } = infer("Fix login redirect bug");
    expect(scope.task.id).toBe("fix-login-redirect-bug");
    expect(scope.task.title).toBe("Fix login redirect bug");
    expect(scope.task.raw_input).toBe("Fix login redirect bug");
    expect(scope.created_at).toBe(AT);
    expect(scope.version).toBe("0.1");
  });

  describe("auth/login task", () => {
    it("infers narrow auth/login paths", () => {
      const { scope } = infer("Fix login redirect bug");
      expect(scope.allowed_paths).toEqual(
        expect.arrayContaining([
          "src/auth/**",
          "tests/auth/**",
          "src/**/login*",
          "tests/**/login*",
          "__tests__/**/login*",
        ]),
      );
    });

    it("does NOT include the broad src/** fallback", () => {
      const { scope, usedFallback } = infer("Fix login redirect bug");
      expect(scope.allowed_paths).not.toContain("src/**");
      expect(scope.allowed_paths).not.toContain("tests/**");
      expect(usedFallback).toBe(false);
    });

    it("still blocks .env*", () => {
      const { scope } = infer("Fix login redirect bug");
      expect(scope.blocked_paths).toContain(".env*");
    });

    it("keeps package.json high-risk", () => {
      const { scope } = infer("Fix login redirect bug");
      expect(scope.high_risk).toContain("package.json");
    });

    it("matches only the auth rule pack", () => {
      const { matchedRulePacks } = infer("Fix login redirect bug");
      expect(matchedRulePacks).toEqual(["auth"]);
    });
  });

  describe("general / unknown task", () => {
    it("falls back to conservative broad paths", () => {
      const { scope, usedFallback } = infer("Tweak the homepage copy");
      expect(scope.allowed_paths).toEqual(
        expect.arrayContaining(["src/**", "tests/**", "__tests__/**"]),
      );
      expect(usedFallback).toBe(true);
    });

    it("uses low confidence", () => {
      const { scope } = infer("Tweak the homepage copy");
      expect(scope.confidence).toBeLessThan(0.65);
    });
  });

  describe("other domains", () => {
    it("docs task includes README/docs paths and no broad src/**", () => {
      const { scope } = infer("Update the README installation guide");
      expect(scope.allowed_paths).toEqual(
        expect.arrayContaining(["docs/**", "README*"]),
      );
      expect(scope.allowed_paths).not.toContain("src/**");
    });

    it("dependency task marks package files high-risk and allows them", () => {
      const { scope } = infer("Upgrade npm dependencies");
      expect(scope.allowed_paths).toContain("package.json");
      expect(scope.high_risk).toContain("package.json");
    });

    it("api task includes route/controller/API paths", () => {
      const { scope } = infer("Add a new endpoint to the user route controller");
      expect(scope.allowed_paths).toEqual(
        expect.arrayContaining(["src/api/**", "src/routes/**", "src/controllers/**"]),
      );
    });

    it("frontend task includes component/page/style paths", () => {
      const { scope } = infer("Update navbar component style");
      expect(scope.allowed_paths).toEqual(
        expect.arrayContaining(["src/components/**", "src/pages/**", "src/styles/**"]),
      );
    });

    it("config/ci task unblocks .github/** into allowed + high-risk", () => {
      const { scope } = infer("Update CI workflow node version");
      expect(scope.blocked_paths).not.toContain(".github/**");
      expect(scope.allowed_paths).toContain(".github/**");
      expect(scope.high_risk).toContain(".github/**");
    });

    it("database task keeps migrations/** blocked and flags it high-risk", () => {
      const { scope } = infer("Add a migration for the users schema");
      expect(scope.blocked_paths).toContain("migrations/**");
      expect(scope.high_risk).toContain("migrations/**");
    });
  });

  describe("assembly invariants", () => {
    it("de-duplicates while preserving order", () => {
      const { scope } = infer("Fix login redirect bug");
      expect(new Set(scope.allowed_paths).size).toBe(scope.allowed_paths.length);
      expect(new Set(scope.blocked_paths).size).toBe(scope.blocked_paths.length);
      expect(new Set(scope.high_risk).size).toBe(scope.high_risk.length);
    });

    it("is fully deterministic", () => {
      const a = infer("Fix login redirect bug");
      const b = infer("Fix login redirect bug");
      expect(a).toEqual(b);
    });
  });

  describe("config-driven inference (V2.1)", () => {
    it("includes a custom blocked path from config", () => {
      const cfg = defaultEffectiveConfig();
      cfg.policy.blocked_paths.push("private/**");
      const { scope } = inferWith("Fix login redirect bug", cfg);
      expect(scope.blocked_paths).toContain("private/**");
    });

    it("omits a removed default blocked path", () => {
      const cfg = defaultEffectiveConfig();
      cfg.policy.blocked_paths = cfg.policy.blocked_paths.filter(
        (p) => p !== "infra/**",
      );
      const { scope } = inferWith("Fix login redirect bug", cfg);
      expect(scope.blocked_paths).not.toContain("infra/**");
    });

    it("includes a custom high-risk path from config", () => {
      const cfg = defaultEffectiveConfig();
      cfg.policy.high_risk.push("scripts/release/**");
      const { scope } = inferWith("Fix login redirect bug", cfg);
      expect(scope.high_risk).toContain("scripts/release/**");
    });

    it("applies an auth rule-pack override (add app/auth/**, remove src/**/login*)", () => {
      const cfg = defaultEffectiveConfig();
      cfg.inference.rule_packs.overrides = {
        auth: {
          allowed_paths: { add: ["app/auth/**"], remove: ["src/**/login*"] },
        },
      };
      const { scope } = inferWith("Fix login redirect bug", cfg);
      expect(scope.allowed_paths).toContain("app/auth/**");
      expect(scope.allowed_paths).not.toContain("src/**/login*");
      // unaffected auth paths remain
      expect(scope.allowed_paths).toContain("src/auth/**");
    });

    it("applies an auth rule-pack allowed_commands override", () => {
      const cfg = defaultEffectiveConfig();
      cfg.inference.rule_packs.overrides = {
        auth: { allowed_commands: { add: ["npm run test:auth"], remove: [] } },
      };
      const { scope } = inferWith("Fix login redirect bug", cfg);
      expect(scope.allowed_commands).toContain("npm run test:auth");
    });

    it("a disabled auth pack drops auth-specific paths and falls back", () => {
      const cfg = defaultEffectiveConfig();
      cfg.inference.rule_packs.disabled = ["auth"];
      const { scope, matchedRulePacks } = inferWith("Fix login redirect bug", cfg);
      expect(matchedRulePacks).not.toContain("auth");
      expect(scope.allowed_paths).not.toContain("src/auth/**");
      // with no domain pack, the broad fallback applies
      expect(scope.allowed_paths).toContain("src/**");
    });

    it("respects a custom confidence threshold", () => {
      const cfg = defaultEffectiveConfig();
      // Raise threshold above the auth single-domain confidence (0.80) so auth
      // is no longer 'confident' and the fallback kicks in alongside it.
      cfg.inference.confidence_threshold = 0.95;
      const { scope, usedFallback } = inferWith("Fix login redirect bug", cfg);
      expect(usedFallback).toBe(true);
      expect(scope.allowed_paths).toContain("src/**");
      // still includes the narrow auth paths
      expect(scope.allowed_paths).toContain("src/auth/**");
    });

    it("disabling fallback prevents broad paths for an unknown task", () => {
      const cfg = defaultEffectiveConfig();
      cfg.inference.fallback.enabled = false;
      const { scope, usedFallback } = inferWith("Tweak the homepage copy", cfg);
      expect(usedFallback).toBe(false);
      expect(scope.allowed_paths).not.toContain("src/**");
    });

    it("uses custom fallback allowed_paths for an unknown task", () => {
      const cfg = defaultEffectiveConfig();
      cfg.inference.fallback.allowed_paths = ["app/**", "lib/**"];
      const { scope } = inferWith("Tweak the homepage copy", cfg);
      expect(scope.allowed_paths).toEqual(
        expect.arrayContaining(["app/**", "lib/**"]),
      );
      expect(scope.allowed_paths).not.toContain("src/**");
    });
  });
});
