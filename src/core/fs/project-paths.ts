import path from "node:path";

/**
 * Resolves the canonical locations of AgentScope files within a project root.
 * Keeping these in one place avoids hard-coded paths scattered across commands.
 */
export interface ProjectPaths {
  root: string;
  agentscopeDir: string;
  configFile: string;
  currentScopeFile: string;
  scopesDir: string;
  evidenceDir: string;
}

export function getProjectPaths(root: string = process.cwd()): ProjectPaths {
  const agentscopeDir = path.join(root, ".agentscope");
  return {
    root,
    agentscopeDir,
    configFile: path.join(agentscopeDir, "config.yaml"),
    currentScopeFile: path.join(agentscopeDir, "current-scope.yaml"),
    scopesDir: path.join(agentscopeDir, "scopes"),
    evidenceDir: path.join(agentscopeDir, "evidence"),
  };
}

/** Path to the per-task scope snapshot, e.g. .agentscope/scopes/<id>.yaml */
export function scopeFileForTask(paths: ProjectPaths, taskId: string): string {
  return path.join(paths.scopesDir, `${taskId}.yaml`);
}
