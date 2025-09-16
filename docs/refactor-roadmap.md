# Refactor Target Roadmap

This roadmap tracks the legacy or high-risk areas we are modernising after the animation/logic executor split. For each surface we capture the current shape, what was delivered, and what is queued next so we sustain momentum without losing behavioural parity.

## Current Snapshot

### ? Asset cache manager (src/server/rendering/asset-cache-manager.ts)
- Manager now composes `asset-cache/download-service.ts`, `asset-cache/manifest-store.ts`, and `asset-cache/maintenance.ts`, keeping orchestration under 300 lines while the heavy lifting lives in focused services.
- `AssetDownloadService` encapsulates signed URL refresh, retry/backoff, integrity checks, and shared/job cache linking, emitting metrics through injected state.
- `ManifestStore` owns manifest read/write guarantees, and `CacheMaintenance` provides directory initialisation, janitor lifecycle, and hard-link capability checks with a single per-process probe.
- Added `src/server/rendering/__tests__/asset-cache-manager.test.ts` to snapshot manifest layout and metrics behaviour; verified with `pnpm lint`, `pnpm typecheck`, and targeted Vitest runs.
- **Follow-ups**:
  - Expand download-service coverage with error-path unit tests (expired URLs, hash mismatch) once real network client is injectable.
  - Plumb metrics sink into telemetry pipeline so cache copy/refresh rates surface in dashboards.

### Storage pipeline (src/server/storage)
- `SmartStorageProvider` delegates upload/cleanup work to `storage/upload-service.ts` and `storage/cleanup-runner.ts` (September 2025).
- `cleanup-service.ts` instantiates the shared runner so background janitors and foreground calls share a single implementation.
- Behavioural parity verified via existing integration usage plus `pnpm typecheck`.
- **Follow-ups**:
  - Add targeted unit tests around retry/backoff behaviour in `StorageUploadService`.
  - Capture metrics for cleanup outcomes so janitor monitoring is visible in dashboards.

### Animation router (src/server/api/routers/animation.ts)
- Router delegates to `animation/procedures/*` helpers; job orchestration moved to `rendering/jobs/asset-cache-service.ts`.
- Existing queue/media tests cover behaviour.

## High-Priority Server Work

### 1. Assets router (src/server/api/routers/assets.ts)
- **Pain**: ~900 lines blending quota CRUD, upload URL signing, Supabase CRUD, image metadata extraction, and move-to-assets orchestration.
- **Target shape**:
  1. `assets/quota-service.ts` consolidates `getOrCreateUserQuota` and `updateUserQuota` with clear interfaces for add/subtract flows.
  2. `assets/upload-service.ts` manages signed upload URL provisioning, confirmation, and metadata extraction (with configurable fetch client for testing).
  3. Router procedures become wiring-only, making it easier to test each service in isolation.
- **Prereqs**: document expected quota deltas per operation and add fixtures around the current Supabase responses (so mocks survive refactor).

### 2. Rendering job orchestration follow-up
- **Pain**: After storage and animation clean-ups, remaining job orchestration code still mixes data access and business logic in `rendering/jobs/*`.
- **Target shape**: extract job status transitions and Supabase persistence into `rendering/jobs/job-service.ts`, keeping the graphile worker entry points thin.
- **Prereqs**: inventory current job states and their side effects to avoid missing edge cases during the move.

## Client/UI Focus Areas

### Timeline editor core (src/components/workspace/timeline-editor-core.tsx)
- **Pain**: 1.6k-line component that renders every track panel and manages drag/drop state, causing heavy re-renders.
- **Next steps**:
  1. Break out per-track property editors into `timeline-panels/*` components.
  2. Extract binding/badge helpers into `timeline-binding-utils.tsx`.
  3. Keep `TimelineEditorCore` focused on layout/state orchestration with memoized subtrees.

### Workspace editor tabs (canvas/media/typography)
- **Pain**: Each tab exceeds 1k lines with duplicated binding logic between global and per-object panels.
- **Next steps**:
  1. Create reusable hooks (`useBindingState`, `usePerObjectOverrides`).
  2. Move shared inspector UI into `workspace/binding/per-object-panel.tsx`.
  3. Extract section components (position, stroke, media picker, typography) to reduce duplication.

### Scene generation hook (src/components/workspace/flow/hooks/use-scene-generation.ts)
- **Pain**: ~960 lines combining Supabase writes, polling lifecycles, and UI state.
- **Next steps**:
  1. Split Supabase mutations into `useSceneGenerationMutations` with shared type definitions.
  2. Extract polling into `useJobPolling` with unit coverage for cancellation/timeouts.
  3. Keep the exported hook as a thin orchestrator.

### Dashboard page (src/app/(protected)/dashboard/page.tsx)
- **Pain**: 900+ lines with grid/list rendering, menus, filters, and modals.
- **Next steps**:
  1. Create presentational `WorkspaceCard` / `WorkspaceListRow` components.
  2. Extract filter sidebar into `WorkspaceFilters.tsx`.
  3. Move menu logic into `WorkspaceMenuController.tsx` so the page handles data + routing only.

## Shared Infrastructure

### Scene generation shared types
- Ensure server/client validators share a single `SceneGenerationJob` contract once the hook split lands; add tests for polling timeouts and error recovery.

### Node definitions registry (src/shared/types/definitions.ts)
- Evaluate generating node definitions from per-category JSON schema to reduce churn and make diffs manageable.

---
Priorities remain ordered by coupling and risk. Each section lists the measurable outcome plus pre-work so we refactor incrementally while keeping behaviour identical.
