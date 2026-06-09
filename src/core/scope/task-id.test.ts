import { describe, it, expect } from "vitest";
import { taskTitleToId } from "./task-id.js";

describe("taskTitleToId", () => {
  it("converts a simple title to kebab-case", () => {
    expect(taskTitleToId("Fix login redirect bug")).toBe("fix-login-redirect-bug");
  });

  it("lowercases everything", () => {
    expect(taskTitleToId("Update Navbar STYLE")).toBe("update-navbar-style");
  });

  it("strips special characters", () => {
    expect(taskTitleToId("Fix: login/redirect (bug!)")).toBe("fix-login-redirect-bug");
  });

  it("collapses repeated separators", () => {
    expect(taskTitleToId("a   ---   b")).toBe("a-b");
  });

  it("trims leading and trailing separators", () => {
    expect(taskTitleToId("  -- hello --  ")).toBe("hello");
  });

  it("truncates to 64 characters without trailing hyphen", () => {
    const long = "word ".repeat(40);
    const id = taskTitleToId(long);
    expect(id.length).toBeLessThanOrEqual(64);
    expect(id.endsWith("-")).toBe(false);
  });

  it("falls back to 'task' when nothing usable remains", () => {
    expect(taskTitleToId("!!!@@@###")).toBe("task");
    expect(taskTitleToId("")).toBe("task");
  });
});
