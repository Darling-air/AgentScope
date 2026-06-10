import { describe, it, expect } from "vitest";
import { inferScope } from "./inference-engine.js";
import { defaultConfig } from "../config/default-config.js";

const AT = "2026-06-10T10:00:00.000Z";

function infer(task: string) {
  return inferScope({ rawInput: task, config: defaultConfig(), createdAt: AT });
}

describe("inferScope (V2.0)", () => {
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

    it("explains the low-confidence fallback in the rationale", () => {
      const { scope } = infer("Tweak the homepage copy");
      expect(scope.rationale.join(" ").toLowerCase()).toContain("fallback");
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
      expect(scope.high_risk).toContain("pnpm-lock.yaml");
    });

    it("api task includes route/controller/API paths", () => {
      const { scope } = infer("Add a new endpoint to the user route controller");
      expect(scope.allowed_paths).toEqual(
        expect.arrayContaining(["src/api/**", "src/routes/**", "src/controllers/**"]),
      );
      expect(scope.allowed_paths).not.toContain("src/**");
    });

    it("frontend task includes component/page/style paths", () => {
      const { scope } = infer("Update navbar component style");
      expect(scope.allowed_paths).toEqual(
        expect.arrayContaining(["src/components/**", "src/pages/**", "src/styles/**"]),
      );
    });

    it("test task includes test paths", () => {
      const { scope } = infer("Add unit tests for the parser");
      expect(scope.allowed_paths).toEqual(
        expect.arrayContaining(["tests/**", "__tests__/**"]),
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
    it("de-duplicates while preserving first-seen order", () => {
      const { scope } = infer("Fix login redirect bug");
      expect(new Set(scope.allowed_paths).size).toBe(scope.allowed_paths.length);
      expect(new Set(scope.blocked_paths).size).toBe(scope.blocked_paths.length);
      expect(new Set(scope.high_risk).size).toBe(scope.high_risk.length);
    });

    it("always records a rationale that mentions matched keywords", () => {
      const { scope } = infer("Fix login redirect bug");
      expect(scope.rationale.length).toBeGreaterThan(0);
      expect(scope.rationale.join(" ").toLowerCase()).toMatch(/login|auth/);
    });

    it("is fully deterministic", () => {
      const a = infer("Fix login redirect bug");
      const b = infer("Fix login redirect bug");
      expect(a).toEqual(b);
    });

    it("always provides at least one allowed command", () => {
      const { scope } = infer("Fix login redirect bug");
      expect(scope.allowed_commands.length).toBeGreaterThan(0);
    });
  });
});
