import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  injectAgentScopeHook,
  removeAgentScopeHook,
  hasAgentScopeHook,
  AGENTSCOPE_HOOK_COMMAND,
  AGENTSCOPE_HOOK_MATCHER,
  type ClaudeSettings,
} from "./settings-transform.js";
import {
  backupSettingsFile,
  type BackupResult,
} from "./settings-backup.js";

/** Raised when an existing settings file cannot be parsed as JSON. */
export class SettingsParseError extends Error {}

export interface ResolveSettingsOptions {
  cwd: string;
  /** When true, target the shared .claude/settings.json instead of local. */
  shared?: boolean;
}

/**
 * Resolves the Claude Code settings file AgentScope should write to.
 *
 * - default  -> <cwd>/.claude/settings.local.json
 * - --shared -> <cwd>/.claude/settings.json
 */
export function resolveClaudeSettingsPath(
  options: ResolveSettingsOptions,
): string {
  const file = options.shared ? "settings.json" : "settings.local.json";
  return path.join(options.cwd, ".claude", file);
}

/**
 * Reads and parses a settings file. Returns:
 * - {} when the file does not exist (a fresh settings object)
 * - the parsed object when valid
 * Throws SettingsParseError when the file exists but is not valid JSON, so the
 * caller can refuse to overwrite it.
 */
export function readSettings(settingsPath: string): ClaudeSettings {
  if (!existsSync(settingsPath)) return {};

  const text = readFileSync(settingsPath, "utf8");
  if (text.trim() === "") return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new SettingsParseError(
      `Could not parse ${settingsPath} as JSON (${(err as Error).message}). ` +
        "Refusing to overwrite it. Fix or remove the file and try again.",
    );
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new SettingsParseError(
      `${settingsPath} does not contain a JSON object. Refusing to overwrite it.`,
    );
  }

  return parsed as ClaudeSettings;
}

/** Serializes settings with stable 2-space indentation and a trailing newline. */
function serializeSettings(settings: ClaudeSettings): string {
  return `${JSON.stringify(settings, null, 2)}\n`;
}

export interface InstallResult {
  settingsPath: string;
  shared: boolean;
  dryRun: boolean;
  command: string;
  matcher: string;
  /** Backup info; undefined for a dry-run or when no file existed. */
  backup?: BackupResult;
  /** Whether an existing AgentScope hook was updated vs newly added. */
  updatedExisting: boolean;
  /** Pretty-printed settings that would be / were written. */
  before: string;
  after: string;
}

/**
 * Installs the AgentScope PreToolUse hook into the resolved settings file.
 *
 * On a real run it backs up the file (once), then writes the transformed
 * settings. On a dry run it computes everything but writes nothing and creates
 * no backup.
 */
export function installClaudeHook(
  options: ResolveSettingsOptions & { dryRun?: boolean },
): InstallResult {
  const settingsPath = resolveClaudeSettingsPath(options);
  const shared = options.shared ?? false;
  const dryRun = options.dryRun ?? false;

  const current = readSettings(settingsPath);
  const updatedExisting = hasAgentScopeHook(current);
  const next = injectAgentScopeHook(current);

  const before = serializeSettings(current);
  const after = serializeSettings(next);

  if (dryRun) {
    return {
      settingsPath,
      shared,
      dryRun,
      command: AGENTSCOPE_HOOK_COMMAND,
      matcher: AGENTSCOPE_HOOK_MATCHER,
      updatedExisting,
      before,
      after,
    };
  }

  // Ensure .claude/ exists.
  mkdirSync(path.dirname(settingsPath), { recursive: true });

  // Back up the original (once) before writing.
  const backup = backupSettingsFile(settingsPath);

  writeFileSync(settingsPath, after, "utf8");

  return {
    settingsPath,
    shared,
    dryRun,
    command: AGENTSCOPE_HOOK_COMMAND,
    matcher: AGENTSCOPE_HOOK_MATCHER,
    backup,
    updatedExisting,
    before,
    after,
  };
}

export interface UninstallResult {
  settingsPath: string;
  shared: boolean;
  /** True if the file existed and contained an AgentScope hook that was removed. */
  removed: boolean;
  /** True if there was nothing to do (no file or no AgentScope hook). */
  noop: boolean;
}

/**
 * Removes only the AgentScope PreToolUse hook from the resolved settings file.
 * Unrelated hooks are preserved. Does not restore a backup and does not delete
 * the .claude/ directory.
 */
export function uninstallClaudeHook(
  options: ResolveSettingsOptions,
): UninstallResult {
  const settingsPath = resolveClaudeSettingsPath(options);
  const shared = options.shared ?? false;

  if (!existsSync(settingsPath)) {
    return { settingsPath, shared, removed: false, noop: true };
  }

  const current = readSettings(settingsPath);
  if (!hasAgentScopeHook(current)) {
    return { settingsPath, shared, removed: false, noop: true };
  }

  const next = removeAgentScopeHook(current);
  writeFileSync(settingsPath, serializeSettings(next), "utf8");

  return { settingsPath, shared, removed: true, noop: false };
}
