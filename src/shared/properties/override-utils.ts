// src/shared/properties/override-utils.ts
import type { PerObjectAssignments } from "@/shared/properties/assignments";

// All objects now use their canonical node identifier id. No normalization required.
export function resolveBindingLookupId(
  bindingsByObject: Record<string, unknown>,
  objectId: string,
): string {
  return objectId;
}

/**
 * Get the list of per-object binding keys for a given object id,
 * applying id normalization fallback.
 */
export function getObjectBindingKeys(
  bindingsByObject: Record<string, Record<string, unknown>>,
  objectId: string,
): string[] {
  return Object.keys(bindingsByObject[objectId] ?? {});
}

/**
 * Pick the per-object assignments for an object id, supporting normalized id fallback.
 */
export function pickAssignmentsForObject<
  T extends PerObjectAssignments | undefined,
>(
  assignments: T,
  objectId: string,
): T extends undefined ? undefined : NonNullable<T>[string] | undefined {
  if (!assignments) return undefined as never;
  // @ts-expect-error - generic indexed access through runtime keys
  return assignments[objectId];
}

/**
 * Merge upstream and node-level per-object assignments with node-level precedence.
 */
export function mergePerObjectAssignments(
  upstream: PerObjectAssignments | undefined,
  node: PerObjectAssignments | undefined,
  mergeFn: (
    base: NonNullable<PerObjectAssignments>[string] | undefined,
    overrides: NonNullable<PerObjectAssignments>[string] | undefined,
  ) => NonNullable<PerObjectAssignments>[string] | undefined,
): PerObjectAssignments | undefined {
  if (!upstream && !node) return undefined;
  const result: PerObjectAssignments = {};
  const objectIds = new Set<string>([
    ...Object.keys(upstream ?? {}),
    ...Object.keys(node ?? {}),
  ]);
  for (const id of objectIds) {
    const merged = mergeFn(upstream?.[id], node?.[id]);
    if (merged) result[id] = merged;
  }
  return result;
}
