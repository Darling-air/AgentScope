import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { ClaudePreToolUsePayloadSchema } from "./pre-tool-use-payload.js";

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "__fixtures__",
);

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(path.join(fixturesDir, name), "utf8"));
}

describe("ClaudePreToolUsePayloadSchema", () => {
  it("accepts a valid Read payload", () => {
    expect(
      ClaudePreToolUsePayloadSchema.safeParse(loadFixture("read-env.json"))
        .success,
    ).toBe(true);
  });

  it("accepts a valid Edit payload", () => {
    expect(
      ClaudePreToolUsePayloadSchema.safeParse(loadFixture("edit-auth.json"))
        .success,
    ).toBe(true);
  });

  it("accepts a valid Write payload", () => {
    expect(
      ClaudePreToolUsePayloadSchema.safeParse(loadFixture("write-auth.json"))
        .success,
    ).toBe(true);
  });

  it("accepts a valid Bash payload", () => {
    expect(
      ClaudePreToolUsePayloadSchema.safeParse(loadFixture("bash-npm-test.json"))
        .success,
    ).toBe(true);
  });

  it("accepts an unsupported tool_name without crashing", () => {
    const parsed = ClaudePreToolUsePayloadSchema.safeParse(
      loadFixture("unknown-tool.json"),
    );
    expect(parsed.success).toBe(true);
  });

  it("rejects an invalid hook_event_name", () => {
    const bad = {
      hook_event_name: "PostToolUse",
      tool_name: "Read",
      tool_input: { file_path: "x" },
    };
    expect(ClaudePreToolUsePayloadSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a missing tool_input", () => {
    const bad = { hook_event_name: "PreToolUse", tool_name: "Read" };
    expect(ClaudePreToolUsePayloadSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an empty tool_name", () => {
    const bad = {
      hook_event_name: "PreToolUse",
      tool_name: "",
      tool_input: {},
    };
    expect(ClaudePreToolUsePayloadSchema.safeParse(bad).success).toBe(false);
  });
});
