import { describe, it, expect, beforeEach } from 'vitest';
import {
  transformFactory,
  transformEvaluator,
  getAllTransformTypes,
  getTransformsByCategory,
  getDefaultProperties,
  getTransformDefinition,
  TRANSFORM_DEFINITIONS,
  INTERPOLATOR_REGISTRY,
  EASING_REGISTRY
} from '../transforms';
import type { AnimationTransform, SceneTransform, TransformDefinition } from '../../types/transforms';

describe('Transform Registry System', () => {
  beforeEach(() => {
    // Reset any state if needed
  });

  describe('Transform Definitions', () => {
    it('should have all expected transform types', () => {
      const types = getAllTransformTypes();
      expect(types).toContain('move');
      expect(types).toContain('rotate');
      expect(types).toContain('scale');
      expect(types).toContain('fade');
      expect(types).toContain('color');
      expect(types).toHaveLength(5);
    });

    it('should have correct transform definitions', () => {
      const moveDef = getTransformDefinition('move');
      expect(moveDef).toBeDefined();
      expect(moveDef?.type).toBe('move');
      expect(moveDef?.metadata.targetProperty).toBe('position');
      expect(moveDef?.metadata.supportsEasing).toBe(true);

      const rotateDef = getTransformDefinition('rotate');
      expect(rotateDef).toBeDefined();
      expect(rotateDef?.type).toBe('rotate');
      expect(rotateDef?.metadata.targetProperty).toBe('rotation');
      expect(rotateDef?.metadata.supportsEasing).toBe(true);
    });

    it('should have correct property definitions', () => {
      const moveDef = getTransformDefinition('move');
      expect(moveDef?.properties).toHaveProperty('from');
      expect(moveDef?.properties).toHaveProperty('to');
      expect(moveDef?.properties.from.type).toBe('point2d');
      expect(moveDef?.properties.to.type).toBe('point2d');
    });
  });

  describe('Transform Factory', () => {
    it('should create transforms with correct defaults', () => {
      const moveTransform = transformFactory.createTransform('move', {
        from: { x: 0, y: 0 },
        to: { x: 100, y: 100 }
      });

      expect(moveTransform.type).toBe('move');
      expect(moveTransform.properties.from).toEqual({ x: 0, y: 0 });
      expect(moveTransform.properties.to).toEqual({ x: 100, y: 100 });
      expect(moveTransform.easing).toBe('easeInOut'); // default from definition
    });

    it('should create scene transforms correctly', () => {
      const clientTransform: AnimationTransform = {
        id: 'test-1',
        type: 'move',
        startTime: 0,
        duration: 2,
        easing: 'linear',
        properties: {
          from: { x: 0, y: 0 },
          to: { x: 100, y: 100 }
        }
      };

      const sceneTransform = transformFactory.createSceneTransform(
        clientTransform,
        'object-1',
        10
      );

      expect(sceneTransform.objectId).toBe('object-1');
      expect(sceneTransform.startTime).toBe(10); // baseline time
      expect(sceneTransform.type).toBe('move');
      expect(sceneTransform.properties.from).toEqual({ x: 0, y: 0 });
      expect(sceneTransform.properties.to).toEqual({ x: 100, y: 100 });
    });

    it('should validate transforms correctly', () => {
      const validTransform = transformFactory.createTransform('move', {
        from: { x: 0, y: 0 },
        to: { x: 100, y: 100 }
      });

      const validation = transformFactory.validateTransform(validTransform);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject invalid transforms', () => {
      const invalidTransform = transformFactory.createTransform('move', {
        from: 'invalid' as any,
        to: { x: 100, y: 100 }
      });

      const validation = transformFactory.validateTransform(invalidTransform);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Transform Evaluator', () => {
    it('should evaluate move transforms correctly', () => {
      const sceneTransform: SceneTransform = {
        objectId: 'test',
        type: 'move',
        startTime: 0,
        duration: 2,
        easing: 'linear',
        properties: {
          from: { x: 0, y: 0 },
          to: { x: 100, y: 100 }
        }
      };

      const result = transformEvaluator.evaluateTransform(sceneTransform, 0.5);
      expect(result).toEqual({ x: 50, y: 50 });
    });

    it('should evaluate rotate transforms correctly', () => {
      const sceneTransform: SceneTransform = {
        objectId: 'test',
        type: 'rotate',
        startTime: 0,
        duration: 2,
        easing: 'linear',
        properties: {
          from: 0,
          to: 0,
          rotations: 1
        }
      };

      const result = transformEvaluator.evaluateTransform(sceneTransform, 0.5);
      expect(result).toBe(Math.PI); // half rotation
    });

    it('should apply easing correctly', () => {
      const sceneTransform: SceneTransform = {
        objectId: 'test',
        type: 'fade',
        startTime: 0,
        duration: 2,
        easing: 'easeInOut',
        properties: {
          from: 0,
          to: 1
        }
      };

      const result = transformEvaluator.evaluateTransform(sceneTransform, 0.5);
      // easeInOut should give a different value than linear
      expect(result).not.toBe(0.5);
    });

    it('should get end values correctly', () => {
      const sceneTransform: SceneTransform = {
        objectId: 'test',
        type: 'move',
        startTime: 0,
        duration: 2,
        easing: 'linear',
        properties: {
          from: { x: 0, y: 0 },
          to: { x: 100, y: 100 }
        }
      };

      const endValue = transformEvaluator.getEndValue(sceneTransform);
      expect(endValue).toEqual({ x: 100, y: 100 });
    });
  });

  describe('Interpolator Registry', () => {
    it('should have all required interpolators', () => {
      expect(INTERPOLATOR_REGISTRY.number).toBeDefined();
      expect(INTERPOLATOR_REGISTRY.point2d).toBeDefined();
      expect(INTERPOLATOR_REGISTRY.color).toBeDefined();
      expect(INTERPOLATOR_REGISTRY.string).toBeDefined();
      expect(INTERPOLATOR_REGISTRY.boolean).toBeDefined();
    });

    it('should interpolate numbers correctly', () => {
      const interpolator = INTERPOLATOR_REGISTRY.number;
      const result = interpolator.interpolate(0, 100, 0.5);
      expect(result).toBe(50);
    });

    it('should interpolate points correctly', () => {
      const interpolator = INTERPOLATOR_REGISTRY.point2d;
      const result = interpolator.interpolate(
        { x: 0, y: 0 },
        { x: 100, y: 200 },
        0.5
      );
      expect(result).toEqual({ x: 50, y: 100 });
    });

    it('should validate values correctly', () => {
      const numberInterpolator = INTERPOLATOR_REGISTRY.number;
      expect(numberInterpolator.validate(42)).toBe(true);
      expect(numberInterpolator.validate('invalid')).toBe(false);

      const pointInterpolator = INTERPOLATOR_REGISTRY.point2d;
      expect(pointInterpolator.validate({ x: 0, y: 0 })).toBe(true);
      expect(pointInterpolator.validate({ x: 0 })).toBe(false);
    });
  });

  describe('Easing Registry', () => {
    it('should have all required easing functions', () => {
      expect(EASING_REGISTRY.linear).toBeDefined();
      expect(EASING_REGISTRY.easeIn).toBeDefined();
      expect(EASING_REGISTRY.easeOut).toBeDefined();
      expect(EASING_REGISTRY.easeInOut).toBeDefined();
    });

    it('should apply easing correctly', () => {
      const linear = EASING_REGISTRY.linear(0.5);
      expect(linear).toBe(0.5);

      const easeIn = EASING_REGISTRY.easeIn(0.5);
      expect(easeIn).toBeLessThan(0.5); // easeIn starts slow

      const easeOut = EASING_REGISTRY.easeOut(0.5);
      expect(easeOut).toBeGreaterThan(0.5); // easeOut ends slow
    });
  });

  describe('Integration', () => {
    it('should work end-to-end for a complete animation', () => {
      // Create a transform
      const transform = transformFactory.createTransform('move', {
        from: { x: 0, y: 0 },
        to: { x: 100, y: 100 }
      });

      // Create a scene transform
      const sceneTransform = transformFactory.createSceneTransform(
        transform,
        'object-1',
        0
      );

      // Evaluate at different times
      const start = transformEvaluator.evaluateTransform(sceneTransform, 0);
      const middle = transformEvaluator.evaluateTransform(sceneTransform, 0.5);
      const end = transformEvaluator.evaluateTransform(sceneTransform, 1);

      expect(start).toEqual({ x: 0, y: 0 });
      expect(middle).toEqual({ x: 50, y: 50 });
      expect(end).toEqual({ x: 100, y: 100 });
    });

    it('should handle multiple transform types consistently', () => {
      const transforms = ['move', 'rotate', 'scale', 'fade', 'color'] as const;
      
      for (const type of transforms) {
        const transform = transformFactory.createTransform(type, getDefaultProperties(type));
        const sceneTransform = transformFactory.createSceneTransform(transform, 'test', 0);
        
        // Should be able to evaluate without errors
        const result = transformEvaluator.evaluateTransform(sceneTransform, 0.5);
        expect(result).toBeDefined();
        
        // Should be able to get end value
        const endValue = transformEvaluator.getEndValue(sceneTransform);
        expect(endValue).toBeDefined();
      }
    });
  });
});