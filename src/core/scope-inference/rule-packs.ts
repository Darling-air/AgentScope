import type { ScopeRulePack } from "./rule-pack.js";

/**
 * Deterministic rule packs (V2.0).
 *
 * Each non-general pack describes a narrow, least-privilege path set for its
 * domain. The `general` pack is the only one that grants broad `src/**` /
 * `tests/**` access, and it is used only as a low-confidence fallback.
 *
 * Keyword lists here are the source of truth for both classification and
 * explanation. Adding a keyword to a pack makes the classifier recognize it.
 */

export const AUTH_PACK: ScopeRulePack = {
  id: "auth",
  label: "Authentication and login",
  keywords: [
    "auth",
    "authentication",
    "login",
    "logout",
    "signin",
    "sign-in",
    "signup",
    "sign-up",
    "session",
    "cookie",
    "jwt",
    "oauth",
    "redirect",
  ],
  allowed_paths: [
    "src/auth/**",
    "tests/auth/**",
    "src/**/auth/**",
    "src/**/login*",
    "tests/**/login*",
    "__tests__/**/login*",
  ],
  allowed_commands: ["npm test", "npm run lint"],
  rationale: ["Task references authentication/login/session keywords."],
};

export const API_PACK: ScopeRulePack = {
  id: "api",
  label: "API routes and controllers",
  keywords: [
    "api",
    "endpoint",
    "endpoints",
    "route",
    "routes",
    "router",
    "controller",
    "controllers",
    "request",
    "response",
    "handler",
    "handlers",
  ],
  allowed_paths: [
    "src/api/**",
    "src/routes/**",
    "src/controllers/**",
    "src/**/routes/**",
    "src/**/controllers/**",
    "tests/api/**",
    "tests/routes/**",
  ],
  allowed_commands: ["npm test", "npm run lint"],
  rationale: ["Task references API/route/controller keywords."],
};

export const DATABASE_PACK: ScopeRulePack = {
  id: "database",
  label: "Database, schema and migrations",
  keywords: [
    "database",
    "db",
    "migration",
    "migrations",
    "schema",
    "sql",
    "prisma",
    "drizzle",
    "model",
    "models",
  ],
  allowed_paths: [
    "src/db/**",
    "src/models/**",
    "src/**/models/**",
    "prisma/**",
    "tests/db/**",
  ],
  // migrations/** stays blocked by default in V2.0; surface it as high-risk so
  // its sensitivity is visible without unblocking it.
  high_risk: ["migrations/**", "prisma/schema.prisma"],
  allowed_commands: ["npm test", "npm run lint"],
  rationale: [
    "Task references database/schema/model keywords.",
    "migrations/** remains blocked; database changes there require an explicit scope edit.",
  ],
};

export const DEPENDENCIES_PACK: ScopeRulePack = {
  id: "dependencies",
  label: "Dependency and package management",
  keywords: [
    "dependency",
    "dependencies",
    "package",
    "packages",
    "npm",
    "pnpm",
    "yarn",
    "install",
    "upgrade",
    "bump",
    "lockfile",
  ],
  // Dependency tasks legitimately edit the manifest/lockfiles, which are the
  // default high-risk files. They stay high-risk (ask), not blocked.
  allowed_paths: [
    "package.json",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
  ],
  high_risk: [
    "package.json",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
  ],
  allowed_commands: ["npm test", "npm run lint"],
  rationale: [
    "Task references dependency/package keywords.",
    "Package manifests and lockfiles are allowed but flagged high-risk (require confirmation).",
  ],
};

export const DOCS_PACK: ScopeRulePack = {
  id: "docs",
  label: "Documentation",
  keywords: [
    "docs",
    "doc",
    "documentation",
    "readme",
    "guide",
    "guides",
    "changelog",
  ],
  allowed_paths: ["docs/**", "README*", "*.md", "**/*.md"],
  allowed_commands: ["npm run lint"],
  rationale: ["Task references documentation/readme keywords."],
};

export const TESTS_PACK: ScopeRulePack = {
  id: "tests",
  label: "Tests",
  keywords: [
    "test",
    "tests",
    "spec",
    "specs",
    "unit",
    "integration",
    "e2e",
  ],
  allowed_paths: [
    "tests/**",
    "__tests__/**",
    "**/*.test.*",
    "**/*.spec.*",
  ],
  allowed_commands: ["npm test", "npm run lint"],
  rationale: ["Task references testing keywords."],
};

export const FRONTEND_PACK: ScopeRulePack = {
  id: "frontend",
  label: "Frontend and UI",
  keywords: [
    "ui",
    "frontend",
    "component",
    "components",
    "page",
    "pages",
    "form",
    "forms",
    "button",
    "buttons",
    "layout",
    "css",
    "style",
    "styles",
    "styling",
    "navbar",
  ],
  allowed_paths: [
    "src/components/**",
    "src/pages/**",
    "src/styles/**",
    "src/**/components/**",
    "tests/components/**",
    "**/*.css",
  ],
  allowed_commands: ["npm test", "npm run lint"],
  rationale: ["Task references UI/component/style keywords."],
};

export const CONFIG_PACK: ScopeRulePack = {
  id: "config",
  label: "CI and project configuration",
  keywords: [
    "ci",
    "workflow",
    "workflows",
    "github",
    "action",
    "actions",
    "pipeline",
    "config",
    "configuration",
  ],
  allowed_paths: [".github/**", "*.config.js", "*.config.ts", "*.yml", "*.yaml"],
  // CI tasks need .github/**, which is blocked by default. Unblock it and mark
  // it high-risk so the change is visible.
  unblock_paths: [".github/**"],
  high_risk: [".github/**"],
  allowed_commands: ["npm run lint"],
  rationale: [
    "Task references CI/workflow/config keywords.",
    ".github/** moved out of blocked into allowed + high-risk for this task.",
  ],
};

/**
 * Low-confidence fallback. This is the ONLY pack that grants broad source/test
 * access. It is applied only when no specific domain is confidently matched.
 */
export const GENERAL_PACK: ScopeRulePack = {
  id: "general",
  label: "General (low-confidence fallback)",
  keywords: [],
  allowed_paths: ["src/**", "tests/**", "__tests__/**"],
  allowed_commands: ["npm test", "npm run lint"],
  rationale: [
    "No specific task domain matched with high confidence; using a conservative broad fallback (src/**, tests/**, __tests__/**).",
  ],
};

/** All domain rule packs, excluding the general fallback. */
export const DOMAIN_RULE_PACKS: ScopeRulePack[] = [
  AUTH_PACK,
  API_PACK,
  DATABASE_PACK,
  DEPENDENCIES_PACK,
  DOCS_PACK,
  TESTS_PACK,
  FRONTEND_PACK,
  CONFIG_PACK,
];

/** Lookup a rule pack by id (includes the general fallback). */
export function rulePackById(id: string): ScopeRulePack | undefined {
  if (id === GENERAL_PACK.id) return GENERAL_PACK;
  return DOMAIN_RULE_PACKS.find((p) => p.id === id);
}
