import { describe, it, expect, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  existsSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  readEvidencePackage,
  writeEvidencePackage,
  clearEvidence,
} from "./evidence-store.js";
import {
  appendEvidenceEvent,
  buildEvidenceEvent,
  recordEvidence,
} from "./evidence-recorder.js";
import type { ScopeContract } from "../schema/scope-contract.js";
import type { ToolEvent } from "../events/tool-event.js";
import type { PolicyDecision } from "../policy/policy-decision.js";

const tmpDirs: string[] = [];

function tmpLatest(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "agentscope-evidence-"));
  tmpDirs.push(dir);
  return path.join(dir, "evidence", "latest.json");
}

afterEach(() => {
  while (tmpDirs.length) {
    const dir = tmpDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

const scope: ScopeContract = {
  version: "0.1",
  task: {
    id: "fix-login-redirect",
    title: "Fix login redirect bug",
    raw_input: "Fix login redirect bug",
  },
  confidence: 0.8,
  allowed_paths: ["src/auth/**"],
  blocked_paths: [".env*"],
  allowed_commands: ["npm test"],
  high_risk: ["package.json"],
  rationale: [],
  created_at: "2026-06-10T10:00:00.000Z",
};

function makeEvent(
  decision: PolicyDecision["decision"],
  target: string,
  id = "evt-1",
) {
  const toolEvent: ToolEvent = {
    id,
    timestamp: "2026-06-10T10:00:00.000Z",
    agent: "claude-code",
    event_type: "tool_call",
    tool_source: "builtin",
    tool_name: "Read",
    action: "read",
    target,
  };
  const policyDecision: PolicyDecision = { decision, reason: `${decision} ${target}` };
  return buildEvidenceEvent({
    id,
    timestamp: toolEvent.timestamp,
    agent: { name: "claude-code" },
    toolEvent,
    decision: policyDecision,
  });
}

describe("evidence store", () => {
  it("returns undefined when latest.json does not exist", () => {
    const latest = tmpLatest();
    expect(readEvidencePackage(latest)).toBeUndefined();
  });

  it("creates latest.json (and the evidence dir) on write", () => {
    const latest = tmpLatest();
    const pkg = appendEvidenceEvent({
      existing: undefined,
      scope,
      event: makeEvent("deny", ".env.local"),
      now: "2026-06-10T10:00:00.000Z",
    });
    writeEvidencePackage(latest, pkg);
    expect(existsSync(latest)).toBe(true);
    const roundTrip = readEvidencePackage(latest);
    expect(roundTrip?.events).toHaveLength(1);
  });

  it("returns undefined for corrupt JSON (does not throw)", () => {
    const latest = tmpLatest();
    const pkg = appendEvidenceEvent({
      existing: undefined,
      scope,
      event: makeEvent("deny", ".env.local"),
      now: "2026-06-10T10:00:00.000Z",
    });
    writeEvidencePackage(latest, pkg); // ensures dir exists
    writeFileSync(latest, "{ not json", "utf8");
    expect(readEvidencePackage(latest)).toBeUndefined();
  });

  it("clears latest.json", () => {
    const latest = tmpLatest();
    const pkg = appendEvidenceEvent({
      existing: undefined,
      scope,
      event: makeEvent("allow", "src/auth/login.ts"),
      now: "2026-06-10T10:00:00.000Z",
    });
    writeEvidencePackage(latest, pkg);
    expect(clearEvidence(latest).removed).toBe(true);
    expect(existsSync(latest)).toBe(false);
  });

  it("clear on missing file is a safe no-op", () => {
    const latest = tmpLatest();
    const result = clearEvidence(latest);
    expect(result.removed).toBe(false);
  });
});

describe("appendEvidenceEvent", () => {
  it("creates a new package when none exists", () => {
    const pkg = appendEvidenceEvent({
      existing: undefined,
      scope,
      event: makeEvent("deny", ".env.local"),
      now: "2026-06-10T10:00:00.000Z",
    });
    expect(pkg.events).toHaveLength(1);
    expect(pkg.task.id).toBe("fix-login-redirect");
    expect(pkg.created_at).toBe("2026-06-10T10:00:00.000Z");
  });

  it("appends when scope_hash is unchanged", () => {
    const first = appendEvidenceEvent({
      existing: undefined,
      scope,
      event: makeEvent("deny", ".env.local", "evt-1"),
      now: "2026-06-10T10:00:00.000Z",
    });
    const second = appendEvidenceEvent({
      existing: first,
      scope,
      event: makeEvent("allow", "src/auth/login.ts", "evt-2"),
      now: "2026-06-10T10:05:00.000Z",
    });
    expect(second.events).toHaveLength(2);
    expect(second.created_at).toBe("2026-06-10T10:00:00.000Z");
    expect(second.updated_at).toBe("2026-06-10T10:05:00.000Z");
  });

  it("resets the package when scope_hash changes", () => {
    const first = appendEvidenceEvent({
      existing: undefined,
      scope,
      event: makeEvent("deny", ".env.local", "evt-1"),
      now: "2026-06-10T10:00:00.000Z",
    });
    const changedScope: ScopeContract = {
      ...scope,
      allowed_paths: ["src/**", "tests/**"],
    };
    const second = appendEvidenceEvent({
      existing: first,
      scope: changedScope,
      event: makeEvent("allow", "src/index.ts", "evt-2"),
      now: "2026-06-10T11:00:00.000Z",
    });
    expect(second.events).toHaveLength(1);
    expect(second.created_at).toBe("2026-06-10T11:00:00.000Z");
    expect(second.scope.allowed_paths).toEqual(["src/**", "tests/**"]);
  });

  it("policy_interventions only includes non-allow decisions", () => {
    let pkg = appendEvidenceEvent({
      existing: undefined,
      scope,
      event: makeEvent("deny", ".env.local", "evt-1"),
      now: "2026-06-10T10:00:00.000Z",
    });
    pkg = appendEvidenceEvent({
      existing: pkg,
      scope,
      event: makeEvent("allow", "src/auth/login.ts", "evt-2"),
      now: "2026-06-10T10:01:00.000Z",
    });
    pkg = appendEvidenceEvent({
      existing: pkg,
      scope,
      event: makeEvent("ask", "package.json", "evt-3"),
      now: "2026-06-10T10:02:00.000Z",
    });
    expect(pkg.events).toHaveLength(3);
    expect(pkg.policy_interventions).toHaveLength(2);
    expect(
      pkg.policy_interventions.every(
        (e) => e.policy_decision.decision !== "allow",
      ),
    ).toBe(true);
  });
});

describe("recordEvidence", () => {
  it("writes a package and reports ok", () => {
    const latest = tmpLatest();
    const result = recordEvidence({
      latestFile: latest,
      scope,
      event: makeEvent("deny", ".env.local"),
      now: "2026-06-10T10:00:00.000Z",
    });
    expect(result.ok).toBe(true);
    expect(readEvidencePackage(latest)?.events).toHaveLength(1);
  });

  it("does not throw and reports !ok when the path is unwritable", () => {
    // A path whose parent is a file, not a directory, cannot be created.
    const latest = tmpLatest();
    writeEvidencePackage(latest, {
      version: "0.1",
      task: { id: "x", title: "x" },
      scope: {
        scope_hash: "sha256:x",
        allowed_paths: [],
        blocked_paths: [],
        allowed_commands: [],
        high_risk: [],
      },
      events: [],
      policy_interventions: [],
      created_at: "2026-06-10T10:00:00.000Z",
      updated_at: "2026-06-10T10:00:00.000Z",
    });
    // latest is now a file; use it as a "directory" parent to force failure.
    const badPath = path.join(latest, "nested", "latest.json");
    const result = recordEvidence({
      latestFile: badPath,
      scope,
      event: makeEvent("deny", ".env.local"),
      now: "2026-06-10T10:00:00.000Z",
    });
    expect(result.ok).toBe(false);
  });

  it("preserves the original file content on a write that targets it after corruption", () => {
    const latest = tmpLatest();
    recordEvidence({
      latestFile: latest,
      scope,
      event: makeEvent("deny", ".env.local", "evt-1"),
      now: "2026-06-10T10:00:00.000Z",
    });
    // Corrupt it; the recorder should treat it as "no existing" and reset.
    writeFileSync(latest, "garbage", "utf8");
    const result = recordEvidence({
      latestFile: latest,
      scope,
      event: makeEvent("allow", "src/auth/login.ts", "evt-2"),
      now: "2026-06-10T10:01:00.000Z",
    });
    expect(result.ok).toBe(true);
    const text = readFileSync(latest, "utf8");
    expect(text).toContain("src/auth/login.ts");
  });
});
