# Release Checklist

A manual, repeatable checklist for cutting an AgentScope release. Everything here
is local and deterministic. **This checklist does not publish to npm and does not
create a git tag** — those final steps are listed for reference only and are run
deliberately by a maintainer.

Target version for the first release: **0.1.0**.

## 1. Clean git status

Make sure there is no unintended work in progress:

```bash
git status
```

The working tree should be clean (or contain only the changes you intend to
release). Local session artifacts under `.agentscope/` are git-ignored by
default and should not appear.

## 2. Install dependencies

```bash
pnpm install
```

## 3. Build

```bash
pnpm build
```

Produces `dist/index.js` (the published CLI entrypoint).

## 4. Typecheck

```bash
pnpm typecheck
```

## 5. Lint

```bash
pnpm lint
```

## 6. Test

```bash
pnpm test
```

The full Vitest suite must pass.

## 7. Smoke test

```bash
pnpm smoke
```

Runs `scripts/smoke-test.mjs`, which exercises the built CLI end-to-end in a
throwaway temp directory (init → start --dry-run → config validate → ci doctor →
gate --allow-missing-evidence → ci-summary). It is offline, requires no Claude
Code session, and never touches this repo. Exit `0` means pass.

## 8. CLI smoke test (manual spot check)

Confirm the help text reads cleanly and describes the real commands:

```bash
node dist/index.js --help
node dist/index.js gate --help
node dist/index.js ci --help
node dist/index.js ci-summary --help
```

There should be no stale "prototype" wording and no claims of unimplemented
features (SARIF, PR comments, Marketplace Action).

## 9. Package contents check

```bash
npm pack --dry-run
```

Confirm the tarball contains only `dist/`, `action.yml`, `README.md`, `LICENSE`,
and `package.json`. It must **not** contain tests, source, `.agentscope/`
evidence, or any secrets. Do **not** run `npm publish` here.

## 10. README / docs demo check

- Confirm the README hero demo matches current behavior (deny `.env.local`,
  ask on `package.json`, allow `src/auth/login.ts`, risk **55 / 100 (high)**,
  gate **FAIL**, CI summary at `.agentscope/ci/summary.md`).
- Confirm [`docs/quickstart.md`](quickstart.md) commands are copy-pasteable.
- Confirm [`examples/live-demo/`](../examples/live-demo/README.md) reference
  outputs (`expected-risk-report.txt`, `expected-gate-result.json`,
  `expected-ci-summary.md`) match the current rules.
- Confirm [`CHANGELOG.md`](../CHANGELOG.md) has an entry for this version.

## 11. Tag / release (manual, not automated here)

Only after everything above is green:

1. Update the version in `package.json` and the `CHANGELOG.md` heading
   (change `Unreleased` to the release date).
2. Commit the release.
3. Create the git tag, e.g. `git tag v0.1.0`.
4. Publish if/when desired: `npm publish`.

These steps are intentionally **not** scripted and **not** performed by this
checklist run.
