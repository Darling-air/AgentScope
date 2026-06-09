import { z } from "zod";

/**
 * Task Scope Contract schema.
 *
 * The Task Scope Contract is the most important data structure in AgentScope.
 * It is agent-agnostic: it describes what a single AI coding session is allowed
 * to do, not allowed to do, and which operations are considered high risk.
 */

export const TaskInfoSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  raw_input: z.string().min(1),
});

export type TaskInfo = z.infer<typeof TaskInfoSchema>;

export const ScopeContractSchema = z.object({
  version: z.string(),
  task: TaskInfoSchema,
  confidence: z.number().min(0).max(1),
  allowed_paths: z.array(z.string()),
  blocked_paths: z.array(z.string()),
  allowed_commands: z.array(z.string()),
  high_risk: z.array(z.string()),
  rationale: z.array(z.string()).default([]),
  created_at: z.string(),
});

export type ScopeContract = z.infer<typeof ScopeContractSchema>;

export const SCOPE_CONTRACT_VERSION = "0.1";
