/**
 * Convert a free-form task title into a stable kebab-case task id.
 *
 * Rules (see architecture.md §4.2):
 * - lowercase
 * - kebab-case
 * - strip special characters
 * - max 64 characters
 */
export function taskTitleToId(title: string): string {
  const id = title
    .toLowerCase()
    .normalize("NFKD")
    // replace any run of non-alphanumeric characters with a single hyphen
    .replace(/[^a-z0-9]+/g, "-")
    // trim leading/trailing hyphens
    .replace(/^-+|-+$/g, "");

  const truncated = id.slice(0, 64).replace(/-+$/g, "");

  return truncated.length > 0 ? truncated : "task";
}
