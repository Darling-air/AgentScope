import picomatch from "picomatch";

/**
 * Centralized path matching for AgentScope.
 *
 * Per the architecture, all glob matching must go through one place so that
 * matching semantics stay consistent across scope inference and scope checking.
 * V0 uses picomatch with dotfile matching enabled (so patterns like `.env*`
 * and `.github/**` behave as users expect).
 */

function normalize(filePath: string): string {
  // Normalize Windows-style separators so globs written with `/` always match.
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

/**
 * Returns true if `filePath` matches the given glob `pattern`.
 */
export function matchPath(filePath: string, pattern: string): boolean {
  const isMatch = picomatch(pattern, { dot: true });
  return isMatch(normalize(filePath));
}

/**
 * Returns the first pattern in `patterns` that matches `filePath`, or
 * undefined if none match. Returning the matched pattern lets callers build
 * explainable messages (e.g. "blocked path: .github/**").
 */
export function findMatchingPattern(
  filePath: string,
  patterns: string[],
): string | undefined {
  return patterns.find((pattern) => matchPath(filePath, pattern));
}

/**
 * Returns true if `filePath` matches any pattern in `patterns`.
 */
export function matchesAny(filePath: string, patterns: string[]): boolean {
  return findMatchingPattern(filePath, patterns) !== undefined;
}
