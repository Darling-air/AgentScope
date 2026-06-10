import { describe, it, expect } from "vitest";
import {
  injectAgentScopeHook,
  removeAgentScopeHook,
  hasAgentScopeHook,
  AGENTSCOPE_HOOK_COMMAND,
  AGENTSCOPE_HOOK_MATCHER,
  type ClaudeSettings,
  type ClaudeHookEntry,
} from "./settings-transform.js";

function preToolUse(settings: ClaudeSettings): ClaudeHookEntry[] {
  return ((settings.hooks as Record<string, unknown>)?.PreToolUse ??
    []) as ClaudeHookEntry[];
}

describe("injectAgentScopeHook", () => {
  it("injects into empty settings", () => {
    const next = injectAgentScopeHook({});
    expect(hasAgentScopeHook(next)).toBe(true);
    const entries = preToolUse(next);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.matcher).toBe(AGENTSCOPE_HOOK_MATCHER);
    expect(entries[0]?.hooks[0]?.command).toBe(AGENTSCOPE_HOOK_COMMAND);
  });

  it("preserves unrelated top-level settings", () => {
    const next = injectAgentScopeHook({ model: "opus", env: { A: "1" } });
    expect(next.model).toBe("opus");
    expect(next.env).toEqual({ A: "1" });
  });

  it("preserves unrelated PreToolUse entries", () => {
    const existing: ClaudeSettings = {
      hooks: {
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [{ type: "command", command: "echo custom" }],
          },
        ],
      },
    };
    const next = injectAgentScopeHook(existing);
    const entries = preToolUse(next);
    expect(entries).toHaveLength(2);
    expect(entries.some((e) => e.hooks.some((h) => h.command === "echo custom"))).toBe(
      true,
    );
    expect(hasAgentScopeHook(next)).toBe(true);
  });

  it("preserves other hook events (e.g. PostToolUse)", () => {
    const existing: ClaudeSettings = {
      hooks: {
        PostToolUse: [
          { matcher: "Edit", hooks: [{ type: "command", command: "fmt" }] },
        ],
      },
    };
    const next = injectAgentScopeHook(existing);
    expect((next.hooks as Record<string, unknown>).PostToolUse).toBeDefined();
    expect(hasAgentScopeHook(next)).toBe(true);
  });

  it("is idempotent across repeated installs", () => {
    const once = injectAgentScopeHook({});
    const twice = injectAgentScopeHook(once);
    expect(preToolUse(twice)).toHaveLength(1);
    expect(preToolUse(twice)[0]?.hooks).toHaveLength(1);
  });

  it("updates an existing AgentScope hook in place (refreshes matcher/command)", () => {
    const stale: ClaudeSettings = {
      hooks: {
        PreToolUse: [
          {
            matcher: "Read",
            hooks: [
              {
                type: "command",
                command: "old agentscope hook claude-code pre-tool-use",
              },
            ],
          },
        ],
      },
    };
    const next = injectAgentScopeHook(stale);
    const entries = preToolUse(next);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.matcher).toBe(AGENTSCOPE_HOOK_MATCHER);
    expect(entries[0]?.hooks).toHaveLength(1);
    expect(entries[0]?.hooks[0]?.command).toBe(AGENTSCOPE_HOOK_COMMAND);
  });

  it("keeps a sibling non-AgentScope hook when updating an entry", () => {
    const mixed: ClaudeSettings = {
      hooks: {
        PreToolUse: [
          {
            matcher: "Read",
            hooks: [
              { type: "command", command: "agentscope hook claude-code pre-tool-use" },
              { type: "command", command: "sibling-tool" },
            ],
          },
        ],
      },
    };
    const next = injectAgentScopeHook(mixed);
    const entry = preToolUse(next)[0];
    expect(entry?.hooks.map((h) => h.command)).toContain("sibling-tool");
    expect(entry?.hooks.map((h) => h.command)).toContain(AGENTSCOPE_HOOK_COMMAND);
  });
});

describe("removeAgentScopeHook", () => {
  it("removes only the AgentScope hook", () => {
    const installed = injectAgentScopeHook({});
    const next = removeAgentScopeHook(installed);
    expect(hasAgentScopeHook(next)).toBe(false);
  });

  it("preserves unrelated hooks and drops the emptied entry", () => {
    const existing: ClaudeSettings = {
      hooks: {
        PreToolUse: [
          { matcher: "Bash", hooks: [{ type: "command", command: "echo custom" }] },
        ],
      },
    };
    const installed = injectAgentScopeHook(existing);
    const next = removeAgentScopeHook(installed);
    const entries = preToolUse(next);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.hooks[0]?.command).toBe("echo custom");
    expect(hasAgentScopeHook(next)).toBe(false);
  });

  it("keeps sibling hooks within a shared entry", () => {
    const mixed: ClaudeSettings = {
      hooks: {
        PreToolUse: [
          {
            matcher: "Read|Edit|Write|Bash",
            hooks: [
              { type: "command", command: "agentscope hook claude-code pre-tool-use" },
              { type: "command", command: "sibling-tool" },
            ],
          },
        ],
      },
    };
    const next = removeAgentScopeHook(mixed);
    const entries = preToolUse(next);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.hooks.map((h) => h.command)).toEqual(["sibling-tool"]);
  });

  it("is safe on settings without an AgentScope hook", () => {
    const existing: ClaudeSettings = {
      hooks: {
        PreToolUse: [
          { matcher: "Bash", hooks: [{ type: "command", command: "echo x" }] },
        ],
      },
    };
    const next = removeAgentScopeHook(existing);
    expect(preToolUse(next)).toHaveLength(1);
  });

  it("is safe on completely empty settings", () => {
    const next = removeAgentScopeHook({});
    expect(next).toEqual({});
  });

  it("drops the hooks key entirely when nothing remains", () => {
    const installed = injectAgentScopeHook({});
    const next = removeAgentScopeHook(installed);
    expect(next.hooks).toBeUndefined();
  });
});
