import { z } from "zod";
import { ToolEventSchema } from "../events/tool-event.js";
import { PolicyDecisionSchema } from "../policy/policy-decision.js";

/**
 * EvidenceEvent (V1.3).
 *
 * A single, locally-recorded audit entry: one ToolEvent that AgentScope saw and
 * the PolicyDecision it returned, tagged with which agent produced it.
 *
 * This is governance metadata only. It deliberately does NOT carry file
 * contents, command output, or the agent's reply text — only enough to explain
 * "what was requested and what AgentScope decided".
 */
export const EvidenceAgentSchema = z.object({
  name: z.literal("claude-code"),
  session_id: z.string().optional(),
  transcript_path: z.string().optional(),
});

export type EvidenceAgent = z.infer<typeof EvidenceAgentSchema>;

export const EvidenceEventSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string().min(1),
  agent: EvidenceAgentSchema,
  tool_event: ToolEventSchema,
  policy_decision: PolicyDecisionSchema,
});

export type EvidenceEvent = z.infer<typeof EvidenceEventSchema>;

/** True when a decision is a policy intervention (anything other than allow). */
export function isPolicyIntervention(event: EvidenceEvent): boolean {
  return event.policy_decision.decision !== "allow";
}
