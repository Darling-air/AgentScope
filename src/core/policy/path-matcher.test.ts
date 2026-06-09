import { describe, it, expect } from "vitest";
import { matchPath, matchesAny, findMatchingPattern } from "./path-matcher.js";

describe("matchPath", () => {
  it("matches a globstar source path", () => {
    expect(matchPath("src/auth/login.ts", "src/**")).toBe(true);
    expect(matchPath("src/auth/login.ts", "src/auth/**")).toBe(true);
  });

  it("does not match outside the glob", () => {
    expect(matchPath("lib/auth/login.ts", "src/**")).toBe(false);
  });

  it("matches dotfiles like .env*", () => {
    expect(matchPath(".env", ".env*")).toBe(true);
    expect(matchPath(".env.local", ".env*")).toBe(true);
  });

  it("matches .github workflow files", () => {
    expect(matchPath(".github/workflows/deploy.yml", ".github/**")).toBe(true);
  });

  it("matches an exact file pattern", () => {
    expect(matchPath("package.json", "package.json")).toBe(true);
    expect(matchPath("src/package.json", "package.json")).toBe(false);
  });

  it("normalizes windows-style separators", () => {
    expect(matchPath("src\\auth\\login.ts", "src/auth/**")).toBe(true);
  });

  it("normalizes a leading ./", () => {
    expect(matchPath("./src/auth/login.ts", "src/**")).toBe(true);
  });
});

describe("matchesAny / findMatchingPattern", () => {
  const patterns = [".env*", "secrets/**", ".github/**"];

  it("returns true when any pattern matches", () => {
    expect(matchesAny(".github/workflows/ci.yml", patterns)).toBe(true);
  });

  it("returns false when none match", () => {
    expect(matchesAny("src/index.ts", patterns)).toBe(false);
  });

  it("returns the first matching pattern", () => {
    expect(findMatchingPattern(".env.local", patterns)).toBe(".env*");
    expect(findMatchingPattern("src/index.ts", patterns)).toBeUndefined();
  });
});
