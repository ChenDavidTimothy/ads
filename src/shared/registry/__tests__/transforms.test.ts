import { describe, it, expect, beforeEach } from 'vitest';
import {
  transformFactory,
  TransformEvaluator,
  getTransformDefinition,
  getDefaultProperties,
  getAllTransformTypes,
  getTransformsByCategory,
  getInterpolator,
  canInterpolate,
  getSupportedPropertyTypes
} from '../transforms';

describe('Transform Registry System', () => {
  let transformEvaluator: TransformEvaluator;

  beforeEach(() => {
    transformEvaluator = new TransformEvaluator();
  });

  describe('Transform Definitions', () => {
    it('should have all expected transform types', () => {
      const types = getAllTransformTypes();
      expect(types).toContain('move');
      expect(types).toContain('rotate');
      expect(types).toContain('scale');
      expect(types).toContain('fade');
      expect(types).toContain('color');
    });

    it('should have correct metadata for move transform', () => {
      const moveDef = getTransformDefinition('move');
      expect(moveDef).toBeDefined();
      expect(moveDef?.metadata?.targetProperty).toBe('position');
      expect(moveDef?.metadata?.supportsEasing).toBe(true);
    });

    it('should have correct metadata for rotate transform', () => {
      const rotateDef = getTransformDefinition('rotate');
      expect(rotateDef).toBeDefined();
      expect(rotateDef?.metadata?.targetProperty).toBe('rotation');
      expect(rotateDef?.metadata?.supportsEasing).toBe(true);
    });

    it('should have correct property definitions for move transform', () => {
      const moveDef = getTransformDefinition('move');
      expect(moveDef).toBeDefined();
      
      const fromProp = moveDef?.properties.find(p => p.key === 'from');
      const toProp = moveDef?.properties.find(p => p.key === 'to');
      
      expect(fromProp?.type).toBe('point2d');
      expect(toProp?.type).toBe('point2d');
    });

    it('should have correct property definitions for rotate transform', () => {
      const rotateDef = getTransformDefinition('rotate');
      expect(rotateDef).toBeDefined();
      
      const fromProp = rotateDef?.properties.find(p => p.key === 'from');
      const toProp = rotateDef?.properties.find(p => p.key === 'to');
      
      expect(fromProp?.type).toBe('number');
      expect(toProp?.type).toBe('number');
    });

    it('should categorize transforms correctly', () => {
      const transformTypes = getTransformsByCategory('movement');
      expect(transformTypes).toHaveLength(2); // move and rotate
      expect(transformTypes.map(t => t.type)).toContain('move');
    });
  });

  describe('Transform Factory', () => {
    it('should create valid transforms', () => {
      const transform = transformFactory.createTransform('move', {
        from: { x: 0, y: 0 },
        to: { x: 100, y: 100 }
      });
      
      expect(transform).toBeDefined();
      expect(transform.type).toBe('move');
      expect(transform.properties.from).toEqual({ x: 0, y: 0 });
      expect(transform.properties.to).toEqual({ x: 100, y: 100 });
    });

    it('should create scene transforms', () => {
      const sceneTransform = transformFactory.createSceneTransform({
        id: 'test',
        type: 'move',
        startTime: 0,
        duration: 2,
        easing: 'easeInOut',
        properties: {
          from: { x: 0, y: 0 },
          to: { x: 100, y: 100 }
        }
      }, 'object1', 0);
      
      expect(sceneTransform).toBeDefined();
      expect(sceneTransform.objectId).toBe('object1');
      expect(sceneTransform.startTime).toBe(0);
    });

    it('should validate transforms correctly', () => {
      const validTransform = {
        from: { x: 0, y: 0 },
        to: { x: 100, y: 100 }
      };
      
      const validation = transformFactory.validateTransform('move', validTransform);
      expect(validation).toBe(true);
    });

    it('should reject invalid transforms', () => {
      const invalidTransform = {
        from: 'invalid',
        to: { x: 100, y: 100 }
      };
      
      const validation = transformFactory.validateTransform('move', invalidTransform);
      expect(validation).toBe(false);
    });

    it('should get default properties', () => {
      const defaults = transformFactory.getDefaultProperties('move');
      expect(defaults).toBeDefined();
      expect(defaults?.from).toBeDefined();
      expect(defaults?.to).toBeDefined();
    });

    it('should get property definitions', () => {
      const propDefs = transformFactory.getPropertyDefinitions('move');
      expect(propDefs).toBeDefined();
      expect(propDefs).toHaveLength(2);
    });

    it('should check easing support', () => {
      expect(transformFactory.supportsEasing('move')).toBe(true);
      expect(transformFactory.supportsEasing('fade')).toBe(true);
    });

    it('should get default easing', () => {
      const defaultEasing = transformFactory.getDefaultEasing('move');
      expect(defaultEasing).toBe('easeInOut');
    });

    it('should get property interpolator', () => {
      const interpolator = transformFactory.getPropertyInterpolator('point2d');
      expect(interpolator).toBeDefined();
    });

    it('should check if values can be interpolated', () => {
      expect(transformFactory.canInterpolateValue({ x: 0, y: 0 })).toBe(true);
      expect(transformFactory.canInterpolateValue(100)).toBe(true);
    });

    it('should get interpolatable property types', () => {
      const types = transformFactory.getInterpolatablePropertyTypes();
      expect(types).toContain('number');
      expect(types).toContain('point2d');
      expect(types).toContain('color');
    });
  });

  describe('Transform Evaluator', () => {
    it('should evaluate transforms at given time', () => {
      const transform = transformFactory.createSceneTransform({
        id: 'test',
        type: 'move',
        startTime: 0,
        duration: 2,
        easing: 'linear',
        properties: {
          from: { x: 0, y: 0 },
          to: { x: 100, y: 100 }
        }
      }, 'object1', 0);
      
      const result = transformEvaluator.evaluateTransform(transform, 1);
      expect(result).toEqual({ x: 50, y: 50 });
    });

    it('should handle different easing functions', () => {
      const transform = transformFactory.createSceneTransform({
        id: 'test',
        type: 'move',
        startTime: 0,
        duration: 2,
        easing: 'easeInOut',
        properties: {
          from: { x: 0, y: 0 },
          to: { x: 100, y: 100 }
        }
      }, 'object1', 0);
      
      const result = transformEvaluator.evaluateTransform(transform, 1);
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should get end values correctly', () => {
      const transform = transformFactory.createSceneTransform({
        id: 'test',
        type: 'move',
        startTime: 0,
        duration: 2,
        easing: 'linear',
        properties: {
          from: { x: 0, y: 0 },
          to: { x: 100, y: 100 }
        }
      }, 'object1', 0);
      
      const endValue = transformEvaluator.getEndValue(transform);
      expect(endValue).toEqual({ x: 100, y: 100 });
    });
  });

  describe('Interpolator Registry', () => {
    it('should have interpolators for all property types', () => {
      const types = getSupportedPropertyTypes();
      expect(types).toContain('number');
      expect(types).toContain('point2d');
      expect(types).toContain('color');
      expect(types).toContain('string');
      expect(types).toContain('boolean');
    });

    it('should interpolate numbers correctly', () => {
      const interpolator = getInterpolator('number');
      const result = interpolator.interpolate(0, 100, 0.5);
      expect(result).toBe(50);
    });

    it('should interpolate 2D points correctly', () => {
      const interpolator = getInterpolator('point2d');
      const result = interpolator.interpolate({ x: 0, y: 0 }, { x: 100, y: 50 }, 0.5);
      expect(result).toEqual({ x: 50, y: 25 });
    });

    it('should interpolate colors correctly', () => {
      const interpolator = getInterpolator('color');
      const result = interpolator.interpolate('#ff0000', '#0000ff', 0.5);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should check if values can be interpolated', () => {
      expect(canInterpolate(0)).toBe(true);
      expect(canInterpolate({ x: 0, y: 0 })).toBe(true);
      expect(canInterpolate('start')).toBe(true);
    });
  });

  describe('Integration', () => {
    it('should create and evaluate a complete animation', () => {
      // Create transform
      const transform = transformFactory.createTransform('move', {
        from: { x: 0, y: 0 },
        to: { x: 100, y: 100 }
      });
      
      // Create scene transform
      const sceneTransform = transformFactory.createSceneTransform(transform, 'object1', 0);
      
      // Evaluate at different times
      const startValue = transformEvaluator.evaluateTransform(sceneTransform, 0);
      const midValue = transformEvaluator.evaluateTransform(sceneTransform, 1);
      const endValue = transformEvaluator.evaluateTransform(sceneTransform, 2);
      
      expect(startValue).toEqual({ x: 0, y: 0 });
      expect(midValue).toEqual({ x: 50, y: 50 });
      expect(endValue).toEqual({ x: 100, y: 100 });
    });

    it('should handle all transform types', () => {
      const types = getAllTransformTypes();
      
      for (const type of types) {
        const defaults = getDefaultProperties(type);
        expect(defaults).toBeDefined();
        
        if (defaults) {
          const transform = transformFactory.createTransform(type, defaults);
          expect(transform.type).toBe(type);
        }
      }
    });
  });
});