import { describe, expect, it } from 'vitest';

import type { PerObjectAssignments } from './assignments';
import { applyPerObjectAssignmentUpdate, clearPerObjectAssignment } from './assignments';

describe('applyPerObjectAssignmentUpdate', () => {
  it('merges nested keys for canvas-style updates', () => {
    const base = {
      objectA: {
        initial: {
          position: { x: 10, y: 20 },
          scale: { x: 1, y: 1 },
        },
      },
    } satisfies PerObjectAssignments;

    const result = applyPerObjectAssignmentUpdate(
      base,
      'objectA',
      {
        position: { x: 42 },
      },
      { nestedKeys: ['position', 'scale'] }
    );

    expect(result).not.toBe(base);
    expect(result.objectA).toBeDefined();
    expect(result.objectA!.initial?.position).toEqual({ x: 42, y: 20 });
    expect(result.objectA!.initial?.scale).toEqual({ x: 1, y: 1 });
  });

  it('removes entry when merged initial is empty and removeWhenEmpty is true', () => {
    const base = {
      objectA: {
        initial: { fillColor: '#fff' },
      },
    } satisfies PerObjectAssignments;

    const result = applyPerObjectAssignmentUpdate(
      base,
      'objectA',
      { fillColor: undefined },
      { removeWhenEmpty: true }
    );

    expect(result.objectA).toBeUndefined();
    // Ensure original map is untouched
    expect(base.objectA.initial?.fillColor).toBe('#fff');
  });

  it('creates new assignment map when starting from undefined', () => {
    const result = applyPerObjectAssignmentUpdate(undefined, 'objectA', { opacity: 0.5 });

    expect(result.objectA?.initial?.opacity).toBe(0.5);
  });
});

describe('clearPerObjectAssignment', () => {
  it('removes the requested object without mutating the source map', () => {
    const base = {
      objectA: {
        initial: { opacity: 1 },
      },
    } satisfies PerObjectAssignments;

    const result = clearPerObjectAssignment(base, 'objectA');

    expect(result.objectA).toBeUndefined();
    expect(base.objectA.initial?.opacity).toBe(1);
  });

  it('returns the original map when object is absent', () => {
    const base = {
      objectA: {
        initial: { opacity: 1 },
      },
    } satisfies PerObjectAssignments;

    const result = clearPerObjectAssignment(base, 'missing');

    expect(result).toBe(base);
  });
});
