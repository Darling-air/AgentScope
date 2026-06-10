/**
 * A ScopeRulePack maps a task domain (e.g. "auth") to the narrow set of paths,
 * commands, and risk markers a task in that domain should be allowed to touch.
 *
 * Rule packs are deterministic data — no LLM, no network. The inference engine
 * matches a classified task to one or more packs and merges them into a
 * ScopeContract. Packs deliberately avoid broad globs like `src/**`; that is
 * reserved for the low-confidence `general` fallback pack only.
 */
export interface ScopeRulePack {
  id: string;
  label: string;
  /** Keywords that select this pack (kept for documentation/explanation). */
  keywords: string[];
  /** Narrow paths a task in this domain may edit. */
  allowed_paths: string[];
  /** Commands this domain typically needs. */
  allowed_commands?: string[];
  /** Extra high-risk paths specific to this domain. */
  high_risk?: string[];
  /**
   * Paths to remove from the default blocked list for this domain (and surface
   * as allowed + high-risk instead). Used sparingly, e.g. config/ci tasks that
   * legitimately need `.github/**`.
   */
  unblock_paths?: string[];
  /** Human-readable explanation lines for why this pack applies. */
  rationale: string[];
}
