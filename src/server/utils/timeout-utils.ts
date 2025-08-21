// src/server/utils/timeout-utils.ts
/**
 * Minimal timeout utility following existing codebase patterns
 * Used for wrapping canvas loadImage() calls with production timeouts
 */

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage?: string,
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(
        new Error(errorMessage ?? `Operation timed out after ${timeoutMs}ms`),
      );
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}
