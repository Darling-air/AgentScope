import { describe, it, expect } from "vitest";
import { checkScope, checkFile } from "./check-scope.js";
import type { ScopeContract } from "../schema/scope-contract.js";

const scope: ScopeContract = {
  version: "0.1",
  task: { id: "fix-login-redirect", title: "Fix login redirect bug", raw_input: "Fix login redirect bug" },
  confidence: 0.8,
  allowed_paths: ["src/auth/**", "tests/auth/**"],
  blocked_paths: [".env*", "migrations/**", ".github/**"],
  allowed_commands: ["npm test"],
  high_risk: ["package.json", "pnpm-lock.yaml"],
  rationale: [],
  created_at: "2026-06-09T10:00:00.000Z",
};

describe("checkFile", () => {
  it("flags an allowed file as ok", () => {
    const r = checkFile("src/auth/login.ts", scope);
    expect(r.status).toBe("ok");
    expect(r.category).toBe("allowed");
    expect(r.matchedPattern).toBe("src/auth/**");
  });

  it("flags a high-risk file as warning", () => {
    const r = checkFile("package.json", scope);
    expect(r.status).toBe("warning");
    expect(r.category).toBe("high_risk");
  });

  it("flags a blocked file as violation", () => {
    const r = checkFile(".github/workflows/deploy.yml", scope);
    expect(r.status).toBe("violation");
    expect(r.category).toBe("blocked");
    expect(r.matchedPattern).toBe(".github/**");
  });

  it("flags an out-of-scope file as warning", () => {
    const r = checkFile("src/payments/charge.ts", scope);
    expect(r.status).toBe("warning");
    expect(r.category).toBe("out_of_scope");
  });

  it("blocked takes precedence over allowed (deny wins)", () => {
    const overlap: ScopeContract = {
      ...scope,
      allowed_paths: ["src/**"],
      blocked_paths: ["src/secret/**"],
    };
    const r = checkFile("src/secret/key.ts", overlap);
    expect(r.status).toBe("violation");
  });
});

describe("checkScope summary", () => {
  it("aggregates ok / warnings / violations and fails on a violation", () => {
    const result = checkScope(scope, [
      "src/auth/login.ts",
      "tests/auth/login.test.ts",
      "package.json",
      ".github/workflows/deploy.yml",
    ]);

    expect(result.summary.ok).toBe(2);
    expect(result.summary.warnings).toBe(1);
    expect(result.summary.violations).toBe(1);
    expect(result.passed).toBe(false);
  });

  it("passes when there are only warnings", () => {
    const result = checkScope(scope, ["package.json", "src/other/x.ts"]);
    expect(result.summary.violations).toBe(0);
    expect(result.passed).toBe(true);
  });

  it("passes with no changed files", () => {
    const result = checkScope(scope, []);
    expect(result.summary).toEqual({ ok: 0, warnings: 0, violations: 0 });
    expect(result.passed).toBe(true);
  });
});
