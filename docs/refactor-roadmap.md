# Refactor Target Roadmap (Autumn 2025)

This roadmap keeps a running snapshot of high‑risk or legacy surfaces we are modernising post animation/logic executor split. Each section records the current structure, the work already delivered, and the next bets so we keep momentum without risking behavioural regressions.

---

## Current Snapshot

### ✓ Asset Cache Manager (`src/server/rendering/asset-cache-manager.ts`)
- Manager now orchestrates the focused services in `asset-cache/download-service.ts`, `asset-cache/manifest-store.ts`, and `asset-cache/maintenance.ts`, keeping the entry point under 300 lines.
- `AssetDownloadService` encapsulates signed-URL refresh, retry/backoff, integrity checks, and shared/job cache linking, emitting metrics via injected state.
- `ManifestStore` owns manifest read/write guarantees; `CacheMaintenance` provides directory initialisation, janitor lifecycle, and a single-process hard-link probe.
- Added `src/server/rendering/__tests__/asset-cache-manager.test.ts` to snapshot manifest layout and metrics behaviour; validated with `pnpm lint`, `pnpm typecheck`, and targeted Vitest runs.
- **Follow-ups**  
  - Expand download-service unit coverage (expired URLs, hash mismatch) after wiring an injectable network client.  
  - Feed cache metrics into the telemetry pipeline so copy/refresh rates surface on dashboards.

### ✓ Storage Pipeline (`src/server/storage`)
- `SmartStorageProvider` delegates upload/cleanup to `storage/upload-service.ts` and `storage/cleanup-runner.ts` (Sep 2025).
- `cleanup-service.ts` consumes the shared runner so background janitors and foreground calls share a single implementation.
- Behaviour verified via existing integration usage and `pnpm typecheck`.
- **Follow-ups**  
  - Add retry/backoff unit tests for `StorageUploadService`.  
  - Emit cleanup outcome metrics for dashboard visibility.

### ✓ Animation Router (`src/server/api/routers/animation.ts`)
- Router delegates to `animation/procedures/*`; asset orchestration now lives in `rendering/jobs/asset-cache-service.ts`.
- Behaviour covered by existing queue/media tests.

### ✓ Asset Services (`src/server/api/routers/assets.ts`)
- Router shrank from ~900 lines to thin wiring that calls `src/server/api/services/assets/*`.
- Services cover quota (`quota-service.ts`), uploads (`upload-service.ts`), catalogue/listing (`catalog-service.ts`), and lifecycle operations (`lifecycle-service.ts`) with dedicated Vitest suites using injectable dependencies.
- `handleServiceError` centralises domain-error translation into TRPC responses.
- Validated via `pnpm test` and `pnpm check`.
- **Follow-ups**  
  - Instrument service metrics (quota deltas, upload confirmations, lifecycle moves).  
  - Add TRPC integration smoke tests.  
  - Reuse the service layer on the worker side to avoid divergence.

---

## High-Priority Server Work

### 1. Rendering Job Orchestration Follow-Up
- **Pain**: Residual logic in `rendering/jobs/*` still mixes persistence and orchestration.
- **Target**: Extract job transitions/Supabase persistence into `rendering/jobs/job-service.ts`, keeping graphile worker entry points slim.
- **Preparation**: Inventory current job states plus side effects before splitting.

---

## Client/UI Focus Areas

### ✓ Timeline Editor Platform (`src/components/workspace`)
Delivered:
- `timeline-editor-core.tsx` now focuses on layout, temporal state, and drag orchestration. Track rows render via the memoised `timeline-track-row.tsx`, eliminating the 1.6 k-line monolith.
- Right-panel orchestration moved to `timeline-track-properties.tsx`, which hands off to type-specific components in `timeline-panels/*`.
- Binding/override logic is centralised in `timeline-binding-utils.tsx` for reuse across panels.
- Documentation updated (`docs/EDITORS_ARCHITECTURE_REPORT.md`) to reflect the new structure.
- Verified with `pnpm lint`, `pnpm typecheck`, and `pnpm test`.

**Follow-ups**
- Add focused unit tests for `useTimelineFieldHelpers` override precedence.
- Profile track dragging with large node counts; memoisation paths already exist for future batching.

### Workspace Editor Tabs (Canvas / Media / Typography)
- **Pain**: Each tab exceeds 1k lines with duplicated binding logic between global and per-object panels.
- **Next steps**
  1. Build reusable hooks (`useBindingState`, `usePerObjectOverrides`).
  2. Move shared inspector scaffolding into `workspace/binding/per-object-panel.tsx`.
  3. Extract section components (position, stroke, media picker, typography) to remove duplication.

### Scene Generation Hook (`src/components/workspace/flow/hooks/use-scene-generation.ts`)
- **Pain**: ~960 lines coupling Supabase writes, polling, and UI state.
- **Next steps**
  1. Split mutations into `useSceneGenerationMutations` with shared types.
  2. Extract polling logic into `useJobPolling` with timeout/cancellation tests.
  3. Keep exported hook as a thin orchestrator.

### Dashboard Page (`src/app/(protected)/dashboard/page.tsx`)
- **Pain**: 900+ lines combining grid/list rendering, menus, filters, and modals.
- **Next steps**
  1. Introduce presentational `WorkspaceCard` / `WorkspaceListRow` components.
  2. Extract filter sidebar into `WorkspaceFilters.tsx`.
  3. Move menu logic into `WorkspaceMenuController.tsx` so the page handles data + routing only.

---

## Shared Infrastructure

### Scene Generation Shared Types
- Ensure server/client validators share a unified `SceneGenerationJob` contract once hook refactors land; add polling timeout and error recovery tests.

### Node Definitions Registry (`src/shared/types/definitions.ts`)
- Evaluate generating node definitions from per-category JSON schema to reduce churn and surface manageable diffs.

---

Priorities stay ordered by coupling and risk. Each section outlines the measurable outcome, plus pre-work so we refactor incrementally while preserving behavioural parity.
