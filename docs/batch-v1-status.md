# Batch v1 Status Report (2025-08-30)

Current state: Batch v1 backend is complete and production-oriented. Objects are tagged per object with batch keys; scenes partition deterministically by key; overrides are applied at scene-build via a pure resolver with precedence bound > per-key > per-object default > node default; metadata passes through Filter/Merge/Duplicate/Insert; Merge enforces port 1 priority. The Batch overrides UI is removed/gated via a feature flag (default off). Documentation exists in README; a separate developer API for programmatic overrides is not yet implemented.

## 1) Documentation status
- Updated docs: README has “Batch Rendering (v1)” and “Batch Overrides v1”.
  - Path: `README.md` (Batch Rendering (v1)) lines 136–143
```136:143:README.md
## Batch Rendering (v1)
- Use the `Batch` node (Logic) to tag objects with a `key` (bindable).
- Scene renders one video per unique key; non-batched objects appear in all outputs.
- Deterministic order (keys sorted); runtime IDs are namespaced as `baseId@key`.
- Filenames are `{key}.mp4` with sanitization; if two keys sanitize to the same filename, render is blocked with a clear error listing the colliding keys; no templating in v1.
- Overrides precedence unchanged for bound fields. Manual per-key overrides UI planned.
```
  - Path: `README.md` (Batch Overrides v1) lines 144–155
```144:155:README.md
## Batch Overrides v1
- Scope:
  - Typography.content
  - Canvas.position.x/y, Canvas.scale.x/y, Canvas.rotation, Canvas.opacity, Canvas.fillColor, Canvas.strokeColor, Canvas.strokeWidth
  - Media.imageAssetId
- Precedence: bound > per-key > per-object default > node default
- Dataflow: node-level `batchOverridesByField` → executors emit `perObjectBatchOverrides` + `perObjectBoundFields` → logic/timing pass-through → Merge port 1 priority → Scene applies at build-time per sub-partition key.
- Determinism: sorted keys; non-batched in all outputs; ID namespacing with `@key`; filename sanitization unchanged.
- Guardrails: UI rejects empty/duplicate keys; invalid values fallback with warnings; soft cap warning when >200 keys per object+field.
- Editor: per-field foldout appears when a Batch is upstream; disabled when bound; supports Default (all keys) and Key|Value overrides; sparse persistence.
```
- Separate developer docs for an overrides API: MISSING (suggest `docs/batch-developer-api.md`).

## 2) Current capabilities (with evidence)

### 2.1 Batch key resolution per object — PASS
- Precedence and empty-key validation
```1561:1667:src/server/animation-processing/executors/logic-executor.ts
// Resolve key per object with precedence: per-object binding -> global binding -> literal
const perObjectVal = readVarForObject(objectId)("key");
const globalVal = readVarGlobal("key");
const literalVal = data.key;
let resolved: unknown = perObjectVal ?? globalVal ?? (typeof literalVal === "string" ? literalVal : undefined);
// Guard: Avoid base-to-string on objects; coerce only strings/numbers/booleans
...
const resolvedKeyForObject = resolvedForObject.trim();
if (resolvedKeyForObject.length === 0) {
  emptyKeyObjectIds.push(objectId);
}
...
throw new DomainError(
  `Batch node '${node.data.identifier.displayName}' received objects with empty keys: [${objectIdsText}]`,
  "ERR_BATCH_EMPTY_KEY",
  { nodeId: node.data.identifier.id, nodeName: node.data.identifier.displayName, objectIds: emptyKeyObjectIds },
);
```
- Re-tag warning (last-write-wins)
```1628:1681:src/server/animation-processing/executors/logic-executor.ts
if (objWithBatch.batch === true && objWithBatch.batchKey !== undefined) {
  if (objWithBatch.batchKey !== resolvedKeyForObject) {
    retaggedObjects.push({ id: objectId, oldKey: objWithBatch.batchKey, newKey: resolvedKeyForObject });
  }
}
...
logger.warn(
  `Batch node '${node.data.identifier.displayName}': Object ${retag.id} was already batched with key '${retag.oldKey}', re-tagged with '${retag.newKey}' (last-write-wins)`,
  { nodeId: node.data.identifier.id, objectId: retag.id, oldKey: retag.oldKey, newKey: retag.newKey },
);
```
- One sentence: Batch key is evaluated per object with binding precedence; empties are aggregated; re-tagging is warned.

### 2.2 Scene partitioning per unique key — PASS
- Non-batched inclusion, key sort, scene-level validation
```217:281:src/server/animation-processing/scene/scene-partitioner.ts
const nonBatched = base.objects.filter((o) => !o.batch);
const batched = base.objects.filter((o) => o.batch && typeof o.batchKey === "string");
...
const keys = Array.from(new Set(batched.map((o) => String(o.batchKey)))).filter((k) => k.trim().length > 0);
...
if (keys.length === 0) {
  throw new DomainError(
    `Scene '${sceneName}' contains batched objects but no batch keys were found. Ensure batch nodes are properly configured.`,
    "ERR_SCENE_BATCH_EMPTY_KEYS",
    { nodeId: sceneId ?? "", nodeName: sceneName },
  );
}
...
keys.sort((a, b) => a.localeCompare(b));
const result = keys.map((key) => ({
  sceneNode: base.sceneNode,
  animations: base.animations,
  batchKey: key,
  objects: [
    ...nonBatched,
    ...batched.filter((o) => String(o.batchKey) === key),
  ],
  batchOverrides: base.batchOverrides,
  boundFieldsByObject: base.boundFieldsByObject,
}));
```
- ID namespacing and filename sanitization (exact code):
  - Namespacing objects and animations during scene build
```39:59:src/server/api/routers/animation.ts
// Helper: namespace object and animation IDs deterministically for batch key
function namespaceObjectsForBatch(
  objects: SceneObject[],
  batchKey: string | null,
): SceneObject[] {
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
```774:780:src/server/api/routers/animation.ts
const scene: AnimationScene = buildAnimationSceneFromPartition({
  sceneNode: sub.sceneNode,
  objects: namespaceObjectsForBatch(sub.objects, sub.batchKey),
  animations: namespaceAnimationsForBatch(
    sub.animations,
    sub.batchKey,
  ),
  ...
});
```
  - Filename builder and sanitizer
```1:16:src/shared/utils/naming.ts
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
    .slice(0, 200);
}
```
```24:31:src/shared/utils/naming.ts
export function buildContentBasename(
  displayName: string,
  batchKey?: string | null,
): string {
  const safeDisplay = sanitizeForFilename(displayName || "scene");
  const safeBatch = batchKey ? sanitizeForFilename(batchKey) : "";
  return safeBatch ? `${safeDisplay}-${safeBatch}` : safeDisplay;
}
```
  - Usage in scene generation to produce output basenames
```795:801:src/server/api/routers/animation.ts
// Use standardized naming: <displayName>-<batchKey?>
outputBasename: buildContentBasename(
  displayName,
  sub.batchKey ?? undefined,
),
```
  - Collision policy: README states collisions are blocked (no suffixing). No explicit collision utility is present here; detection is handled at job enqueue/render layer (outside this file).

### 2.3 Metadata pass-through — PASS
- Filter preserves overrides and bound-fields
```328:429:src/server/animation-processing/executors/logic-executor.ts
setNodeOutput(
  context,
  node.data.identifier.id,
  "output",
  "object_stream",
  filteredResults,
  {
    perObjectTimeCursor: propagatedCursors,
    perObjectAnimations: propagatedAnimations,
    perObjectAssignments: propagatedAssignments,
    perObjectBatchOverrides:
      Object.keys(propagatedBatchOverrides).length > 0
        ? propagatedBatchOverrides
        : undefined,
    perObjectBoundFields:
      Object.keys(propagatedBoundFields).length > 0
        ? propagatedBoundFields
        : undefined,
  },
);
```
- Merge port 1 priority
```592:629:src/server/animation-processing/executors/logic-executor.ts
// Merge perObjectBatchOverrides with port priority (Port 1 wins)
const out: Record<string, Record<string, Record<string, unknown>>> = {};
for (let portIndex = portInputs.length - 1; portIndex >= 0; portIndex--) {
  const inputs = portInputs[portIndex];
  if (!inputs) continue;
  for (const input of inputs) {
    const fromMeta = (
      input.metadata as {
        perObjectBatchOverrides?: Record<string, Record<string, Record<string, unknown>>>;
      } | undefined
    )?.perObjectBatchOverrides;
    if (!fromMeta) continue;
    for (const [objectId, fields] of Object.entries(fromMeta)) {
      const destFields = out[objectId] ?? {};
      for (const [fieldPath, byKey] of Object.entries(fields)) {
        const existing = destFields[fieldPath] ?? {};
        destFields[fieldPath] = { ...existing, ...byKey };
      }
      out[objectId] = destFields;
    }
  }
}
return Object.keys(out).length > 0 ? out : undefined;
```
- One sentence: All relevant metadata flows through Filter/Merge; Merge enforces deterministic priority.

### 2.4 Resolver precedence for field values — PASS
- Precedence and bound-fields mask
```21:41:src/server/animation-processing/scene/batch-overrides-resolver.ts
/**
 * Resolve a single field value for an object using precedence:
 * bound > per-key override > per-object default > currentValue
 * Does NOT mutate the object.
 */
export function resolveFieldValue<T = unknown>(
  objectId: string,
  fieldPath: string,
  currentValue: T,
  ctx: BatchResolveContext,
  validateAndCoerce: (value: unknown) => { ok: boolean; value?: T; warn?: string },
): T {
  const boundSet = new Set((ctx.perObjectBoundFields?.[objectId] ?? []).map(String));
  if (boundSet.has(fieldPath)) {
    return currentValue;
  }
  const forObject = ctx.perObjectBatchOverrides?.[objectId];
  const byField = forObject?.[fieldPath];
```
- Per-key then default fallback
```68:82:src/server/animation-processing/scene/batch-overrides-resolver.ts
// 1) per-key override (only if batchKey present)
if (ctx.batchKey && byField && Object.prototype.hasOwnProperty.call(byField, ctx.batchKey)) {
  const v = tryValue(byField[ctx.batchKey], "perKey");
  if (v !== undefined) return v;
}
// 2) per-object default
if (byField && Object.prototype.hasOwnProperty.call(byField, "default")) {
  const v = tryValue(byField.default, "perObjectDefault");
  if (v !== undefined) return v;
}
// 3) currentValue (node default or previously resolved)
return currentValue;
```
- Typed validation/coercion and warnings
```53:66:src/server/animation-processing/scene/batch-overrides-resolver.ts
const res = validateAndCoerce(raw);
if (res.ok) return res.value as T;
if (raw !== undefined) {
  logger.warn("Invalid override value, falling back", {
    objectId,
    fieldPath,
    tier,
    rawType: typeof raw,
    warn: res.warn ?? "invalid",
  });
}
```
- Pure application at scene-build
```336:348:src/server/animation-processing/scene/scene-partitioner.ts
const batchKey = (partition as unknown as { batchKey?: string | null }).batchKey ?? null;
const perObjectBatchOverrides = partition.batchOverrides;
const perObjectBoundFields = partition.boundFieldsByObject;

const overriddenObjects: SceneObject[] = partition.objects.map((obj) =>
  applyOverridesToObject(obj, {
    batchKey,
    perObjectBatchOverrides,
    perObjectBoundFields,
  }),
);
```

### 2.5 Editor UI state — PASS
- Feature flag (default off)
```3:7:src/shared/feature-flags.ts
export const features = {
  // Batch overrides editor UI foldouts (Canvas/Typography/Media)
  // Disabled by default; backend functionality remains enabled.
  batchOverridesUI: false,
} as const;
```
- Editors no longer render foldouts (references removed) — corroborated by absence of `BatchOverridesFoldout` in editor files.

### 2.6 Developer API for overrides — UNKNOWN
- No `setOverride/clearOverride/getOverride` module found.
- Suggested file: `src/server/animation-processing/overrides/api.ts` exporting those functions to write `node.data.batchOverridesByField` for the active node and rely on existing executor emission.

## 3) Tests summary
- Resolver tests — MISSING TEST
  - Proposed: `resolver precedence applies bound > per-key > per-object > default`.
  - Proposed: `non-batched ignores per-key, falls back to default`.
  - Proposed: `invalid type fallback logs warning and uses lower tier value`.
- Metadata pass-through and merge — MISSING TEST
  - Proposed: `Filter preserves perObjectBatchOverrides and perObjectBoundFields for selected IDs`.
  - Proposed: `Merge enforces port 1 priority; downstream-most wins across nodes`.
- Scene integration — MISSING TEST
  - Proposed: `Multiple keys → N partitions (lexicographic), non-batched appear in all, overrides applied per key`.

## 4) Open gaps or deviations
- Developer API not implemented
  - Impact: No public programmatic surface; users must rely on bindings or internal structures.
  - Minimal fix: Add `src/server/animation-processing/overrides/api.ts` with `setOverride/clearOverride/getOverride` writing to `batchOverridesByField`.
- README mentions overrides UI (planned) while UI is gated off and removed
  - Impact: Minor doc drift.
  - Minimal fix: Update README to clarify UI is disabled by default; recommend bindings or the developer API once added.
- ID namespacing and filename sanitization exact code path not cited
  - Impact: Harder to audit determinism and collision behavior.
  - Minimal fix: Document utility paths and add a small test around filename sanitization collisions.

## 5) Quick index
- Logic executor: `src/server/animation-processing/executors/logic-executor.ts` — Batch tagging per object; Filter/Merge/Duplicate pass-through; Merge port priority.
- Canvas executor: `src/server/animation-processing/executors/canvas-executor.ts` — Emits `perObjectBatchOverrides` and `perObjectBoundFields`; merges assignments.
- Media/Typography executor: `src/server/animation-processing/executors/animation-executor.ts` — Emits metadata for Media/Typography; bindings and assignments handling.
- Scene partitioner: `src/server/animation-processing/scene/scene-partitioner.ts` — Partitions by key; applies overrides at build; stable layer ordering.
- Resolver: `src/server/animation-processing/scene/batch-overrides-resolver.ts` — Pure precedence resolver with type coercion and warnings.
- Feature flags: `src/shared/feature-flags.ts` — `batchOverridesUI` flag (default false).
- Docs: `README.md` — Batch v1 and Overrides v1 sections (needs developer API doc).
