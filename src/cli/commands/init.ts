import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { getProjectPaths } from "../../core/fs/project-paths.js";
import { DEFAULT_CONFIG_YAML } from "../../core/config/default-config.js";
import { color } from "../ui.js";

/**
 * `agentscope init`
 *
 * Creates the .agentscope/ directory tree and a default config.yaml.
 * Does not silently overwrite an existing config — it reports and leaves it.
 */
export function initCommand(): void {
  const paths = getProjectPaths();

  // Ensure directory structure exists.
  for (const dir of [paths.agentscopeDir, paths.scopesDir, paths.evidenceDir]) {
    mkdirSync(dir, { recursive: true });
  }

  // .gitkeep so empty dirs survive in version control.
  for (const dir of [paths.scopesDir, paths.evidenceDir]) {
    const keep = `${dir}/.gitkeep`;
    if (!existsSync(keep)) writeFileSync(keep, "", "utf8");
  }

  if (existsSync(paths.configFile)) {
    console.log(
      `${color.yellow("!")} Config already exists at ${color.cyan(
        ".agentscope/config.yaml",
      )} — leaving it unchanged.`,
    );
    console.log(
      color.dim("  Delete it first if you want to regenerate defaults."),
    );
    return;
  }

  writeFileSync(paths.configFile, DEFAULT_CONFIG_YAML, "utf8");

  console.log(`${color.green("✔")} Initialized AgentScope.`);
  console.log("");
  console.log("Created:");
  console.log(`  ${color.cyan(".agentscope/config.yaml")}`);
  console.log(`  ${color.cyan(".agentscope/scopes/")}`);
  console.log(`  ${color.cyan(".agentscope/evidence/")}`);
  console.log("");
  console.log(`Next: ${color.bold('agentscope start "<task>"')}`);
}
