import { copyFileSync, existsSync } from "node:fs";

/** The suffix appended to a settings file to form its AgentScope backup. */
export const BACKUP_SUFFIX = ".agentscope-backup";

/** Returns the backup path for a given settings file path. */
export function backupPathFor(settingsPath: string): string {
  return `${settingsPath}${BACKUP_SUFFIX}`;
}

export interface BackupResult {
  /** True if a backup file was created by this call. */
  created: boolean;
  /** The backup path (whether or not it was created this time). */
  backupPath: string;
  /** True if a backup already existed and was left untouched. */
  alreadyExisted: boolean;
}

/**
 * Creates a one-time backup of a settings file before it is modified.
 *
 * Rules (per V1.2 spec):
 * - If the settings file does not exist, no backup is made.
 * - If a backup already exists, it is NOT overwritten (preserves the original
 *   pre-AgentScope state across repeated installs).
 * - Otherwise the settings file is copied to `<path>.agentscope-backup`.
 */
export function backupSettingsFile(settingsPath: string): BackupResult {
  const backupPath = backupPathFor(settingsPath);

  if (!existsSync(settingsPath)) {
    return { created: false, backupPath, alreadyExisted: false };
  }

  if (existsSync(backupPath)) {
    return { created: false, backupPath, alreadyExisted: true };
  }

  copyFileSync(settingsPath, backupPath);
  return { created: true, backupPath, alreadyExisted: false };
}
