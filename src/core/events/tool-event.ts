import { z } from "zod";

/**
 * ToolEvent — the agent-agnostic representation of a single agent action.
 *
 * Any agent (Claude Code, Cursor, Codex, a custom runner) is expected to map
 * its native tool calls into this shape before handing them to the PolicyEngine.
 * Keeping this neutral is what lets the policy layer stay agent-agnostic.
 *
 * V1.0 only exercises Read / Edit / Write / Bash, but `tool_name` and
 * `tool_source` stay open (string / enum) so future tools and MCP sources slot
 * in without schema churn. MCP is only a `tool_source` value here — there is no
 * MCP-specific logic in V1.0.
 */

export const ToolEventTypeSchema = z.enum(["tool_call", "command"]);
export type ToolEventType = z.infer<typeof ToolEventTypeSchema>;

export const ToolSourceSchema = z.enum(["builtin", "shell", "mcp", "custom"]);
export type ToolSource = z.infer<typeof ToolSourceSchema>;

export const ToolActionSchema = z.enum(["read", "write", "edit", "execute"]);
export type ToolAction = z.infer<typeof ToolActionSchema>;

export const ToolEventSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string().min(1),
  agent: z.string().min(1),
  event_type: ToolEventTypeSchema,
  tool_source: ToolSourceSchema,
  /** e.g. "Read" | "Edit" | "Write" | "Bash"; left open for future tools. */
  tool_name: z.string().optional(),
  action: ToolActionSchema.optional(),
  /** File path for file events. */
  target: z.string().optional(),
  /** Shell command string for command events. */
  command: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type ToolEvent = z.infer<typeof ToolEventSchema>;
