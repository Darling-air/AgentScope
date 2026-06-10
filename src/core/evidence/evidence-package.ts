import { z } from "zod";
import { EvidenceEventSchema } from "./evidence-event.js";

/**
 * EvidencePackageV1 (V1.3).
 *
 * The local audit artifact written to `.agentscope/evidence/latest.json`. It
 * pins the task + a stable scope snapshot (so events can be tied to the exact
 * scope that governed them via `scope_hash`) and accumulates EvidenceEvents.
 *
 * `events` holds every decision (allow / deny / ask / warn). `policy_interventions`
 * is a convenience projection of the non-allow events. It is deliberately NOT
 * named `blocked_actions`: an `ask`/`warn` is not strictly blocked.
 *
 * V1.3 scope only: no risk score, no diff/transcript hashes, no signatures.
 */
export const EVIDENCE_PACKAGE_VERSION = "0.1" as const;

export const EvidenceScopeSnapshotSchema = z.object({
  scope_hash: z.string().min(1),
  allowed_paths: z.array(z.string()),
  blocked_paths: z.array(z.string()),
  allowed_commands: z.array(z.string()),
  high_risk: z.array(z.string()),
});

export type EvidenceScopeSnapshot = z.infer<typeof EvidenceScopeSnapshotSchema>;

export const EvidenceTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  raw_input: z.string().optional(),
});

export type EvidenceTask = z.infer<typeof EvidenceTaskSchema>;

export const EvidencePackageV1Schema = z.object({
  version: z.literal(EVIDENCE_PACKAGE_VERSION),
  task: EvidenceTaskSchema,
  scope: EvidenceScopeSnapshotSchema,
  events: z.array(EvidenceEventSchema),
  policy_interventions: z.array(EvidenceEventSchema),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
});

export type EvidencePackageV1 = z.infer<typeof EvidencePackageV1Schema>;
