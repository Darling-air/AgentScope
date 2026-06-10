/**
 * Pure transforms for Claude Code settings `hooks` blocks.
 *
 * These functions never touch the filesystem. They take a parsed settings
 * object (any JSON shape Claude Code might produce) and return a NEW object
 * with the AgentScope PreToolUse hook injected or removed. Existing, unrelated
 * hooks are always preserved.
 *
 * Claude Code's PreToolUse hooks structure (the part we care about):
 *
 *   {
 *     "hooks": {
 *       "PreToolUse": [
 *         { "matcher": "Read|Edit|Write|Bash",
 *           "hooks": [ { "type": "command", "command": "..." } ] }
 *       ]
 *     }
 *   }
 */

/** The shell command AgentScope injects as a PreToolUse hook. */
export const AGENTSCOPE_HOOK_COMMAND =
  "agentscope hook claude-code pre-tool-use";

/** The tools AgentScope's hook matches. */
export const AGENTSCOPE_HOOK_MATCHER = "Read|Edit|Write|Bash";

/** Substring used to recognize an AgentScope-owned hook command. */
export const AGENTSCOPE_HOOK_MARKER = "agentscope hook claude-code pre-tool-use";

export interface ClaudeHookCommand {
  type: "command";
  command: string;
  [key: string]: unknown;
}

export interface ClaudeHookEntry {
  matcher?: string;
  hooks: ClaudeHookCommand[];
  [key: string]: unknown;
}

export type ClaudeSettings = Record<string, unknown>;

/** Returns true if a hook command string belongs to AgentScope. */
export function isAgentScopeCommand(command: unknown): boolean {
  return (
    typeof command === "string" && command.includes(AGENTSCOPE_HOOK_MARKER)
  );
}

/** Returns true if a PreToolUse entry contains an AgentScope hook command. */
function entryHasAgentScopeHook(entry: ClaudeHookEntry): boolean {
  return entry.hooks.some((h) => isAgentScopeCommand(h?.command));
}

/**
 * Reads the existing PreToolUse entries from a settings object, defensively.
 * Returns a shallow-cloned, well-typed array; entries with a non-array `hooks`
 * field are normalized to an empty hooks array so later code is simple.
 */
function readPreToolUseEntries(settings: ClaudeSettings): ClaudeHookEntry[] {
  const hooks = settings.hooks;
  if (!hooks || typeof hooks !== "object") return [];

  const pre = (hooks as Record<string, unknown>).PreToolUse;
  if (!Array.isArray(pre)) return [];

  return pre.map((raw) => {
    const entry = (raw && typeof raw === "object" ? raw : {}) as Record<
      string,
      unknown
    >;
    const innerHooks = Array.isArray(entry.hooks)
      ? (entry.hooks as ClaudeHookCommand[])
      : [];
    return { ...entry, hooks: innerHooks } as ClaudeHookEntry;
  });
}

/** Builds the canonical AgentScope PreToolUse entry. */
export function buildAgentScopeEntry(): ClaudeHookEntry {
  return {
    matcher: AGENTSCOPE_HOOK_MATCHER,
    hooks: [{ type: "command", command: AGENTSCOPE_HOOK_COMMAND }],
  };
}

/** Writes a PreToolUse entries array back into a cloned settings object. */
function writePreToolUseEntries(
  settings: ClaudeSettings,
  entries: ClaudeHookEntry[],
): ClaudeSettings {
  const existingHooks =
    settings.hooks && typeof settings.hooks === "object"
      ? (settings.hooks as Record<string, unknown>)
      : {};

  const nextHooks: Record<string, unknown> = { ...existingHooks };

  if (entries.length === 0) {
    delete nextHooks.PreToolUse;
  } else {
    nextHooks.PreToolUse = entries;
  }

  const next: ClaudeSettings = { ...settings };
  if (Object.keys(nextHooks).length === 0) {
    delete next.hooks;
  } else {
    next.hooks = nextHooks;
  }
  return next;
}

/**
 * Injects (or updates) the AgentScope PreToolUse hook.
 *
 * - If an AgentScope entry already exists, its matcher + command are refreshed
 *   in place (idempotent; no duplicates).
 * - Otherwise a new AgentScope entry is appended.
 * - All other PreToolUse entries and unrelated settings are preserved.
 */
export function injectAgentScopeHook(settings: ClaudeSettings): ClaudeSettings {
  const entries = readPreToolUseEntries(settings);
  const canonical = buildAgentScopeEntry();

  let updated = false;
  const next = entries.map((entry) => {
    if (entryHasAgentScopeHook(entry)) {
      updated = true;
      // Refresh the matcher and replace AgentScope hook commands with the
      // canonical one, while keeping any non-AgentScope hooks in this entry.
      const preserved = entry.hooks.filter(
        (h) => !isAgentScopeCommand(h?.command),
      );
      return {
        ...entry,
        matcher: AGENTSCOPE_HOOK_MATCHER,
        hooks: [...preserved, ...canonical.hooks],
      };
    }
    return entry;
  });

  if (!updated) next.push(canonical);

  return writePreToolUseEntries(settings, next);
}

/**
 * Removes the AgentScope PreToolUse hook only.
 *
 * - AgentScope hook commands are stripped from every PreToolUse entry.
 * - An entry left with no hooks is dropped.
 * - Unrelated hooks and entries are preserved.
 * - Safe to call when no AgentScope hook is present (returns equivalent data).
 */
export function removeAgentScopeHook(settings: ClaudeSettings): ClaudeSettings {
  const entries = readPreToolUseEntries(settings);

  const next = entries
    .map((entry) => ({
      ...entry,
      hooks: entry.hooks.filter((h) => !isAgentScopeCommand(h?.command)),
    }))
    .filter((entry) => entry.hooks.length > 0);

  return writePreToolUseEntries(settings, next);
}

/** Returns true if the settings object currently contains an AgentScope hook. */
export function hasAgentScopeHook(settings: ClaudeSettings): boolean {
  return readPreToolUseEntries(settings).some(entryHasAgentScopeHook);
}
