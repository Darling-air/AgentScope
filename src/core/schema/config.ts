import { z } from "zod";

/**
 * AgentScope project configuration schema (.agentscope/config.yaml).
 *
 * The config holds project-level defaults used by scope inference. It is kept
 * deliberately small in V0 — only the fields the V0 commands actually consume.
 */

export const AgentScopeConfigSchema = z.object({
  project: z
    .object({
      package_manager: z.string().default("auto"),
    })
    .default({ package_manager: "auto" }),
  defaults: z.object({
    allowed_paths: z.array(z.string()),
    blocked_paths: z.array(z.string()),
    high_risk: z.array(z.string()),
    allowed_commands: z.array(z.string()),
    dangerous_commands: z.array(z.string()).default([]),
  }),
});

export type AgentScopeConfig = z.infer<typeof AgentScopeConfigSchema>;
