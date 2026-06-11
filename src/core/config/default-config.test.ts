import { describe, it, expect } from "vitest";
import { defaultConfig, DEFAULT_CONFIG_YAML } from "./default-config.js";
import { AgentScopeConfigSchema } from "../schema/config.js";
import { parse as parseYaml } from "yaml";

describe("defaultConfig (effective)", () => {
  it("includes the expected fallback allowed paths", () => {
    const cfg = defaultConfig();
    expect(cfg.inference.fallback.allowed_paths).toEqual([
      "src/**",
      "tests/**",
      "__tests__/**",
    ]);
  });

  it("blocks sensitive and infra paths by default", () => {
    const cfg = defaultConfig();
    expect(cfg.policy.blocked_paths).toContain(".env*");
    expect(cfg.policy.blocked_paths).toContain(".github/**");
    expect(cfg.policy.blocked_paths).toContain("migrations/**");
  });

  it("marks lockfiles and package.json as high risk", () => {
    const cfg = defaultConfig();
    expect(cfg.policy.high_risk).toContain("package.json");
    expect(cfg.policy.high_risk).toContain("pnpm-lock.yaml");
  });

  it("includes the built-in dangerous commands", () => {
    const cfg = defaultConfig();
    expect(cfg.policy.dangerous_commands).toContain("git push --force");
  });

  it("defaults the inference confidence threshold to 0.65", () => {
    expect(defaultConfig().inference.confidence_threshold).toBe(0.65);
  });
});

describe("DEFAULT_CONFIG_YAML", () => {
  it("parses and validates against the config schema", () => {
    const parsed = AgentScopeConfigSchema.safeParse(parseYaml(DEFAULT_CONFIG_YAML));
    expect(parsed.success).toBe(true);
  });

  it("uses the V2.1 version + structured shape", () => {
    const raw = parseYaml(DEFAULT_CONFIG_YAML) as Record<string, unknown>;
    expect(raw.version).toBe(1);
    expect(raw).toHaveProperty("policy");
    expect(raw).toHaveProperty("inference");
  });
});
