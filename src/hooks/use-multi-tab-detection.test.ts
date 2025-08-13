import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMultiTabDetection } from './use-multi-tab-detection';

// Mock crypto.randomUUID for stable IDs
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-tab-id',
  },
});

describe('useMultiTabDetection', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  it('detects single tab initially', () => {
    const { result } = renderHook(() => useMultiTabDetection('ws1'));
    expect(result.current.hasMultipleTabs).toBe(false);
  });

  it('detects multiple tabs when storage includes another id', () => {
    // seed another tab
    const key = 'workspace-tabs-ws1';
    localStorage.setItem(key, JSON.stringify([{ id: 'other', lastSeen: Date.now() }]));
    const { result } = renderHook(() => useMultiTabDetection('ws1'));
    expect(result.current.hasMultipleTabs).toBe(true);
  });

  it('prunes stale entries after 2 minutes', () => {
    const key = 'workspace-tabs-ws1';
    const now = Date.now();
    localStorage.setItem(key, JSON.stringify([{ id: 'stale', lastSeen: now - 3 * 60 * 1000 }]));
    const { result } = renderHook(() => useMultiTabDetection('ws1'));
    expect(result.current.hasMultipleTabs).toBe(false);
  });
});