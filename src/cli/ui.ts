/**
 * Tiny terminal output helpers. No external color dependency in V0 — just
 * enough ANSI to make `agentscope check` readable in a demo, with automatic
 * fallback when output is not a TTY or NO_COLOR is set.
 */

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;

function wrap(code: string, s: string): string {
  return useColor ? `\x1b[${code}m${s}\x1b[0m` : s;
}

export const color = {
  bold: (s: string) => wrap("1", s),
  dim: (s: string) => wrap("2", s),
  red: (s: string) => wrap("31", s),
  green: (s: string) => wrap("32", s),
  yellow: (s: string) => wrap("33", s),
  cyan: (s: string) => wrap("36", s),
};

export const symbol = {
  ok: useColor ? "✅" : "[OK]",
  warn: useColor ? "⚠" : "[WARN]",
  fail: useColor ? "❌" : "[FAIL]",
};

export function printList(items: string[], indent = "  "): void {
  if (items.length === 0) {
    console.log(`${indent}${color.dim("(none)")}`);
    return;
  }
  for (const item of items) {
    console.log(`${indent}- ${item}`);
  }
}
