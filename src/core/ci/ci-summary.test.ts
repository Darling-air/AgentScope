import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { EvidencePackageV1 } from "../evidence/evidence-package.js";
import type { EvidenceEvent } from "../evidence/evidence-event.js";
import type { PolicyDecision } from "../policy/policy-decision.js";
import type { ToolEvent } from "../events/tool-event.js";
import { calculateRiskScore } from "../risk/risk-engine.js";
import {
  DEFAULT_CI_SUMMARY_PATH,
  buildCiSummary,
  renderCiSummaryMarkdown,
  writeCiSummaryFile,
} from "./ci-summary.js";

let counter = 0;
function nextId(): string {
  counter += 1;
  return `evt-${counter}`;
}

interface EventSpec {
  decision: PolicyDecision["decision"];
  toolName?: string;
  action?: ToolEvent["action"];
  target?: string;
  command?: string;
  matchedRule?: string;
  riskDelta?: number;
}

function makeEvent(spec: EventSpec): EvidenceEvent {
  const id = nextId();
  const toolEvent: ToolEvent = {
    id,
    timestamp: "2026-06-10T10:00:00.000Z",
    agent: "claude-code",
    event_type: spec.command ? "command" : "tool_call",
    tool_source: spec.command ? "shell" : "builtin",
    tool_name: spec.toolName,
    action: spec.action,
    target: spec.target,
    command: spec.command,
  };
  const policy_decision: PolicyDecision = {
    decision: spec.decision,
    reason: `${spec.decision} test`,
    matched_rule: spec.matchedRule,
    risk_delta: spec.riskDelta,
  };
  return {
    id,
    timestamp: toolEvent.timestamp,
    agent: { name: "claude-code" },
    tool_event: toolEvent,
    policy_decision,
  };
}

function makePackage(events: EvidenceEvent[]): EvidencePackageV1 {
  return {
    version: "0.1",
    task: { id: "fix-login-redirect", title: "Fix login redirect bug" },
    scope: {
      scope_hash: "sha256:be8af5fd67",
      allowed_paths: ["src/auth/**"],
      blocked_paths: [".env*"],
      allowed_commands: ["npm test"],
      high_risk: ["package.json"],
    },
    events,
    policy_interventions: events.filter(
      (e) => e.policy_decision.decision !== "allow",
    ),
    created_at: "2026-06-10T10:00:00.000Z",
    updated_at: "2026-06-10T10:05:00.000Z",
  };
}

/** A package exercising deny + ask + high-risk so every section is populated. */
function richPackage(): EvidencePackageV1 {
  return makePackage([
    makeEvent({
      decision: "deny",
      toolName: "Read",
      action: "read",
      target: ".env.local",
      matchedRule: "blocked_paths:.env*",
    }),
    makeEvent({
      decision: "ask",
      toolName: "Write",
      action: "write",
      target: "package.json",
      matchedRule: "high_risk:package.json",
    }),
    makeEvent({
      decision: "allow",
      toolName: "Edit",
      action: "edit",
      target: "src/auth/login.ts",
    }),
  ]);
}

let tempDirs: string[] = [];
function tempPath(file: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), "agentscope-ci-summary-"));
  tempDirs.push(dir);
  return path.join(dir, file);
}

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe("buildCiSummary", () => {
  it("produces Markdown with all required sections", () => {
    const pkg = richPackage();
    const risk = calculateRiskScore(pkg);
    const { markdown } = buildCiSummary({ evidence: pkg, risk });

    expect(markdown).toContain("# AgentScope CI Summary");
    expect(markdown).toContain("Fix login redirect bug (fix-login-redirect)");
    expect(markdown).toContain("Scope Hash: sha256:be8af5fd67");
    expect(markdown).toContain(`Risk Score: ${risk.score} / 100`);
    expect(markdown).toContain(`Risk Level: ${risk.level}`);
    expect(markdown).toContain("Denied Actions:");
    expect(markdown).toContain("Asked Actions:");
    expect(markdown).toContain("High-Risk Actions:");
    expect(markdown).toContain("Top Risk Factors:");
    expect(markdown).toContain("Recommendations:");
  });

  it("lists denied, asked, and high-risk actions in Markdown", () => {
    const pkg = richPackage();
    const risk = calculateRiskScore(pkg);
    const { markdown } = buildCiSummary({ evidence: pkg, risk });

    expect(markdown).toContain("- Read .env.local [blocked_paths:.env*]");
    expect(markdown).toContain("- Write package.json [high_risk:package.json]");
  });

  it("renders (none) for empty action sections", () => {
    const pkg = makePackage([
      makeEvent({ decision: "allow", toolName: "Read", target: "src/a.ts" }),
    ]);
    const risk = calculateRiskScore(pkg);
    const { markdown } = buildCiSummary({ evidence: pkg, risk });

    // No denies, no asks, no high-risk -> each section shows the placeholder.
    expect(markdown.match(/- \(none\)/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("JSON output has the expected structure", () => {
    const pkg = richPackage();
    const risk = calculateRiskScore(pkg);
    const { json } = buildCiSummary({ evidence: pkg, risk });

    expect(json.summary_path).toBe(DEFAULT_CI_SUMMARY_PATH);
    expect(json.task).toEqual({
      id: "fix-login-redirect",
      title: "Fix login redirect bug",
    });
    expect(json.scope_hash).toBe("sha256:be8af5fd67");
    expect(json.score).toBe(risk.score);
    expect(json.level).toBe(risk.level);
    expect(json.counts).toEqual(risk.counts);
    expect(json.denied_actions).toHaveLength(1);
    expect(json.asked_actions).toHaveLength(1);
    expect(json.high_risk_actions).toHaveLength(1);
    expect(Array.isArray(json.top_factors)).toBe(true);
    expect(Array.isArray(json.recommendations)).toBe(true);
  });

  it("top factors are sorted by points descending", () => {
    const pkg = richPackage();
    const risk = calculateRiskScore(pkg);
    const { json } = buildCiSummary({ evidence: pkg, risk });

    const points = json.top_factors.map((f) => f.points);
    const sorted = [...points].sort((a, b) => b - a);
    expect(points).toEqual(sorted);
  });

  it("custom summaryPath flows into the JSON (normalized)", () => {
    const pkg = richPackage();
    const risk = calculateRiskScore(pkg);
    const { json } = buildCiSummary({
      evidence: pkg,
      risk,
      summaryPath: "out\\custom\\summary.md",
    });
    expect(json.summary_path).toBe("out/custom/summary.md");
  });

  it("is deterministic for the same input", () => {
    const pkg = richPackage();
    const risk = calculateRiskScore(pkg);
    const a = buildCiSummary({ evidence: pkg, risk });
    const b = buildCiSummary({ evidence: pkg, risk });
    expect(a).toEqual(b);
  });

  it("does not mutate the evidence or risk inputs", () => {
    const pkg = richPackage();
    const risk = calculateRiskScore(pkg);
    const pkgBefore = JSON.stringify(pkg);
    const riskBefore = JSON.stringify(risk);

    buildCiSummary({ evidence: pkg, risk });

    expect(JSON.stringify(pkg)).toBe(pkgBefore);
    expect(JSON.stringify(risk)).toBe(riskBefore);
  });
});

describe("writeCiSummaryFile", () => {
  it("writes Markdown to a custom output path", () => {
    const pkg = richPackage();
    const risk = calculateRiskScore(pkg);
    const target = tempPath("nested/summary.md");
    const { markdown } = buildCiSummary({
      evidence: pkg,
      risk,
      summaryPath: target,
    });

    writeCiSummaryFile(target, markdown);

    const written = readFileSync(target, "utf8");
    expect(written).toBe(markdown);
    expect(written).toContain("# AgentScope CI Summary");
  });

  it("repeated writes produce identical content", () => {
    const pkg = richPackage();
    const risk = calculateRiskScore(pkg);
    const target = tempPath("summary.md");
    const { markdown } = buildCiSummary({
      evidence: pkg,
      risk,
      summaryPath: target,
    });

    writeCiSummaryFile(target, markdown);
    const first = readFileSync(target, "utf8");
    writeCiSummaryFile(target, markdown);
    const second = readFileSync(target, "utf8");

    expect(first).toBe(second);
  });
});

describe("renderCiSummaryMarkdown", () => {
  it("includes the evidence path when present", () => {
    const pkg = richPackage();
    const risk = calculateRiskScore(pkg, {
      evidencePath: ".agentscope\\evidence\\latest.json",
    });
    const { json } = buildCiSummary({ evidence: pkg, risk });
    const markdown = renderCiSummaryMarkdown(json);

    expect(markdown).toContain(
      "Evidence Path: .agentscope/evidence/latest.json",
    );
  });

  it("ends with a trailing newline", () => {
    const pkg = richPackage();
    const risk = calculateRiskScore(pkg);
    const { markdown } = buildCiSummary({ evidence: pkg, risk });
    expect(markdown.endsWith("\n")).toBe(true);
  });
});
