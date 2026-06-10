import { describe, it, expect } from "vitest";
import { ToolEventSchema } from "./tool-event.js";

function baseEvent() {
  return {
    id: "evt-1",
    timestamp: "2026-06-09T10:00:00.000Z",
    agent: "test-agent",
  };
}

describe("ToolEventSchema", () => {
  it("accepts a valid Read event", () => {
    const event = {
      ...baseEvent(),
      event_type: "tool_call",
      tool_source: "builtin",
      tool_name: "Read",
      action: "read",
      target: ".env.local",
    };
    expect(ToolEventSchema.safeParse(event).success).toBe(true);
  });

  it("accepts a valid Edit event", () => {
    const event = {
      ...baseEvent(),
      event_type: "tool_call",
      tool_source: "builtin",
      tool_name: "Edit",
      action: "edit",
      target: "src/auth/login.ts",
    };
    expect(ToolEventSchema.safeParse(event).success).toBe(true);
  });

  it("accepts a valid Bash command event", () => {
    const event = {
      ...baseEvent(),
      event_type: "command",
      tool_source: "shell",
      tool_name: "Bash",
      action: "execute",
      command: "npm test",
    };
    expect(ToolEventSchema.safeParse(event).success).toBe(true);
  });

  it("accepts mcp as a tool_source", () => {
    const event = {
      ...baseEvent(),
      event_type: "tool_call",
      tool_source: "mcp",
      tool_name: "github.create_pr",
    };
    expect(ToolEventSchema.safeParse(event).success).toBe(true);
  });

  it("rejects an invalid event_type", () => {
    const event = {
      ...baseEvent(),
      event_type: "not_a_type",
      tool_source: "builtin",
    };
    expect(ToolEventSchema.safeParse(event).success).toBe(false);
  });

  it("rejects an invalid tool_source", () => {
    const event = {
      ...baseEvent(),
      event_type: "tool_call",
      tool_source: "telepathy",
    };
    expect(ToolEventSchema.safeParse(event).success).toBe(false);
  });

  it("rejects a missing agent", () => {
    const event = {
      id: "evt-1",
      timestamp: "2026-06-09T10:00:00.000Z",
      event_type: "tool_call",
      tool_source: "builtin",
    };
    expect(ToolEventSchema.safeParse(event).success).toBe(false);
  });
});
