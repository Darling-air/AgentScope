import { describe, it, expect } from "vitest";
import { translatePreToolUsePayload } from "./pre-tool-use-translator.js";
import { ToolEventSchema } from "../../events/tool-event.js";
import type { ClaudePreToolUsePayload } from "./pre-tool-use-payload.js";

const opts = { id: "evt-1", timestamp: "2026-06-09T10:00:00.000Z" };

function payload(
  tool_name: string,
  tool_input: Record<string, unknown>,
  cwd?: string,
): ClaudePreToolUsePayload {
  return { hook_event_name: "PreToolUse", tool_name, tool_input, cwd };
}

describe("translatePreToolUsePayload", () => {
  it("translates a Read payload", () => {
    const e = translatePreToolUsePayload(
      payload("Read", { file_path: ".env.local" }),
      opts,
    );
    expect(e).toMatchObject({
      agent: "claude-code",
      event_type: "tool_call",
      tool_source: "builtin",
      tool_name: "Read",
      action: "read",
      target: ".env.local",
    });
    expect(ToolEventSchema.safeParse(e).success).toBe(true);
  });

  it("translates an Edit payload", () => {
    const e = translatePreToolUsePayload(
      payload("Edit", { file_path: "src/auth/login.ts" }),
      opts,
    );
    expect(e).toMatchObject({
      tool_name: "Edit",
      action: "edit",
      target: "src/auth/login.ts",
      tool_source: "builtin",
    });
  });

  it("translates a Write payload", () => {
    const e = translatePreToolUsePayload(
      payload("Write", { file_path: "src/auth/login.ts", content: "x" }),
      opts,
    );
    expect(e).toMatchObject({
      tool_name: "Write",
      action: "write",
      target: "src/auth/login.ts",
    });
  });

  it("translates a Bash payload to a command event", () => {
    const e = translatePreToolUsePayload(
      payload("Bash", { command: "npm test" }),
      opts,
    );
    expect(e).toMatchObject({
      event_type: "command",
      tool_source: "shell",
      tool_name: "Bash",
      action: "execute",
      command: "npm test",
    });
    expect(e.target).toBeUndefined();
  });

  it("maps an unknown tool to a safe custom event (no action)", () => {
    const e = translatePreToolUsePayload(
      payload("WebFetch", { url: "https://example.com" }),
      opts,
    );
    expect(e.tool_name).toBe("WebFetch");
    expect(e.tool_source).toBe("custom");
    expect(e.action).toBeUndefined();
    // Still a valid ToolEvent so the engine can fall back to ask.
    expect(ToolEventSchema.safeParse(e).success).toBe(true);
  });

  it("carries id and timestamp from options", () => {
    const e = translatePreToolUsePayload(
      payload("Read", { file_path: "a.ts" }),
      { id: "abc", timestamp: "T" },
    );
    expect(e.id).toBe("abc");
    expect(e.timestamp).toBe("T");
  });

  describe("path normalization (cwd-relative target)", () => {
    const CWD_POSIX = "G:/AgentScope";
    const CWD_WIN = "G:\\AgentScope";

    it("keeps a relative Read path relative", () => {
      const e = translatePreToolUsePayload(
        payload("Read", { file_path: ".env.local" }, CWD_POSIX),
        opts,
      );
      expect(e.target).toBe(".env.local");
    });

    it("makes a POSIX-absolute Read path repo-relative", () => {
      const e = translatePreToolUsePayload(
        payload("Read", { file_path: "G:/AgentScope/.env.local" }, CWD_POSIX),
        opts,
      );
      expect(e.target).toBe(".env.local");
    });

    it("makes a Windows-absolute Read path repo-relative", () => {
      const e = translatePreToolUsePayload(
        payload(
          "Read",
          { file_path: "G:\\AgentScope\\.env.local" },
          CWD_WIN,
        ),
        opts,
      );
      expect(e.target).toBe(".env.local");
    });

    it("makes a POSIX-absolute Edit path repo-relative", () => {
      const e = translatePreToolUsePayload(
        payload(
          "Edit",
          { file_path: "G:/AgentScope/src/auth/login.ts" },
          CWD_POSIX,
        ),
        opts,
      );
      expect(e.target).toBe("src/auth/login.ts");
    });

    it("makes a Windows-absolute Edit path repo-relative", () => {
      const e = translatePreToolUsePayload(
        payload(
          "Edit",
          { file_path: "G:\\AgentScope\\src\\auth\\login.ts" },
          CWD_WIN,
        ),
        opts,
      );
      expect(e.target).toBe("src/auth/login.ts");
    });

    it("makes a Windows-absolute Write path repo-relative", () => {
      const e = translatePreToolUsePayload(
        payload(
          "Write",
          { file_path: "G:/AgentScope/tests/auth/login.test.ts", content: "x" },
          CWD_POSIX,
        ),
        opts,
      );
      expect(e.target).toBe("tests/auth/login.test.ts");
    });

    it("does not crash and does not collapse paths outside cwd", () => {
      const e = translatePreToolUsePayload(
        payload("Read", { file_path: "G:/OtherRepo/.env.local" }, CWD_POSIX),
        opts,
      );
      expect(e.target).not.toBe(".env.local");
      expect(e.target).toBe("G:/OtherRepo/.env.local");
    });
  });
});
