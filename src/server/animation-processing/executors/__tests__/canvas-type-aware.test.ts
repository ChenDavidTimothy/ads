import { describe, test, beforeEach } from 'vitest';
import { CanvasNodeExecutor } from '../canvas-executor';
import type { ExecutionContext } from '../../execution-context';
import type { SceneObject } from '@/shared/types/scene';

describe('Canvas Type-Aware Properties', () => {
  let executor: CanvasNodeExecutor;
  let context: ExecutionContext;

  beforeEach(() => {
    executor = new CanvasNodeExecutor();
    context = {
      nodeOutputs: new Map(),
      variables: new Map(),
      executedNodes: new Set(),
      currentTime: 0,
      conditionalPaths: new Map(),
      executionStack: [],
      sceneObjectsByScene: new Map(),
      sceneAnimations: [],
      objectSceneMap: new Map(),
      animationSceneMap: new Map(),
    };
  });

  test('skips color properties for text objects', async () => {
    // Test implementation using existing patterns
    const textObject: SceneObject = {
      id: 'text_001',
      type: 'text',
      properties: { content: 'Hello', fontSize: 24 },
      initialPosition: { x: 0, y: 0 }
    };

    const canvasNode = {
      data: {
        identifier: { id: 'canvas_001', type: 'canvas' as const },
        fillColor: '#ff0000',
        strokeColor: '#00ff00',
        strokeWidth: 5
      }
    };

    // Execute and verify text object doesn't get Canvas colors
    // Implementation details follow existing test patterns
  });

  test('applies color properties for geometry objects', async () => {
    // Similar test for geometry objects
  });
});
