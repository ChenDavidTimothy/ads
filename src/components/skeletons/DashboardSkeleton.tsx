"use client";

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--surface-0)]">
      {/* Header skeleton */}
      <div className="sticky top-0 z-50 border-b border-[var(--border-primary)] bg-[var(--surface-1)]/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-36 animate-pulse rounded bg-[var(--surface-3)]" />
          </div>

          <nav className="hidden items-center gap-8 md:flex">
            <div className="h-4 w-16 animate-pulse rounded bg-[var(--surface-3)]" />
            <div className="h-4 w-16 animate-pulse rounded bg-[var(--surface-3)]" />
            <div className="h-4 w-16 animate-pulse rounded bg-[var(--surface-3)]" />
          </nav>

          <div className="flex items-center gap-3">
            <div className="h-8 w-24 animate-pulse rounded bg-[var(--surface-3)]" />
          </div>
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Title & actions */}
        <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2 h-8 w-64 animate-pulse rounded bg-[var(--surface-2)]" />
            <div className="h-4 w-80 animate-pulse rounded bg-[var(--surface-2)]" />
          </div>
          <div className="flex gap-3">
            <div className="h-9 w-24 animate-pulse rounded bg-[var(--surface-2)]" />
            <div className="h-9 w-36 animate-pulse rounded bg-[var(--surface-2)]" />
          </div>
        </div>

        {/* Search and filters */}
        <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="relative w-full max-w-md">
            <div className="h-10 w-full animate-pulse rounded bg-[var(--surface-2)]" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-28 animate-pulse rounded bg-[var(--surface-2)]" />
            <div className="h-10 w-28 animate-pulse rounded bg-[var(--surface-2)]" />
            <div className="h-10 w-28 animate-pulse rounded bg-[var(--surface-2)]" />
          </div>
        </div>

        {/* Recent workspaces grid skeleton */}
        <div className="mb-10">
          <div className="mb-4 h-6 w-48 animate-pulse rounded bg-[var(--surface-2)]" />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] p-6 backdrop-blur-sm"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className="h-10 w-10 animate-pulse rounded bg-[var(--surface-3)]" />
                  <div className="h-4 w-6 animate-pulse rounded bg-[var(--surface-3)]" />
                </div>
                <div className="mb-2 h-5 w-40 animate-pulse rounded bg-[var(--surface-2)]" />
                <div className="h-4 w-24 animate-pulse rounded bg-[var(--surface-3)]" />
              </div>
            ))}
          </div>
        </div>

        {/* All workspaces grid/list skeleton */}
        <div className="mb-4 h-6 w-56 animate-pulse rounded bg-[var(--surface-2)]" />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] p-6 backdrop-blur-sm"
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="h-10 w-10 animate-pulse rounded bg-[var(--surface-3)]" />
                <div className="h-4 w-6 animate-pulse rounded bg-[var(--surface-3)]" />
              </div>
              <div className="mb-2 h-5 w-44 animate-pulse rounded bg-[var(--surface-2)]" />
              <div className="space-y-2">
                <div className="h-4 w-40 animate-pulse rounded bg-[var(--surface-3)]" />
                <div className="h-4 w-24 animate-pulse rounded bg-[var(--surface-3)]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
