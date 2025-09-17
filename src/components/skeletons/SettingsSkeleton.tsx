'use client';

export function SettingsSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--surface-0)]">
      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-[var(--border-primary)] bg-[var(--surface-1)]/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="h-10 w-36 animate-pulse rounded bg-[var(--surface-3)]" />
          <div className="hidden items-center gap-8 md:flex">
            <div className="h-4 w-16 animate-pulse rounded bg-[var(--surface-3)]" />
            <div className="h-4 w-16 animate-pulse rounded bg-[var(--surface-3)]" />
          </div>
          <div className="h-8 w-24 animate-pulse rounded bg-[var(--surface-3)]" />
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 h-8 w-40 animate-pulse rounded bg-[var(--surface-2)]" />

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-9 w-full animate-pulse rounded bg-[var(--surface-2)]" />
              ))}
            </div>
          </div>

          {/* Content Card */}
          <div className="lg:col-span-3">
            <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-8 backdrop-blur-sm">
              <div className="mb-6 h-6 w-56 animate-pulse rounded bg-[var(--surface-2)]" />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <div className="mb-2 h-4 w-24 animate-pulse rounded bg-[var(--surface-3)]" />
                  <div className="h-10 w-full animate-pulse rounded bg-[var(--surface-2)]" />
                </div>
                <div>
                  <div className="mb-2 h-4 w-24 animate-pulse rounded bg-[var(--surface-3)]" />
                  <div className="h-10 w-full animate-pulse rounded bg-[var(--surface-2)]" />
                </div>
              </div>

              <div className="mt-6">
                <div className="mb-2 h-4 w-28 animate-pulse rounded bg-[var(--surface-3)]" />
                <div className="h-10 w-full animate-pulse rounded bg-[var(--surface-2)]" />
                <div className="mt-1 h-3 w-64 animate-pulse rounded bg-[var(--surface-3)]" />
              </div>

              <div className="mt-6 h-10 w-40 animate-pulse rounded bg-[var(--surface-2)]" />

              <div className="mt-10 border-t border-[var(--border-primary)] pt-6">
                <div className="mb-4 h-6 w-48 animate-pulse rounded bg-[var(--surface-2)]" />
                <div className="flex items-center justify-between">
                  <div>
                    <div className="mb-1 h-4 w-20 animate-pulse rounded bg-[var(--surface-3)]" />
                    <div className="h-3 w-72 animate-pulse rounded bg-[var(--surface-3)]" />
                  </div>
                  <div className="h-9 w-28 animate-pulse rounded bg-[var(--surface-2)]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
