import type { ScopeOverridePatch } from "../core/scope/override.js";

/**
 * Shared override-flag plumbing for `agentscope start` and `agentscope scope apply`.
 *
 * Commander collects repeatable `--add-allowed`, `--remove-allowed`, etc. into
 * string arrays; this turns those raw arrays into a ScopeOverridePatch and
 * exposes the option definitions so both commands stay in sync.
 */
export interface OverrideFlagValues {
  addAllowed?: string[];
  removeAllowed?: string[];
  addBlocked?: string[];
  removeBlocked?: string[];
  addHighRisk?: string[];
  removeHighRisk?: string[];
  addCommand?: string[];
  removeCommand?: string[];
}

/** A commander "collect into array" accumulator for repeatable options. */
export function collect(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

/** Builds a ScopeOverridePatch from parsed override flag values. */
export function buildOverridePatch(
  flags: OverrideFlagValues,
): ScopeOverridePatch {
  return {
    allowed_paths: { add: flags.addAllowed ?? [], remove: flags.removeAllowed ?? [] },
    blocked_paths: { add: flags.addBlocked ?? [], remove: flags.removeBlocked ?? [] },
    high_risk: { add: flags.addHighRisk ?? [], remove: flags.removeHighRisk ?? [] },
    allowed_commands: {
      add: flags.addCommand ?? [],
      remove: flags.removeCommand ?? [],
    },
  };
}
