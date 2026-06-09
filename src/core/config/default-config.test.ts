import { describe, it, expect } from "vitest";
import { defaultConfig } from "./default-config.js";
import { AgentScopeConfigSchema } from "../schema/config.js";

describe("defaultConfig", () => {
  it("produces a config that satisfies the schema", () => {
    const parsed = AgentScopeConfigSchema.safeParse(defaultConfig());
    expect(parsed.success).toBe(true);
  });

  it("includes the expected default allowed paths", () => {
    const cfg = defaultConfig();
    expect(cfg.defaults.allowed_paths).toEqual([
      "src/**",
      "tests/**",
      "__tests__/**",
    ]);
  });

  it("blocks sensitive and infra paths by default", () => {
    const cfg = defaultConfig();
    expect(cfg.defaults.blocked_paths).toContain(".env*");
    expect(cfg.defaults.blocked_paths).toContain(".github/**");
    expect(cfg.defaults.blocked_paths).toContain("migrations/**");
  });

  it("marks lockfiles and package.json as high risk", () => {
    const cfg = defaultConfig();
    expect(cfg.defaults.high_risk).toContain("package.json");
    expect(cfg.defaults.high_risk).toContain("pnpm-lock.yaml");
  });

  it("defaults package_manager to auto", () => {
    expect(defaultConfig().project.package_manager).toBe("auto");
  });
});
