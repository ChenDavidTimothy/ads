// src/lib/types/node-definitions.ts
import type { NodePortConfig } from "./ports";
import type { NodePropertyConfig, PropertySchema } from "./property-schemas";
import { VIDEO_PRESETS, FPS_OPTIONS } from "@/lib/constants/editor";

export interface NodeDefinition {
  type: string;
  label: string;
  description: string;
  category: 'geometry' | 'animation' | 'logic' | 'output';
  ports: NodePortConfig;
  properties: NodePropertyConfig;
}

// Geometry Node Definitions
const triangleDefinition: NodeDefinition = {
  type: 'triangle',
  label: 'Triangle',
  description: 'Triangular geometry object',
  category: 'geometry',
  ports: {
    inputs: [],
    outputs: [{ id: 'object', type: 'object', label: 'Triangle Object' }]
  },
  properties: {
    properties: [
      { key: 'size', type: 'number', label: 'Size', min: 1, defaultValue: 80 },
      { key: 'color', type: 'color', label: 'Color', defaultValue: '#ff4444' },
      { key: 'strokeColor', type: 'color', label: 'Stroke Color', defaultValue: '#ffffff' },
      { key: 'strokeWidth', type: 'number', label: 'Stroke Width', min: 0, defaultValue: 3 },
      { key: 'position', type: 'point2d', label: 'Position', defaultValue: { x: 960, y: 540 } }
    ]
  }
};

const circleDefinition: NodeDefinition = {
  type: 'circle',
  label: 'Circle',
  description: 'Circular geometry object',
  category: 'geometry',
  ports: {
    inputs: [],
    outputs: [{ id: 'object', type: 'object', label: 'Circle Object' }]
  },
  properties: {
    properties: [
      { key: 'radius', type: 'number', label: 'Radius', min: 1, defaultValue: 50 },
      { key: 'color', type: 'color', label: 'Color', defaultValue: '#4444ff' },
      { key: 'strokeColor', type: 'color', label: 'Stroke Color', defaultValue: '#ffffff' },
      { key: 'strokeWidth', type: 'number', label: 'Stroke Width', min: 0, defaultValue: 2 },
      { key: 'position', type: 'point2d', label: 'Position', defaultValue: { x: 960, y: 540 } }
    ]
  }
};

const rectangleDefinition: NodeDefinition = {
  type: 'rectangle',
  label: 'Rectangle',
  description: 'Rectangular geometry object',
  category: 'geometry',
  ports: {
    inputs: [],
    outputs: [{ id: 'object', type: 'object', label: 'Rectangle Object' }]
  },
  properties: {
    properties: [
      { key: 'width', type: 'number', label: 'Width', min: 1, defaultValue: 100 },
      { key: 'height', type: 'number', label: 'Height', min: 1, defaultValue: 60 },
      { key: 'color', type: 'color', label: 'Color', defaultValue: '#44ff44' },
      { key: 'strokeColor', type: 'color', label: 'Stroke Color', defaultValue: '#ffffff' },
      { key: 'strokeWidth', type: 'number', label: 'Stroke Width', min: 0, defaultValue: 2 },
      { key: 'position', type: 'point2d', label: 'Position', defaultValue: { x: 960, y: 540 } }
    ]
  }
};

// Animation Node Definition
const animationDefinition: NodeDefinition = {
  type: 'animation',
  label: 'Animation',
  description: 'Timeline-based animation container',
  category: 'animation',
  ports: {
    inputs: [{ id: 'input', type: 'object', label: 'Input' }], // Single smart port
    outputs: [{ id: 'animation', type: 'animation', label: 'Animation Output' }]
  },
  properties: {
    properties: [
      { key: 'duration', type: 'number', label: 'Duration (seconds)', min: 0.1, step: 0.1, defaultValue: 3 }
      // tracks property handled separately as it's complex
    ]
  }
};

// Scene Node Definition  
const sceneDefinition: NodeDefinition = {
  type: 'scene',
  label: 'Scene',
  description: 'Final video output configuration',
  category: 'output',
  ports: {
    inputs: [{ id: 'animations', type: 'animation', label: 'Animations' }],
    outputs: []
  },
  properties: {
    properties: [
      { key: 'width', type: 'number', label: 'Width', min: 1, defaultValue: 1920 },
      { key: 'height', type: 'number', label: 'Height', min: 1, defaultValue: 1080 },
      { 
        key: 'fps', 
        type: 'select', 
        label: 'Frame Rate (FPS)', 
        options: FPS_OPTIONS.map(opt => ({ value: opt.value.toString(), label: opt.label })),
        defaultValue: '60'
      },
      { key: 'duration', type: 'number', label: 'Duration (seconds)', min: 0.1, step: 0.1, defaultValue: 4 },
      { key: 'backgroundColor', type: 'color', label: 'Background Color', defaultValue: '#1a1a2e' },
      { 
        key: 'videoPreset', 
        type: 'select', 
        label: 'Encoding Speed',
        options: VIDEO_PRESETS.map(preset => ({ value: preset.value, label: preset.label })),
        defaultValue: 'medium'
      },
      { key: 'videoCrf', type: 'range', label: 'Quality Level', min: 0, max: 51, defaultValue: 18 }
    ]
  }
};

// Node Registry
export const NODE_DEFINITIONS: Record<string, NodeDefinition> = {
  triangle: triangleDefinition,
  circle: circleDefinition,
  rectangle: rectangleDefinition,
  animation: animationDefinition,
  scene: sceneDefinition
};

export function getNodeDefinition(nodeType: string): NodeDefinition | undefined {
  return NODE_DEFINITIONS[nodeType];
}

export function getNodesByCategory(category: NodeDefinition['category']): NodeDefinition[] {
  return Object.values(NODE_DEFINITIONS).filter(def => def.category === category);
}