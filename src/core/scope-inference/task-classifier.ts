import { DOMAIN_RULE_PACKS } from "./rule-packs.js";

/**
 * Deterministic task classifier (V2.0).
 *
 * Tokenizes a natural-language task and matches tokens against each rule pack's
 * keyword list to decide which domain(s) the task belongs to. No LLM, no
 * network — identical input always yields identical output.
 */

export interface DomainMatch {
  domain: string;
  /** Distinct keywords from this domain that the task hit. */
  matchedKeywords: string[];
  /** Number of distinct keyword hits for this domain. */
  hits: number;
}

export interface TaskClassification {
  /** Domains matched, ordered by hit count (desc), then rule-pack order. */
  domains: string[];
  /**
   * Intents are coarse verbs extracted from the task (e.g. "fix", "add"). They
   * are informational only in V2.0 and do not change path selection.
   */
  intents: string[];
  /** All distinct keywords matched across every domain. */
  keywords: string[];
  /** Deterministic confidence in [0,1]. */
  confidence: number;
  /** Per-domain match detail, ordered like `domains`. */
  matches: DomainMatch[];
  rationale: string[];
}

const INTENT_KEYWORDS = [
  "fix",
  "add",
  "update",
  "remove",
  "refactor",
  "improve",
  "implement",
  "create",
  "delete",
  "upgrade",
  "bump",
  "migrate",
];

/** Splits a task title into lowercased alphanumeric tokens. */
export function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .split(/[^a-z0-9-]+/)
    .map((t) => t.replace(/^-+|-+$/g, ""))
    .filter(Boolean);
}

/**
 * Confidence model (deterministic):
 *   - No domain matched           -> 0.50
 *   - Exactly one domain matched  -> 0.72 (one hit) / 0.80 (2+ hits)
 *   - Multiple domains matched    -> 0.66 (ambiguous across domains)
 *
 * The 0.65 threshold used by the inference engine to suppress the broad
 * fallback sits just below the single-domain values, so a clear single-domain
 * task (auth/login) stays narrow while a vague or cross-cutting task falls back.
 */
function computeConfidence(matches: DomainMatch[]): number {
  if (matches.length === 0) return 0.5;
  if (matches.length === 1) {
    return matches[0]!.hits >= 2 ? 0.8 : 0.72;
  }
  // More than one domain hit: the task is ambiguous; keep it below the
  // single-domain confidence but above the no-match floor.
  return 0.66;
}

export function classifyTask(rawInput: string): TaskClassification {
  const tokens = tokenize(rawInput);
  const tokenSet = new Set(tokens);

  const matches: DomainMatch[] = [];
  for (const pack of DOMAIN_RULE_PACKS) {
    const matchedKeywords = pack.keywords.filter((kw) =>
      kw.includes("-") ? rawInput.toLowerCase().includes(kw) : tokenSet.has(kw),
    );
    if (matchedKeywords.length > 0) {
      matches.push({
        domain: pack.id,
        matchedKeywords,
        hits: matchedKeywords.length,
      });
    }
  }

  // Order by hit count desc; ties keep DOMAIN_RULE_PACKS order (stable sort).
  matches.sort((a, b) => b.hits - a.hits);

  const intents = INTENT_KEYWORDS.filter((k) => tokenSet.has(k));
  const keywords = [...new Set(matches.flatMap((m) => m.matchedKeywords))];
  const confidence = computeConfidence(matches);

  const rationale: string[] = [];
  if (matches.length === 0) {
    rationale.push(
      "No domain keywords matched; task classified as general with low confidence.",
    );
  } else {
    for (const m of matches) {
      rationale.push(
        `Matched ${m.domain} domain via keyword(s): ${m.matchedKeywords.join(", ")}.`,
      );
    }
    if (matches.length > 1) {
      rationale.push(
        "Task matched multiple domains; confidence reduced due to ambiguity.",
      );
    }
  }

  return {
    domains: matches.map((m) => m.domain),
    intents,
    keywords,
    confidence,
    matches,
    rationale,
  };
}
