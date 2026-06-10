import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  EvidencePackageV1Schema,
  type EvidencePackageV1,
} from "./evidence-package.js";

/**
 * Evidence store (V1.3).
 *
 * Reads and writes the local audit artifact at `.agentscope/evidence/latest.json`.
 *
 * Writes are atomic (temp file + rename) so a crash mid-write never leaves a
 * half-written `latest.json` behind. Reads of a missing or invalid file return
 * `undefined` rather than throwing, so a corrupted artifact can be cleanly
 * overwritten by the next session instead of wedging the recorder.
 */

/** Reads and validates latest.json. Returns undefined if absent or invalid. */
export function readEvidencePackage(
  latestFile: string,
): EvidencePackageV1 | undefined {
  if (!existsSync(latestFile)) return undefined;

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(latestFile, "utf8"));
  } catch {
    return undefined;
  }

  const result = EvidencePackageV1Schema.safeParse(raw);
  return result.success ? result.data : undefined;
}

/** Serializes an EvidencePackage with stable indentation and trailing newline. */
function serialize(pkg: EvidencePackageV1): string {
  return `${JSON.stringify(pkg, null, 2)}\n`;
}

/**
 * Atomically writes an EvidencePackage to latest.json.
 *
 * Ensures the evidence directory exists, writes to a temp file in the same
 * directory, then renames over the target so the swap is atomic on the same
 * filesystem.
 */
export function writeEvidencePackage(
  latestFile: string,
  pkg: EvidencePackageV1,
): void {
  const dir = path.dirname(latestFile);
  mkdirSync(dir, { recursive: true });

  const tmpFile = path.join(dir, `.latest.json.tmp-${process.pid}`);
  writeFileSync(tmpFile, serialize(pkg), "utf8");
  renameSync(tmpFile, latestFile);
}

export interface ClearResult {
  /** True if a latest.json existed and was removed. */
  removed: boolean;
  /** The path that was targeted. */
  latestFile: string;
}

/**
 * Removes latest.json if present. Missing file is a no-op (not an error), so
 * `agentscope evidence clear` is always safe to run.
 */
export function clearEvidence(latestFile: string): ClearResult {
  if (!existsSync(latestFile)) {
    return { removed: false, latestFile };
  }
  rmSync(latestFile, { force: true });
  return { removed: true, latestFile };
}
