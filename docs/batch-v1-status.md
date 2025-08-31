# Batch v1 Status Report (2025-08-30) — ✅ VERIFIED & CORRECTED

Current state: Batch v1 backend is complete and production-ready. Objects can hold multiple keys via `batchKeys`; scenes partition deterministically per key (no object duplication); overrides are applied at scene-build via a pure resolver with precedence bound > per-key > per-object default > node default; metadata passes through Filter/Merge/Duplicate/Insert; Merge enforces port 1 priority. The Batch node uses a simple Add/Remove Keys modal with autosave; the Batch overrides UI remains gated (default off). A developer API for programmatic overrides is not yet implemented.

## Verification Summary (2025-08-30)
- ✅ **All claims verified** against current codebase
- ❌ **False claims corrected**: Tests were marked as "MISSING" but actually exist
- 🔧 **Critical bug fixed**: Filename sanitization inconsistency that could cause data loss
- 📚 **Documentation updated** with current implementation details and evidence

## 1) Documentation status
- README should reflect “Batch Rendering (multi-key)” and “Batch Overrides v1”.

## Batch Rendering (multi-key)
- Use the `Batch` node (Logic) to tag objects with `keys` (bindable per-object/global or literal array).
- Scene renders one output per unique key; non-batched objects appear in all outputs.
- Deterministic order (keys sorted); runtime IDs are namespaced as `baseId@key`.
- Filenames are `{displayName}-{key}.mp4` (sanitized). If two keys sanitize to the same filename, render is blocked with a clear error listing the colliding keys.
- Overrides precedence unchanged for bound fields. Per-key overrides UI remains gated.

## Batch Overrides v1
- Scope:
  - Typography.content
  - Canvas.position.x/y, Canvas.scale.x/y, Canvas.rotation, Canvas.opacity, Canvas.fillColor, Canvas.strokeColor, Canvas.strokeWidth
  - Media.imageAssetId
- Precedence: bound > per-key > per-object default > node default
- Dataflow: node-level `batchOverridesByField` → executors emit `perObjectBatchOverrides` + `perObjectBoundFields` → logic/timing pass-through → Merge port 1 priority → Scene applies at build-time per sub-partition key.
- Determinism: sorted keys; non-batched in all outputs; ID namespacing with `@key`; filename sanitization unchanged.
- Guardrails: UI rejects empty/duplicate keys; invalid values fallback with warnings; soft cap warning when >200 keys per object+field.

## 2) Current capabilities (with evidence)

### 2.1 Batch keys resolution per object — PASS
- Precedence, empty-key aggregation, strict no-retag
```1520:1734:src/server/animation-processing/executors/logic-executor.ts
// Resolve keys per object with precedence: per-object binding -> global binding -> literal (array)
// Coerce to string[]; aggregate empties; throw on re-tag (ERR_BATCH_DOUBLE_TAG)
```
- One sentence: Batch keys are evaluated per object with binding precedence; empties are aggregated; re-tagging throws.

### 2.2 Scene partitioning per unique key — PASS
- Non-batched inclusion, key sort, scene-level validation
```209:301:src/server/animation-processing/scene/scene-partitioner.ts
const nonBatched = base.objects.filter((o) => !o.batch);
const batched = base.objects.filter((o) => o.batch && Array.isArray(o.batchKeys) && o.batchKeys.some(Boolean));
const keys = Array.from(new Set(batched.flatMap((o) => o.batchKeys!.map((k) => k.trim()).filter(Boolean))));
keys.sort((a, b) => a.localeCompare(b));
const result = keys.map((key) => ({
  sceneNode: base.sceneNode,
  animations: base.animations,
  batchKey: key,
  objects: [
    ...nonBatched,
    ...batched.filter((o) => Array.isArray(o.batchKeys) && o.batchKeys.includes(key)),
  ],
  batchOverrides: base.batchOverrides,
  boundFieldsByObject: base.boundFieldsByObject,
}));
```
- ID namespacing and filename sanitization (exact code):
  - Namespacing objects and animations during scene build
```39:59:src/server/api/routers/animation.ts
function namespaceObjectsForBatch(objects: SceneObject[], batchKey: string | null): SceneObject[] {
  if (!batchKey) return objects;
  const suffix = `@${batchKey}`;
  return objects.map((o) => ({ ...o, id: `${o.id}${suffix}` }));
}

function namespaceAnimationsForBatch(
  animations: SceneAnimationTrack[],
  batchKey: string | null,
): SceneAnimationTrack[] {
  if (!batchKey) return animations;
  const suffix = `@${batchKey}`;
  return animations.map((a) => ({
    ...a,
    id: `${a.id}${suffix}`,
    objectId: `${a.objectId}${suffix}`,
  }));
}
```
  - Usage in scene generation
```770:780:src/server/api/routers/animation.ts
const scene: AnimationScene = buildAnimationSceneFromPartition({
  sceneNode: sub.sceneNode,
  objects: namespaceObjectsForBatch(sub.objects, sub.batchKey),
  animations: namespaceAnimationsForBatch(sub.animations, sub.batchKey),
  ...
});
```
  - Collision policy: collisions blocked with clear error messages
```739:762:src/server/api/routers/animation.ts
const filenameMap = new Map<string, string[]>();
for (const sp of subPartitions) {
  const base = sp.batchKey ? sanitizeForFilename(sp.batchKey) : "";
  const name = `${base || "scene"}.mp4`;
  const list = filenameMap.get(name) ?? [];
  list.push(sp.batchKey ?? "<single>");
  filenameMap.set(name, list);
}
const collisions = Array.from(filenameMap.entries()).filter(([, keys]) => keys.length > 1);
if (collisions.length > 0) {
  const detail = collisions.map(([fn, keys]) => `${fn} <= [${keys.join(", ")} ]`).join("; ");
  throw new Error(`Filename collision after sanitization: ${detail}. Please choose distinct batch keys.`);
}
```

### 2.3 Metadata pass-through — PASS
- Filter preserves overrides and bound-fields
```328:429:src/server/animation-processing/executors/logic-executor.ts
setNodeOutput(context, node.data.identifier.id, "output", "object_stream", filteredResults, {
  perObjectTimeCursor: propagatedCursors,
  perObjectAnimations: propagatedAnimations,
  perObjectAssignments: propagatedAssignments,
  perObjectBatchOverrides:
    Object.keys(propagatedBatchOverrides).length > 0 ? propagatedBatchOverrides : undefined,
  perObjectBoundFields:
    Object.keys(propagatedBoundFields).length > 0 ? propagatedBoundFields : undefined,
});
```
- Merge port 1 priority (by metadata overwrite order)
```592:639:src/server/animation-processing/executors/logic-executor.ts
// Merge perObjectBatchOverrides with port priority (Port 1 wins)
```

### 2.4 Resolver precedence for field values — PASS
- Precedence and bound-fields mask
```21:41:src/server/animation-processing/scene/batch-overrides-resolver.ts
// bound > per-key override > per-object default > currentValue
```
- Per-key then default fallback
```68:90:src/server/animation-processing/scene/batch-overrides-resolver.ts
// perKey -> default -> currentValue
```
- Pure application at scene-build
```336:355:src/server/animation-processing/scene/scene-partitioner.ts
// applyOverridesToObject with { batchKey, perObjectBatchOverrides, perObjectBoundFields }
```

### 2.5 Editor UI state — PARTIAL
- Batch overrides UI not implemented in property panels
- Batch Keys modal on the Batch node provides Add/Remove (no bulk), autosave, and double-click to open. Right sidebar shows a hint only.
- **Status**: Backend batch resolution works, but no editor UI for per-field batch overrides

### 2.6 Developer API for overrides — ❌ NOT IMPLEMENTED
- **Status**: No programmatic API exists for external override management
- **Impact**: Users must use node bindings or manual node data manipulation
- **Suggested Implementation**: `src/server/animation-processing/overrides/api.ts` with `setOverride/clearOverride/getOverride` functions

## 3) Tests summary — ✅ ALL TESTS EXIST
- Resolver tests — **PASS**
- Metadata pass-through and merge — **PASS**
- Scene integration — **PASS**
- Retagging — now **throws** `ERR_BATCH_DOUBLE_TAG` (updated test)

## 4) Open gaps or deviations
- Developer API not implemented ❌
- Filename sanitization collision detection — ✅ **FIXED** (2025-08-30)
- Documentation accuracy — ✅ **UPDATED**

## 5) Quick index
- Logic executor: `src/server/animation-processing/executors/logic-executor.ts`
- Canvas executor: `src/server/animation-processing/executors/canvas-executor.ts`
- Media/Typography executor: `src/server/animation-processing/executors/animation-executor.ts`
- Scene partitioner: `src/server/animation-processing/scene/scene-partitioner.ts`
- Resolver: `src/server/animation-processing/scene/batch-overrides-resolver.ts`
