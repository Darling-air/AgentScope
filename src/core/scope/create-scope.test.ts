import { describe, it, expect } from "vitest";
import { createScope } from "./create-scope.js";
import { defaultConfig } from "../config/default-config.js";

const AT = "2026-06-09T10:00:00.000Z";

function scopeFor(task: string) {
  return createScope({ rawInput: task, config: defaultConfig(), createdAt: AT });
}

describe("createScope (V0 inference)", () => {
  it("derives a kebab-case task id and keeps the title", () => {
    const s = scopeFor("Fix login redirect bug");
    expect(s.task.id).toBe("fix-login-redirect-bug");
    expect(s.task.title).toBe("Fix login redirect bug");
    expect(s.task.raw_input).toBe("Fix login redirect bug");
    expect(s.created_at).toBe(AT);
    expect(s.version).toBe("0.1");
  });

  it("adds auth paths and raises confidence for auth tasks", () => {
    const s = scopeFor("Fix login redirect bug");
    expect(s.allowed_paths).toContain("src/auth/**");
    expect(s.allowed_paths).toContain("tests/auth/**");
    // login + redirect + auth-family keywords -> multiple signals -> 0.80
    expect(s.confidence).toBe(0.8);
  });

  it("adds component paths for UI tasks", () => {
    const s = scopeFor("Update navbar component style");
    expect(s.allowed_paths).toContain("src/components/**");
    expect(s.allowed_paths).toContain("tests/components/**");
  });

  it("uses single-signal confidence for one keyword group", () => {
    const s = scopeFor("Improve session handling");
    expect(s.confidence).toBe(0.72);
  });

  it("falls back to default allowed paths and low confidence when nothing matches", () => {
    const s = scopeFor("Tweak the homepage copy");
    expect(s.allowed_paths).toEqual(
      expect.arrayContaining(["src/**", "tests/**", "__tests__/**"]),
    );
    expect(s.confidence).toBe(0.55);
  });

  it("moves .github out of blocked into allowed + high risk for CI tasks", () => {
    const s = scopeFor("Update CI workflow node version");
    expect(s.blocked_paths).not.toContain(".github/**");
    expect(s.allowed_paths).toContain(".github/**");
    expect(s.high_risk).toContain(".github/**");
  });

  it("moves migrations out of blocked into allowed + high risk for migration tasks", () => {
    const s = scopeFor("Add database migration for users table");
    expect(s.blocked_paths).not.toContain("migrations/**");
    expect(s.allowed_paths).toContain("migrations/**");
    expect(s.high_risk).toContain("migrations/**");
  });

  it("keeps .env blocked even for CI tasks", () => {
    const s = scopeFor("Update CI workflow");
    expect(s.blocked_paths).toContain(".env*");
  });

  it("always records a rationale", () => {
    const s = scopeFor("Fix login redirect bug");
    expect(s.rationale.length).toBeGreaterThan(0);
  });

  it("produces no duplicate patterns", () => {
    const s = scopeFor("Fix login redirect bug");
    expect(new Set(s.allowed_paths).size).toBe(s.allowed_paths.length);
    expect(new Set(s.blocked_paths).size).toBe(s.blocked_paths.length);
    expect(new Set(s.high_risk).size).toBe(s.high_risk.length);
  });
});
