'use client';

export function WorkspaceSkeleton() {
  return (
    <div className="flex h-screen flex-col bg-[var(--surface-0)]">
      {/* Top bar */}
      <div className="flex h-14 items-center justify-between border-b border-[var(--border-primary)] bg-[var(--surface-1)] px-[var(--space-4)]">
        <div className="flex items-center gap-[var(--space-4)]">
          <div className="h-8 w-8 animate-pulse rounded bg-[var(--surface-3)]" />
          <div className="h-8 w-32 animate-pulse rounded bg-[var(--surface-3)]" />
          {/* Tabs */}
          <div className="hidden gap-2 md:flex">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-8 w-20 animate-pulse rounded bg-[var(--surface-2)]" />
            ))}
          </div>
        </div>
        <div className="h-5 w-48 animate-pulse rounded bg-[var(--surface-3)]" />
        <div className="flex items-center gap-[var(--space-3)]">
          <div className="h-8 w-8 animate-pulse rounded bg-[var(--surface-3)]" />
          <div className="h-8 w-8 animate-pulse rounded bg-[var(--surface-3)]" />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <div className="hidden w-64 border-r border-[var(--border-primary)] bg-[var(--surface-1)] p-3 md:block">
          <div className="mb-3 h-8 w-40 animate-pulse rounded bg-[var(--surface-2)]" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="mb-2 h-7 w-full animate-pulse rounded bg-[var(--surface-2)]" />
          ))}
        </div>

        {/* Center canvas/editor area */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Toolbar */}
          <div className="flex items-center gap-2 border-b border-[var(--border-primary)] bg-[var(--surface-1)] p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-8 w-8 animate-pulse rounded bg-[var(--surface-3)]" />
            ))}
            <div className="ml-auto h-8 w-40 animate-pulse rounded bg-[var(--surface-3)]" />
          </div>

          {/* Canvas placeholder */}
          <div className="flex flex-1 items-center justify-center bg-[var(--surface-0)] p-4">
            <div className="h-full w-full max-w-[1100px] rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 backdrop-blur-sm">
              <div className="mx-auto h-[340px] w-[600px] animate-pulse rounded bg-[var(--surface-2)] md:h-[520px] md:w-[880px]" />
              <div className="mx-auto mt-4 grid max-w-[880px] grid-cols-3 gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-6 animate-pulse rounded bg-[var(--surface-3)]" />
                ))}
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="border-t border-[var(--border-primary)] bg-[var(--surface-1)] p-3">
            <div className="mb-2 h-4 w-24 animate-pulse rounded bg-[var(--surface-3)]" />
            <div className="grid grid-cols-12 gap-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-[var(--surface-2)]" />
              ))}
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="hidden w-80 border-l border-[var(--border-primary)] bg-[var(--surface-1)] p-3 lg:block">
          <div className="mb-3 h-8 w-48 animate-pulse rounded bg-[var(--surface-2)]" />
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="mb-2 h-7 w-full animate-pulse rounded bg-[var(--surface-2)]" />
          ))}
        </div>
      </div>
    </div>
  );
}
