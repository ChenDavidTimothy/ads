# Refactor Target Roadmap

This document captures the next set of legacy or high-risk areas that should follow the animation/logic executor split. Each entry documents the current pain points, why the file should be decomposed, and a concrete plan of action.

## Recently Completed

### src/server/api/routers/animation.ts
- **Status**: Completed (asset cache + validation refactor delivered, September 2025)
- **Outcome**: Router now delegates to `animation/procedures/*`, job orchestration lives in `rendering/jobs/asset-cache-service.ts`, and transformation/validation helpers are centralized under the `animation-processing` namespace. Behaviour is covered by existing queue + media tests.

## High-Priority Server-Side Refactors

### src/server/storage/smart-storage-provider.ts
- **Why**: Nearly 1k lines juggling temp-file prep, Supabase streaming, retries, clean-up, and quota enforcement. Mixing filesystem and network concerns hides failure modes.
- **Plan**:
  1. Create a `storage/upload-service.ts` responsible for finalize/upload/retry.
  2. Move clean-up scheduling and orphan detection into `storage/cleanup-service.ts`.
  3. Keep `SmartStorageProvider` as a facade delegating to the new services and unit test each subsystem individually.

### src/server/rendering/asset-cache-manager.ts
- **Why**: Large class (800+ lines) covering download orchestration, manifest persistence, concurrency limits, and integrity checks. Hard to reason about race conditions.
- **Plan**:
  1. Extract download logic into `asset-cache/download-service.ts` with explicit retry + verification pipelines.
  2. Move manifest I/O into `asset-cache/manifest-store.ts`.
  3. Split maintenance/startup checks into `asset-cache/maintenance.ts` and simplify the manager to a coordinator.

### src/server/api/routers/assets.ts
- **Why**: Router currently handles uploads, URL signing, quota tracking, and Supabase CRUD in one file (~900 lines). Any change risks regressions across concerns.
- **Plan**:
  1. Introduce `assets/quota-service.ts` for quota CRUD and soft limits.
  2. Move upload URL generation + confirmation logic into `assets/upload-service.ts`.
  3. Slim the router to wiring-only, importing the services per procedure.

## Client-Side / UI Refactors

### src/components/workspace/timeline-editor-core.tsx
- **Why**: 1.6k-line component rendering all track panels, field badges, and drag/drop state. Hard to memoize, expensive re-renders.
- **Plan**:
  1. Split per-track property editors (move, rotate, scale, fade, color, slide) into `timeline-panels/*` components.
  2. Extract binding/badge helpers into `timeline-binding-utils.tsx`.
  3. Keep `TimelineEditorCore` focused on layout/state orchestration.

### src/components/workspace/canvas-editor-tab.tsx, media-editor-tab.tsx, typography-editor-tab.tsx
- **Why**: Each file exceeds 1k lines with duplicated binding logic between global and per-object panels.
- **Plan**:
  1. Create reusable hooks (`useBindingState`, `usePerObjectOverrides`).
  2. Move shared per-object inspector into `workspace/binding/per-object-panel.tsx`.
  3. Extract section components (position, stroke, media asset picker, typography styling) to reduce duplication.

### src/components/workspace/flow/hooks/use-scene-generation.ts
- **Why**: ~960 lines combining Supabase writes, polling, error handling, and UI state. Difficult to reason about polling lifecycles.
- **Plan (next increment)**:
  1. Split Supabase mutations into `useSceneGenerationMutations` along with shared type definitions (`SceneGenerationJob`).
  2. Extract polling (videos/images) into a dedicated `useJobPolling` hook with unit coverage for cancellation/timeouts.
  3. Keep the exported hook as a thin orchestrator that composes the specialized hooks.

### src/app/(protected)/dashboard/page.tsx
- **Why**: 900+ lines with grid/list rendering, menus, filters, and modals in one component; poor reusability and testing.
- **Plan**:
  1. Create presentational components (`WorkspaceCard`, `WorkspaceListRow`).
  2. Extract filter sidebar into `WorkspaceFilters.tsx`.
  3. Move menu logic into `WorkspaceMenuController.tsx` so the page handles data and routing only.

## Shared Infrastructure

### src/components/workspace/flow/hooks/use-scene-generation.ts (follow-up)
- **Why**: After splitting polling/mutations, ensure shared job types and response guards stay consistent with the backend validators.
- **Plan**:
  1. Define a shared `SceneGenerationJob` type consumed by both client and server validators.
  2. Add unit tests for polling timeouts and error recovery.

### src/shared/types/definitions.ts
- **Why**: 1.2k-line registry is coherent but hard to diff; consider codegen.
- **Plan**:
  1. Generate node definitions from JSON schemas stored per node category to reduce churn.
  2. Keep the aggregated file auto-generated with linting checks.

---
These items are prioritized by coupling and change frequency; addressing them will continue the removal of legacy bloat and improve modularity across the codebase.

