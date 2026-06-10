/**
 * Path normalization for the Claude Code adapter.
 *
 * Claude Code may hand us a `file_path` that is relative (".env.local"),
 * a POSIX absolute path ("/repo/.env.local"), or a Windows absolute path
 * ("G:/AgentScope/.env.local" or "G:\\AgentScope\\.env.local"). The
 * PolicyEngine's glob rules (e.g. `.env*`, `src/**`) are written against
 * repo-relative, forward-slash paths, so an un-normalized absolute path
 * silently slips past `blocked_paths`.
 *
 * This module turns whatever Claude Code sends into a repo-relative,
 * forward-slash path whenever the file lives under `cwd`, and otherwise
 * returns a safely normalized (but still absolute) path. It deliberately does
 * NOT use Node's `path.relative`, whose behavior differs between Windows and
 * POSIX hosts — we want identical results regardless of where tests run.
 */

/** Convert `\` to `/` and collapse duplicate separators into one. */
function toSlash(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
}

/** Drop a trailing slash, but keep a lone "/" (POSIX root) intact. */
function stripTrailingSlash(p: string): string {
  if (p.length > 1 && p.endsWith("/")) {
    return p.replace(/\/+$/, "");
  }
  return p;
}

/**
 * Lowercase a leading Windows drive letter so `G:` and `g:` compare equal.
 * Only the drive letter changes; the rest of the path keeps its original case
 * (paths are case-sensitive on POSIX and we must not corrupt them).
 */
function lowerDriveLetter(p: string): string {
  return p.replace(/^([a-zA-Z]):/, (_m, d: string) => `${d.toLowerCase()}:`);
}

/**
 * Normalize a Claude Code `file_path` into a repo-relative, forward-slash path
 * when it lives under `cwd`; otherwise return a safely normalized path.
 *
 * Rules:
 *   1. Relative paths stay relative; only `\` → `/` normalization is applied.
 *   2. Absolute paths under `cwd` become relative to `cwd`.
 *   3. Absolute paths outside `cwd` are returned normalized (never crash).
 *   4. The result never starts with `/` when it is repo-relative, and the path
 *      equal to `cwd` collapses to ".".
 */
export function normalizeTargetPath(filePath: string, cwd?: string): string {
  const normalizedFile = stripTrailingSlash(toSlash(filePath));

  if (!cwd) {
    return normalizedFile;
  }

  const normalizedCwd = stripTrailingSlash(toSlash(cwd));
  if (!normalizedCwd) {
    return normalizedFile;
  }

  // Case-insensitive only on the drive letter; lengths are unchanged so we can
  // slice the original (correctly-cased) path using the cwd length.
  const fileKey = lowerDriveLetter(normalizedFile);
  const cwdKey = lowerDriveLetter(normalizedCwd);

  if (fileKey === cwdKey) {
    return ".";
  }

  if (fileKey.startsWith(`${cwdKey}/`)) {
    const rel = normalizedFile.slice(normalizedCwd.length + 1);
    return rel === "" ? "." : rel;
  }

  return normalizedFile;
}
