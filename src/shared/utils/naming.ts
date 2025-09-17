// src/shared/utils/naming.ts

/**
 * SINGLE SOURCE OF TRUTH for filename sanitization across the entire application.
 *
 * This module provides consistent filename sanitization to prevent:
 * - Filesystem security issues (null bytes, control characters)
 * - Cross-platform compatibility problems
 * - Filename collision detection failures
 * - Data loss from file overwrites
 *
 * IMPORTANT: All filename sanitization in the application MUST use these functions.
 * Do NOT create new sanitization logic elsewhere - always import and use these functions.
 *
 * Security considerations:
 * - Handles null bytes (\0) and control characters (\n\r\t\f\v) that could cause filesystem issues
 * - Prevents directory traversal attacks
 * - Ensures cross-platform compatibility (Windows, Linux, macOS)
 * - Prevents filename collisions that could lead to data loss
 */
export function sanitizeForFilename(input: string): string {
  return input
    .replace(/[\\\/\0\n\r\t\f\v:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200); // guardrail to avoid extremely long names
}

/**
 * Build a content basename based on node display name and optional batch key.
 * Examples:
 *  - ("Scene A", undefined) => "Scene-A"
 *  - ("Scene A", "key1") => "Scene-A-key1"
 */
export function buildContentBasename(displayName: string, batchKey?: string | null): string {
  const safeDisplay = sanitizeForFilename(displayName || 'scene');
  const safeBatch = batchKey ? sanitizeForFilename(batchKey) : '';
  return safeBatch ? `${safeDisplay}-${safeBatch}` : safeDisplay;
}

/**
 * Build a full filename with extension (include leading dot in extension).
 */
export function buildFilename(
  displayName: string,
  extensionWithDot: string,
  batchKey?: string | null
): string {
  const base = buildContentBasename(displayName, batchKey);
  // Ensure extension begins with a dot
  const ext = extensionWithDot.startsWith('.') ? extensionWithDot : `.${extensionWithDot}`;
  return `${base}${ext}`;
}
