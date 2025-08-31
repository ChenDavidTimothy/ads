## Batch Overrides UI v2 — Production-Ready Implementation Plan

### Executive summary

- Goal: Ship a robust, long-lived UI for per-object and per-key overrides that strictly follows existing patterns, centralized styling, and data flow. No hacks, no bespoke one-offs.
- Scope: Editors for Canvas, Typography, and Media. Backend is already complete (partitioning, precedence, resolver, metadata pass-through).
- Principles:
  - Reuse existing UI primitives (`FormField`, `BindButton`, badges, `Modal`, inputs) and workspace update flows (`updateFlow`).
  - Centralize mapping and helper logic; avoid field-path string drift.
  - Gate with a feature flag (`features.batchOverridesUI`), default off.
  - Phase 1 derives available keys as the union of upstream Batch node keys (deterministic, performant, UX-clear). Per-object accurate reachability can be added later if truly needed.

### Data model and precedence (aligned with backend)

- Node-side storage: `node.data.batchOverridesByField?: Record<fieldPath, Record<objectId, Record<batchKey | "default", unknown>>>` for Canvas, Typography, and Media nodes.
- Executors emit `perObjectBatchOverrides` from this structure; merge/metadata pass-through already implemented.
- Resolver precedence: bound > per-key override > per-object default > currentValue.
- Supported resolver field paths today:
  - Canvas: `Canvas.position.x/y`, `Canvas.scale.x/y`, `Canvas.rotation`, `Canvas.opacity`, `Canvas.fillColor`, `Canvas.strokeColor`, `Canvas.strokeWidth`
  - Typography: `Typography.content`
  - Media: `Media.imageAssetId`

### UX architecture (consistent with existing editors)

1. Controls placement

- Do not alter shared field components API. Instead, provide a composite adornment component that renders both the existing `BindButton` and the new `BatchButton` into the same single `bindAdornment` slot.
- For fields whose labels are rendered separately (as in current editors), keep label placement unchanged; adornments remain inside the input (top-right), matching existing pattern.

2. Batch button behavior

- Visible only if `features.batchOverridesUI` is enabled and there is at least one upstream Batch node with non-empty keys.
- Click opens a modal scoped to a specific `nodeId`, `fieldPath` and optional `objectId` (for per-object). The modal edits the `node.data.batchOverridesByField` at that locus.

3. Modal behavior

- Left column: list of keys to edit ("Default (all keys)" + upstream keys). Union-of-upstream-keys in Phase 1. Orphaned overrides (not present upstream) are flagged with a warning and removable.
- Right column: value editor for the selected row, using simple type-driven editors (number or string initially; color/boolean cases are mapped to string or number for v2 and refined later if needed).
- Autosave on change via `updateFlow` (consistent with Batch node keys modal). Provide per-row Clear and a "Clear all" action.
- Respect bindings: when a fieldPath is currently bound for the target object, show a notice that overrides won’t apply (resolver masks bound fields). Disable editors accordingly.

### Key helpers and new modules

1. Feature flag (existing location)

- `src/shared/feature-flags.ts`: add `batchOverridesUI: boolean` gating render of new UI elements.

2. Field-path mapping (new)

- `src/shared/properties/field-paths.ts`
- Purpose: Avoid duplicating string literals like `"Canvas.position.x"`. Provide helpers:
  - `getResolverFieldPath(editor: "canvas" | "typography" | "media", key: string): string | undefined`
  - Predefined maps for supported keys to resolver paths.

3. Batch keys discovery (new hook)

- `src/hooks/use-batch-keys.ts`
- Returns union-of-upstream Batch node keys for the current node (`nodeId`) and optionally filters by fieldPath if needed later.
- Implementation: BFS from the current ReactFlow node to sources over incoming edges; collect `data.keys` from nodes with `type === "batch"`.

4. Batch overrides CRUD (new hook)

- `src/hooks/use-batch-overrides.ts`
- Manages a single locus: (`nodeId`, `fieldPath`, optional `objectId`). Provides:
  - `data: { perObjectDefault?: unknown; perKeyOverrides: Record<string, unknown> }`
  - `setPerObjectDefault(value)`, `setPerKeyOverride(key, value)`, `clearOverride(key?)`, `hasOverrides`
- Implementation: Uses `useWorkspace().updateFlow()` to atomically update `node.data.batchOverridesByField` with normalization and deletion of empty maps.

5. Composite adornment (new)

- `src/components/workspace/batch/BindingAndBatchControls.tsx`
- Renders existing `BindButton` and the new `BatchButton` side-by-side within a small container, suitable for the `bindAdornment` slot.

6. Batch UI components (new)

- `src/components/workspace/batch/BatchButton.tsx`
  - Shows 🏷️, tooltip "Batch overrides", opens modal; hidden if no available keys or flag off.
- `src/components/workspace/batch/BatchModal.tsx`
  - Receives `nodeId`, `fieldPath`, `objectId`, `valueType`.
  - Lists Default + keys, live-edit values with autosave using `useBatchOverrides`.
  - Shows read-only state when field is bound for the object (mask per resolver behavior).

### Editor integration

1. Canvas per-object properties

- Replace existing `bindAdornment={<BindButton .../>}` with `bindAdornment={<BindingAndBatchControls bindProps={...} batchProps={...} />}` for supported fields.
- Use `getResolverFieldPath("canvas", keyName)` to configure `BatchButton` correctly.

2. Typography editor

- Apply the same pattern to supported fields, beginning with `content`.

3. Media editor

- Apply the same pattern to `imageAssetId`.

4. Read-only and badges

- Keep existing badges unchanged. Add a small "Batch-managed" hint only when `hasOverrides` is true for that field and object; this is optional because the modal is discoverable via the 🏷️.

### Error handling, validation, and performance

- Orphaned key cleanup: Provide per-row remove and a global "Remove orphaned overrides" in the modal if a key is no longer present upstream.
- Type validation: Basic coercion handled by resolver on the backend. In the UI, perform minimal validation (number parsing) and do not block saves; warn inline for clearly invalid inputs.
- Large key sets: Provide a simple text filter in v2; add virtualization if usage warrants (>200 keys) — the resolver will log soft-cap warnings.

### Backward compatibility

- Typing: add `batchOverridesByField` to `MediaNodeData` to align with executor usage.
- Feature flag default off to avoid regressions.
- Storage: No migrations required if absent fields are treated as empty.

### Testing strategy

- Unit tests
  - `use-batch-keys` — traversal from a mocked flow graph; union and dedupe.
  - `use-batch-overrides` — CRUD operations, cleanup when maps become empty.
  - `BatchModal` — list rendering, edits call `updateFlow` with correct shape.

- Integration tests
  - Canvas per-object properties: presence of 🏷️ when upstream keys exist; edits persist to `node.data.batchOverridesByField` and reflect on reload.
  - Bound masking: when field bound, editors disabled and overrides not applied.

### Deliverables checklist

- Feature flag: `features.batchOverridesUI`
- Typing: `MediaNodeData.batchOverridesByField`
- Helper: `shared/properties/field-paths.ts`
- Hooks: `use-batch-keys.ts`, `use-batch-overrides.ts`
- UI: `BindingAndBatchControls.tsx`, `BatchButton.tsx`, `BatchModal.tsx`
- Integration: Canvas (per-object), then Typography, then Media
- Docs: This plan and brief README note

Feature flag: The UI is gated by `features.batchOverridesUI` (default false). Enable for internal testing after integration is complete and tests pass.

### Rollout plan

1. Land foundations (flag, typing, helpers, hooks)
2. Integrate in Canvas per-object for all supported fields
3. Integrate Typography (content)
4. Integrate Media (imageAssetId)
5. Enable flag for internal testing; add E2E smoke for one flow
6. Document and keep flag off until QA sign-off
