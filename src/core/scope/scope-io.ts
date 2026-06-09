import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  ScopeContractSchema,
  type ScopeContract,
} from "../schema/scope-contract.js";

/** Raised when a scope file is missing or invalid, with a user-facing message. */
export class ScopeError extends Error {}

/** Serializes a ScopeContract to YAML. */
export function scopeToYaml(scope: ScopeContract): string {
  return stringifyYaml(scope, { lineWidth: 0 });
}

/** Writes a ScopeContract to the given file path. */
export function writeScope(filePath: string, scope: ScopeContract): void {
  writeFileSync(filePath, scopeToYaml(scope), "utf8");
}

/**
 * Reads and validates a ScopeContract from disk.
 * Throws ScopeError when the file is missing or does not match the schema.
 */
export function readScope(filePath: string): ScopeContract {
  if (!existsSync(filePath)) {
    throw new ScopeError(
      `No scope file found at ${filePath}. Run: agentscope start "<task>"`,
    );
  }

  let raw: unknown;
  try {
    raw = parseYaml(readFileSync(filePath, "utf8"));
  } catch (err) {
    throw new ScopeError(
      `Failed to parse scope file ${filePath}: ${(err as Error).message}`,
    );
  }

  const result = ScopeContractSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new ScopeError(`Invalid scope contract at ${filePath}:\n${issues}`);
  }

  return result.data;
}
