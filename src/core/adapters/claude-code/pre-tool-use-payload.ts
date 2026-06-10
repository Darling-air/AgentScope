import { z } from "zod";

/**
 * Claude Code PreToolUse hook payload.
 *
 * This is the JSON Claude Code writes to a hook's stdin before a tool runs.
 * We validate only the fields AgentScope needs and keep `tool_input` open
 * (`record(unknown)`) so unsupported tools never crash the translator.
 *
 * V1.1 fully supports Read / Edit / Write / Bash. Other tool names parse fine
 * and are handled downstream as a safe fallback.
 */
export const ClaudePreToolUsePayloadSchema = z.object({
  session_id: z.string().optional(),
  transcript_path: z.string().optional(),
  cwd: z.string().optional(),
  permission_mode: z.string().optional(),
  hook_event_name: z.literal("PreToolUse"),
  tool_name: z.string().min(1),
  tool_input: z.record(z.unknown()),
});

export type ClaudePreToolUsePayload = z.infer<
  typeof ClaudePreToolUsePayloadSchema
>;
