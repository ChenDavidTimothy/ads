import { describe, expect, it } from 'vitest';

import {
  NODE_PORT_EDGE_PADDING,
  NODE_PORT_MIN_GAP,
  NODE_PORT_MIN_HEIGHT,
  computePortLayout,
} from '../node-chrome';

const safeHeight = (value: number) => Math.max(value, NODE_PORT_MIN_HEIGHT);

const spacingFor = (a: number, b: number) => safeHeight(a) / 2 + safeHeight(b) / 2 + NODE_PORT_MIN_GAP;

describe('computePortLayout', () => {
  it('prevents overlaps when preferred anchors cluster together', () => {
    const inputs = [
      { id: 'alpha', preferredTop: 0.4, height: 96 },
      { id: 'beta', preferredTop: 0.42, height: 72 },
      { id: 'gamma', preferredTop: 0.45, height: 68 },
    ];

    const { positions } = computePortLayout(inputs, 240);

    const centers = inputs.map((input) => positions.get(input.id) ?? 0);

    // Ensure ordering is preserved and spacing is enforced.
    for (let index = 0; index < centers.length - 1; index += 1) {
      expect(centers[index]).toBeLessThan(centers[index + 1]);
      const minimumSpacing = spacingFor(inputs[index].height, inputs[index + 1].height);
      expect(centers[index + 1] - centers[index]).toBeGreaterThanOrEqual(minimumSpacing - 0.5);
    }
  });

  it('reports the minimum required node height for large port content', () => {
    const inputs = [
      { id: 'in', preferredTop: 0.2, height: 140 },
      { id: 'out', preferredTop: 0.8, height: 164 },
    ];

    const { requiredHeight } = computePortLayout(inputs, 180);
    const expectedHeight = inputs.reduce((total, input, index) => {
      const gap = index === 0 ? 0 : NODE_PORT_MIN_GAP;
      return total + safeHeight(input.height) + gap;
    }, NODE_PORT_EDGE_PADDING * 2);

    expect(requiredHeight).toBeCloseTo(expectedHeight, 3);
  });

  it('clamps anchors to the card bounds with padding', () => {
    const inputs = [
      { id: 'top', preferredTop: 0, height: 18 },
      { id: 'bottom', preferredTop: 1, height: 18 },
    ];

    const containerHeight = 160;
    const { positions } = computePortLayout(inputs, containerHeight);

    const topCenter = positions.get('top');
    const bottomCenter = positions.get('bottom');

    expect(topCenter).toBeDefined();
    expect(bottomCenter).toBeDefined();

    if (topCenter && bottomCenter) {
      const halfHeight = safeHeight(inputs[0].height) / 2;
      const lowerBound = NODE_PORT_EDGE_PADDING + halfHeight;
      const upperBound = containerHeight - NODE_PORT_EDGE_PADDING - halfHeight;

      expect(topCenter).toBeGreaterThanOrEqual(lowerBound - 0.5);
      expect(bottomCenter).toBeLessThanOrEqual(upperBound + 0.5);
      expect(bottomCenter - topCenter).toBeGreaterThanOrEqual(
        spacingFor(inputs[0].height, inputs[1].height) - 0.5
      );
    }
  });
});
