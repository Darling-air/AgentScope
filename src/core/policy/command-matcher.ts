/**
 * Command matching for AgentScope policy evaluation.
 *
 * This is deliberately NOT a shell parser. It supports a small, predictable set
 * of patterns that cover the V1.0 allowed/dangerous command lists:
 *
 *   - exact:           "npm test"            matches "npm test"
 *   - trailing glob:   "npm test *"          matches "npm test", "npm test auth"
 *   - dangerous glob:  "rm -rf *"            matches "rm -rf node_modules"
 *   - pipe pattern:    "curl * | sh"         matches "curl https://x/i.sh | sh"
 *   - generic glob:    "sudo *"              matches "sudo apt update"
 *
 * Matching is whitespace-insensitive (runs of whitespace collapse to one space)
 * and case-sensitive. A `*` in a pattern matches any run of characters,
 * including across pipes; `*` also matches the empty string so "npm test *"
 * matches a bare "npm test".
 */

/** Collapse whitespace runs and trim, so spacing differences do not matter. */
function normalizeCommand(command: string): string {
  return command.trim().replace(/\s+/g, " ");
}

/** Escape regex metacharacters, except `*` which we translate to `.*`. */
function patternToRegExp(pattern: string): RegExp {
  const normalized = normalizeCommand(pattern);
  const escaped = normalized.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  // A `*` preceded by a space (e.g. "npm test *") should also match when the
  // tail is absent ("npm test"), so make the separating space optional.
  const body = escaped
    .replace(/ \*/g, "(?: .*)?")
    .replace(/\*/g, ".*");
  return new RegExp(`^${body}$`);
}

/**
 * Returns true if `command` matches `pattern` under the rules above.
 */
export function matchCommand(command: string, pattern: string): boolean {
  const normalizedCommand = normalizeCommand(command);
  const normalizedPattern = normalizeCommand(pattern);

  // Fast path: exact equality.
  if (normalizedCommand === normalizedPattern) return true;

  // Only build a regex when the pattern actually contains a wildcard.
  if (!normalizedPattern.includes("*")) return false;

  return patternToRegExp(normalizedPattern).test(normalizedCommand);
}

/**
 * Returns the first pattern in `patterns` that matches `command`, or undefined.
 * Returning the matched pattern lets callers build explainable reasons.
 */
export function findMatchingCommand(
  command: string,
  patterns: string[],
): string | undefined {
  return patterns.find((pattern) => matchCommand(command, pattern));
}
