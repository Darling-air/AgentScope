#!/usr/bin/env node
// AgentScope smoke test.
//
// Exercises the built CLI end-to-end in a throwaway temp directory. It is fully
// offline, never touches the current repo, and does NOT require a live Claude
// Code session or any real evidence. Exits 0 when every step passes, 1 on the
// first failure.
//
// Run with: pnpm smoke  (build first: pnpm build)

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(repoRoot, "dist", "index.js");

function fail(message) {
  console.error(`\n[smoke] FAIL: ${message}`);
  process.exit(1);
}

if (!existsSync(cli)) {
  fail(`built CLI not found at ${cli}. Run \`pnpm build\` first.`);
}

// Run the built CLI inside the temp project. Returns { code, stdout }.
function run(cwd, args, { expectExit = 0 } = {}) {
  let stdout = "";
  let code = 0;
  try {
    stdout = execFileSync(process.execPath, [cli, ...args], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    code = typeof err.status === "number" ? err.status : 1;
    stdout = `${err.stdout ?? ""}${err.stderr ?? ""}`;
  }
  if (code !== expectExit) {
    console.error(stdout);
    fail(`\`agentscope ${args.join(" ")}\` exited ${code}, expected ${expectExit}`);
  }
  return { code, stdout };
}

function check(condition, message) {
  if (!condition) fail(message);
}

const workdir = mkdtempSync(path.join(tmpdir(), "agentscope-smoke-"));
let passed = 0;

try {
  // A package.json keeps `ci doctor` happy and mirrors a real project.
  writeFileSync(
    path.join(workdir, "package.json"),
    '{\n  "name": "agentscope-smoke-fixture",\n  "version": "0.0.0"\n}\n',
    "utf8",
  );

  // 1. init
  run(workdir, ["init"]);
  check(
    existsSync(path.join(workdir, ".agentscope", "config.yaml")),
    "init did not create .agentscope/config.yaml",
  );
  passed += 1;

  // 2. start --dry-run (writes nothing, exits 0)
  const start = run(workdir, ["start", "Fix login redirect bug", "--dry-run"]);
  check(
    start.stdout.includes("Dry run"),
    "start --dry-run did not report a dry run",
  );
  check(
    !existsSync(path.join(workdir, ".agentscope", "current-scope.yaml")),
    "start --dry-run must not write current-scope.yaml",
  );
  passed += 1;

  // 3. config validate
  const cfg = run(workdir, ["config", "validate"]);
  check(cfg.stdout.toLowerCase().includes("valid"), "config validate did not confirm validity");
  passed += 1;

  // 4. ci doctor (diagnostic only, never exits 1)
  run(workdir, ["ci", "doctor"]);
  passed += 1;

  // 5. gate --allow-missing-evidence (no evidence -> skipped, exit 0)
  run(workdir, ["gate", "--allow-missing-evidence"]);
  passed += 1;

  // 6. ci-summary --output (no evidence -> no-op message, exit 0)
  run(workdir, ["ci-summary", "--output", ".agentscope/ci/summary.md"]);
  passed += 1;

  console.log(`\n[smoke] OK — ${passed} steps passed in ${workdir}`);
} finally {
  rmSync(workdir, { recursive: true, force: true });
}

process.exit(0);
