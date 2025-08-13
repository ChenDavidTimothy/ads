import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCrashBackup } from './use-crash-backup';
import type { WorkspaceState } from '@/types/workspace-state';

const makeState = (): WorkspaceState => ({
  flow: { nodes: [], edges: [] },
  editors: { timeline: {} },
  ui: { activeTab: 'flow' },
  meta: { version: 1, lastModified: new Date(), workspaceId: 'wsX', name: 'Test' },
});

describe('useCrashBackup', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  it('writes backup periodically and recovers', () => {
    const { result } = renderHook(() => useCrashBackup('wsX', () => makeState(), { intervalMs: 1000, maxAgeMs: 60000 }));
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(result.current.hasBackup).toBe(true);
    const recovered = result.current.recover();
    expect(recovered?.meta.workspaceId).toBe('wsX');
    act(() => {
      result.current.dismiss();
    });
    expect(result.current.hasBackup).toBe(false);
  });
});