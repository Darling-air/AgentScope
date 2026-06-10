import { describe, it, expect } from "vitest";
import { classifyTask, tokenize } from "./task-classifier.js";

describe("tokenize", () => {
  it("lowercases and splits on non-alphanumeric", () => {
    expect(tokenize("Fix login redirect bug")).toEqual([
      "fix",
      "login",
      "redirect",
      "bug",
    ]);
  });
});

describe("classifyTask", () => {
  it("classifies auth/login/redirect as auth with high confidence", () => {
    const c = classifyTask("Fix login redirect bug");
    expect(c.domains).toContain("auth");
    expect(c.domains[0]).toBe("auth");
    expect(c.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("classifies a vague task as general with low confidence", () => {
    const c = classifyTask("Tweak the homepage copy");
    expect(c.domains).toEqual([]);
    expect(c.confidence).toBeLessThan(0.65);
  });

  it("classifies docs tasks as docs", () => {
    const c = classifyTask("Update the README installation guide");
    expect(c.domains).toContain("docs");
  });

  it("classifies dependency tasks as dependencies", () => {
    const c = classifyTask("Upgrade npm dependencies");
    expect(c.domains).toContain("dependencies");
  });

  it("classifies api tasks as api", () => {
    const c = classifyTask("Add a new endpoint to the user route controller");
    expect(c.domains).toContain("api");
  });

  it("classifies frontend tasks as frontend", () => {
    const c = classifyTask("Update navbar component style");
    expect(c.domains).toContain("frontend");
  });

  it("classifies test tasks as tests", () => {
    const c = classifyTask("Add unit tests for the parser");
    expect(c.domains).toContain("tests");
  });

  it("classifies ci/config tasks as config", () => {
    const c = classifyTask("Update CI workflow node version");
    expect(c.domains).toContain("config");
  });

  it("classifies database tasks as database", () => {
    const c = classifyTask("Add a migration for the users schema");
    expect(c.domains).toContain("database");
  });

  it("matches hyphenated keywords like sign-in", () => {
    const c = classifyTask("Fix the sign-in form");
    expect(c.domains).toContain("auth");
  });

  it("reduces confidence below single-domain when multiple domains match", () => {
    const c = classifyTask("Update login API endpoint");
    expect(c.domains.length).toBeGreaterThan(1);
    expect(c.confidence).toBeLessThan(0.72);
    expect(c.confidence).toBeGreaterThan(0.5);
  });

  it("extracts intents", () => {
    const c = classifyTask("Fix login redirect bug");
    expect(c.intents).toContain("fix");
  });

  it("records a rationale that names matched keywords", () => {
    const c = classifyTask("Fix login redirect bug");
    expect(c.rationale.join(" ")).toMatch(/login|auth/);
  });

  it("is deterministic", () => {
    const a = classifyTask("Fix login redirect bug");
    const b = classifyTask("Fix login redirect bug");
    expect(a).toEqual(b);
  });
});
