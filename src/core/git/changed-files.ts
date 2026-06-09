import { execFileSync } from "node:child_process";

/** Raised when git is unavailable or the directory is not a git repository. */
export class GitError extends Error {}

function runGit(args: string[], cwd: string): string {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { stderr?: string };
    if (e.code === "ENOENT") {
      throw new GitError("git executable not found on PATH.");
    }
    throw new GitError(
      (e.stderr?.toString().trim() || e.message || "git command failed").trim(),
    );
  }
}

/** Returns true if `cwd` is inside a git working tree. */
export function isGitRepo(cwd: string): boolean {
  try {
    const out = runGit(["rev-parse", "--is-inside-work-tree"], cwd);
    return out.trim() === "true";
  } catch {
    return false;
  }
}

/**
 * Returns the set of files changed relative to HEAD, as repo-relative POSIX
 * paths. Includes:
 *  - unstaged changes (working tree vs index)
 *  - staged changes (index vs HEAD)
 *  - untracked files (not yet added)
 *
 * Throws GitError if `cwd` is not a git repository.
 */
export function getChangedFiles(cwd: string = process.cwd()): string[] {
  if (!isGitRepo(cwd)) {
    throw new GitError(
      `Not a git repository: ${cwd}. AgentScope check requires git to detect changed files.`,
    );
  }

  const files = new Set<string>();

  // Tracked changes vs HEAD (staged + unstaged). On a repo with no commits yet,
  // diffing against HEAD fails, so fall back to the staged diff.
  let tracked: string;
  try {
    tracked = runGit(["diff", "--name-only", "HEAD"], cwd);
  } catch {
    tracked = runGit(["diff", "--name-only", "--cached"], cwd);
  }
  for (const line of tracked.split(/\r?\n/)) {
    const file = line.trim();
    if (file) files.add(file);
  }

  // Untracked, non-ignored files.
  const untracked = runGit(
    ["ls-files", "--others", "--exclude-standard"],
    cwd,
  );
  for (const line of untracked.split(/\r?\n/)) {
    const file = line.trim();
    if (file) files.add(file);
  }

  return [...files].sort();
}
