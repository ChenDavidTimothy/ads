// src/shared/utils/naming.ts

/**
 * Sanitize a string for safe filename usage across platforms.
 * - Replaces illegal characters with '-'
 * - Collapses whitespace to '-'
 * - Collapses repeated '-' and trims from ends
 */
export function sanitizeForFilename(input: string): string {
  return input
    .replace(/[\\\/\0\n\r\t\f\v:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200); // guardrail to avoid extremely long names
}

/**
 * Build a content basename based on node display name and optional batch key.
 * Examples:
 *  - ("Scene A", undefined) => "Scene-A"
 *  - ("Scene A", "key1") => "Scene-A-key1"
 */
export function buildContentBasename(
  displayName: string,
  batchKey?: string | null,
): string {
  const safeDisplay = sanitizeForFilename(displayName || "scene");
  const safeBatch = batchKey ? sanitizeForFilename(batchKey) : "";
  return safeBatch ? `${safeDisplay}-${safeBatch}` : safeDisplay;
}

/**
 * Build a full filename with extension (include leading dot in extension).
 */
export function buildFilename(
  displayName: string,
  extensionWithDot: string,
  batchKey?: string | null,
): string {
  const base = buildContentBasename(displayName, batchKey);
  // Ensure extension begins with a dot
  const ext = extensionWithDot.startsWith(".")
    ? extensionWithDot
    : `.${extensionWithDot}`;
  return `${base}${ext}`;
}
