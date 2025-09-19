# Refactor Target Roadmap (Autumn 2025)

This roadmap captures the legacy surfaces already modernised after the animation/logic executor split, plus the next high-impact bets. Every section pairs the current structure with validated results and clearly scoped follow-ups so we preserve behaviour while tightening architecture.

---

## Current Snapshot

### Asset Cache Manager (`src/server/rendering/asset-cache-manager.ts`)

- Entry point now composes the focused services in `asset-cache/download-service.ts`, `asset-cache/manifest-store.ts`, and `asset-cache/maintenance.ts`, keeping the coordinator under 300 lines.
- `AssetDownloadService` owns signed-URL refresh, retry/backoff, integrity checks, and job/shared cache linking, emitting metrics via injected state.
- `ManifestStore` guarantees manifest read/write behaviour; `CacheMaintenance` handles directory initialisation, janitor lifecycle, and the single-process hard-link probe.
- Regression coverage lives in `src/server/rendering/__tests__/asset-cache-manager.test.ts` (manifest layout + metrics snapshots); validated with `pnpm lint`, `pnpm typecheck`, and targeted Vitest runs.
- **Follow-ups**
  - Add download-service tests for expired URLs and hash mismatches when the injectable network client lands.
  - Surface cache copy/refresh metrics through the telemetry pipeline.

### Storage Pipeline (`src/server/storage`)

- `SmartStorageProvider` now delegates to `storage/upload-service.ts` and `storage/cleanup-runner.ts`.
- `cleanup-service.ts` consumes the shared runner so foreground calls and background janitors share one implementation.
- Behaviour verified through existing integration entry points plus `pnpm typecheck`.
- **Follow-ups**
  - Add retry/backoff unit tests for `StorageUploadService`.
  - Emit cleanup outcome metrics for dashboard visibility.

### Animation Router (`src/server/api/routers/animation.ts`)

- Router dispatches into `animation/procedures/*`; rendering orchestration is isolated in `rendering/jobs/asset-cache-service.ts`.
- Covered by queue/media integration tests.

### Asset Services (`src/server/api/routers/assets.ts`)

- Router trimmed to thin wiring against `src/server/api/services/assets/*`.
- Service layer covers quotas, uploads, catalogue/listing, and lifecycle flows with dedicated Vitest suites and injectable dependencies.
- `handleServiceError` standardises TRPC error translation.
- Validated using `pnpm test` and `pnpm check`.
- **Follow-ups**
  - Instrument service-level metrics (quota deltas, upload confirmations, lifecycle moves).
  - Add TRPC smoke tests around the router.
  - Re-use the service layer inside workers to avoid drift.

---

## High-Priority Server Work

### Rendering Job Orchestration Follow-Up

- **Pain**: Residual logic in `rendering/jobs/*` still mixes persistence with orchestration.
- **Target**: Extract state transitions and Supabase persistence into `rendering/jobs/job-service.ts`, keeping Graphile worker entry points slim.
- **Preparation**: Catalogue current job states and side effects before extraction.

---

## Client / UI Focus Areas

### Timeline Editor Platform (`src/components/workspace`)

Delivered:

- `timeline-editor-core.tsx` now focuses on layout, temporal state, and drag orchestration; track rows render through memoised `timeline-track-row.tsx`.
- Right-hand panels live in `timeline-track-properties.tsx`, delegating to type-specific components inside `timeline-panels/*`.
- Binding/override/shared logic resides in `timeline-binding-utils.tsx`.
- Architecture notes updated in `docs/EDITORS_ARCHITECTURE_REPORT.md`.
- Verified with `pnpm lint`, `pnpm typecheck`, and `pnpm test`.

**Follow-ups**

- Add unit coverage for `useTimelineFieldHelpers` precedence rules.
- Profile large-row dragging; memoisation scaffolding is ready for batching work.

### Workspace Inspector Tabs (Canvas / Media / Typography)

Delivered:

- Legacy 1k+ line monoliths replaced with modular folders under `components/workspace/{canvas,media,typography}`.
- Each editor is composed of `*DefaultProperties`, `*PerObjectProperties`, and badge helpers, keeping logic focused.
- Shared layout and navigation live in `components/workspace/inspector/inspector-layout.tsx`, providing the sidebar/header/property framing used by every tab.
- Per-object binding updates now flow through `applyPerObjectAssignmentUpdate` / `clearPerObjectAssignment` in `shared/properties/assignments.ts`, with regression tests in `shared/properties/assignments.test.ts`.
- The workspace router imports the new module entry points (`components/workspace/workspace-tab-content.tsx`), ensuring the extracted components are the ones shipped.

**Follow-ups**

- Expand Vitest coverage around the media per-object asset workflow (modal interactions + binding precedence).
- Measure inspector render cost on large selections; memoise sidebar item-building if profiling justifies it.

### Scene Generation Hook (`src/components/workspace/flow/hooks/use-scene-generation.ts`)

- **Pain**: ~960 lines coupling Supabase writes, polling, and UI state.
- **Next steps**
  1. Split mutations into `useSceneGenerationMutations` with shared types.
  2. Extract polling logic into `useJobPolling` with timeout/cancellation tests.
  3. Keep the exported hook as a thin orchestrator.

### Dashboard Page (`src/app/(protected)/dashboard/page.tsx`)

- **Pain**: 900+ lines combining grid/list rendering, menus, filters, and modals.
- **Next steps**
  1. Introduce presentational `WorkspaceCard` / `WorkspaceListRow` components.
  2. Extract filter sidebar into `WorkspaceFilters.tsx`.
  3. Move menu logic into `WorkspaceMenuController.tsx` so the page handles data + routing only.

---

## Shared Infrastructure

### Per-Object Assignment Helpers (`src/shared/properties/assignments.ts`)

- `applyPerObjectAssignmentUpdate` and `clearPerObjectAssignment` centralise per-object mutation logic, removing duplicate merge/reset code from UI surfaces.
- Regression tests in `shared/properties/assignments.test.ts` lock in merge, pruning, and removal behaviour.

### Scene Generation Shared Types

- Ensure server/client validators share a unified `SceneGenerationJob` contract once hook refactors land; add polling timeout and error recovery tests.

### Node Definitions Registry (`src/shared/types/definitions.ts`)

- Evaluate generating node definitions from per-category JSON schema to reduce churn and produce diffable outputs.

---

Priorities remain ordered by coupling and risk. Each task enumerates the behaviour we expect afterwards plus the preparatory work that lets us refactor incrementally while preserving production correctness.
