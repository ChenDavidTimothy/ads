import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNavigationGuard } from './use-navigation-guard';

const mockGetState = () => ({
  flow: { nodes: [], edges: [] },
  editors: { timeline: {} },
  ui: { activeTab: 'flow' },
  meta: { version: 1, lastModified: new Date(), workspaceId: 'ws1', name: 'Test' },
});

describe('useNavigationGuard', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('registers beforeunload and pagehide when dirty', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useNavigationGuard(true, mockGetState as any));
    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('pagehide', expect.any(Function));
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('pagehide', expect.any(Function));
  });
});