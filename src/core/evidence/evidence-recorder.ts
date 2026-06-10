import type { ScopeContract } from "../schema/scope-contract.js";
import type { ToolEvent } from "../events/tool-event.js";
import type { PolicyDecision } from "../policy/policy-decision.js";
import {
  EVIDENCE_PACKAGE_VERSION,
  type EvidencePackageV1,
  type EvidenceTask,
} from "./evidence-package.js";
import {
  isPolicyIntervention,
  type EvidenceAgent,
  type EvidenceEvent,
} from "./evidence-event.js";
import { buildScopeSnapshot } from "./scope-hash.js";
import {
  readEvidencePackage,
  writeEvidencePackage,
} from "./evidence-store.js";

/**
 * Evidence recorder (V1.3).
 *
 * Turns a (scope, ToolEvent, PolicyDecision, agent) tuple into an EvidenceEvent
 * and folds it into an EvidencePackage. The package-building logic is pure and
 * deterministic (timestamps are injected); the on-disk recording wrapper is
 * separate and best-effort.
 */

export interface BuildEvidenceEventInput {
  id: string;
  timestamp: string;
  agent: EvidenceAgent;
  toolEvent: ToolEvent;
  decision: PolicyDecision;
}

/** Builds a single EvidenceEvent from a decision. */
export function buildEvidenceEvent(
  input: BuildEvidenceEventInput,
): EvidenceEvent {
  return {
    id: input.id,
    timestamp: input.timestamp,
    agent: input.agent,
    tool_event: input.toolEvent,
    policy_decision: input.decision,
  };
}

function taskFromScope(scope: ScopeContract): EvidenceTask {
  return {
    id: scope.task.id,
    title: scope.task.title,
    raw_input: scope.task.raw_input,
  };
}

/** Recomputes `policy_interventions` from the full `events` list. */
function withInterventions(events: EvidenceEvent[]): EvidenceEvent[] {
  return events.filter(isPolicyIntervention);
}

export interface AppendEvidenceInput {
  /** Existing package read from disk, or undefined if none / unreadable. */
  existing: EvidencePackageV1 | undefined;
  scope: ScopeContract;
  event: EvidenceEvent;
  /** ISO timestamp used for created_at (new package) and updated_at. */
  now: string;
}

/**
 * Pure package update. Decides whether to append to the existing package or
 * start a fresh one based on scope_hash:
 *
 *   - no existing package           -> create new
 *   - existing, same scope_hash     -> append the event
 *   - existing, different scope_hash -> reset (new package for the new scope)
 */
export function appendEvidenceEvent(
  input: AppendEvidenceInput,
): EvidencePackageV1 {
  const { existing, scope, event, now } = input;
  const snapshot = buildScopeSnapshot(scope);

  const sameScope =
    existing !== undefined &&
    existing.scope.scope_hash === snapshot.scope_hash;

  if (!sameScope) {
    const events = [event];
    return {
      version: EVIDENCE_PACKAGE_VERSION,
      task: taskFromScope(scope),
      scope: snapshot,
      events,
      policy_interventions: withInterventions(events),
      created_at: now,
      updated_at: now,
    };
  }

  const events = [...existing.events, event];
  return {
    ...existing,
    // Refresh task/scope from the current scope (same hash -> same content).
    task: taskFromScope(scope),
    scope: snapshot,
    events,
    policy_interventions: withInterventions(events),
    updated_at: now,
  };
}

export interface RecordEvidenceInput {
  latestFile: string;
  scope: ScopeContract;
  event: EvidenceEvent;
  now: string;
}

export interface RecordEvidenceResult {
  ok: boolean;
  /** Present when ok; the package that was written. */
  pkg?: EvidencePackageV1;
  /** Present when !ok; the error that was swallowed. */
  error?: unknown;
}

/**
 * Best-effort recording: read latest.json, fold in the event, write it back.
 *
 * Never throws. Any failure (unreadable/corrupt artifact, write error) is
 * captured in the result so the caller — the live hook — can ignore it and
 * still return its policy response. Evidence must never break enforcement.
 */
export function recordEvidence(
  input: RecordEvidenceInput,
): RecordEvidenceResult {
  try {
    const existing = readEvidencePackage(input.latestFile);
    const pkg = appendEvidenceEvent({
      existing,
      scope: input.scope,
      event: input.event,
      now: input.now,
    });
    writeEvidencePackage(input.latestFile, pkg);
    return { ok: true, pkg };
  } catch (error) {
    return { ok: false, error };
  }
}
