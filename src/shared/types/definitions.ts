// src/shared/types/definitions.ts
import type { NodePortConfig } from './ports';
import type { NodePropertyConfig } from './properties';

export interface NodeDefinition {
  type: string;
  label: string;
  description: string;
  category: 'geometry' | 'timing' | 'animation' | 'logic' | 'output';
  ports: NodePortConfig;
  properties: NodePropertyConfig;
}

// Video presets and options
export const VIDEO_PRESETS = [
  { value: "ultrafast", label: "Ultrafast (Low quality, fast render)" },
  { value: "fast", label: "Fast" },
  { value: "medium", label: "Medium (Balanced)" },
  { value: "slow", label: "Slow (High quality, slow render)" },
  { value: "veryslow", label: "Very Slow (Best quality)" },
] as const;

export const FPS_OPTIONS = [
  { value: 24, label: "24 FPS (Cinema)" },
  { value: 30, label: "30 FPS (Standard)" },
  { value: 60, label: "60 FPS (Smooth)" },
  { value: 120, label: "120 FPS (Ultra Smooth)" },
] as const;

// Geometry Node Definitions
const triangleDefinition: NodeDefinition = {
  type: 'triangle',
  label: 'Triangle',
  description: 'Triangular geometry object',
  category: 'geometry',
  ports: {
    inputs: [],
    outputs: [
      { id: 'object', type: 'object', label: 'Triangle Object' },
      { id: 'stream', type: 'object_stream', label: 'Object Stream' }
    ]
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
    outputs: [
      { id: 'object', type: 'object', label: 'Circle Object' },
      { id: 'stream', type: 'object_stream', label: 'Object Stream' }
    ]
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
    outputs: [
      { id: 'object', type: 'object', label: 'Rectangle Object' },
      { id: 'stream', type: 'object_stream', label: 'Object Stream' }
    ]
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

const insertDefinition: NodeDefinition = {
  type: 'insert',
  label: 'Insert',
  description: 'Controls when an object appears in the timeline',
  category: 'timing',
  ports: {
    inputs: [
      { id: 'object', type: 'object', label: 'Object' },
      { id: 'object_stream', type: 'object_stream', label: 'Object Stream' }
    ],
    outputs: [
      { id: 'timed_object', type: 'timed_object', label: 'Timed Object' },
      { id: 'stream', type: 'object_stream', label: 'Object Stream' }
    ]
  },
  properties: {
    properties: [
      { key: 'appearanceTime', type: 'number', label: 'Appearance Time (seconds)', min: 0, step: 0.1, defaultValue: 0 }
    ]
  }
};

const filterDefinition: NodeDefinition = {
  type: 'filter',
  label: 'Filter Objects',
  description: 'Filters objects from any data stream based on selection criteria',
  category: 'logic',
  ports: {
    inputs: [
      { id: 'input', type: 'object_stream', label: 'Input Stream' }
    ],
    outputs: [
      { id: 'output', type: 'object_stream', label: 'Filtered Stream' }
    ]
  },
  properties: {
    properties: [
      // selectedObjectIds will be managed by the UI, not directly editable as a simple property
    ]
  }
};

const animationDefinition: NodeDefinition = {
  type: 'animation',
  label: 'Animation',
  description: 'Timeline-based animation container',
  category: 'animation',
  ports: {
    inputs: [
      { id: 'timed_object', type: 'timed_object', label: 'Timed Object' },
      { id: 'object_stream', type: 'object_stream', label: 'Object Stream' }
    ],
    outputs: [{ id: 'animation', type: 'animation', label: 'Animation Output' }]
  },
  properties: {
    properties: [
      { key: 'duration', type: 'number', label: 'Duration (seconds)', min: 0.1, step: 0.1, defaultValue: 3 }
    ]
  }
};

const sceneDefinition: NodeDefinition = {
  type: 'scene',
  label: 'Scene',
  description: 'Final video output configuration',
  category: 'output',
  ports: {
    inputs: [
      { id: 'animation', type: 'animation', label: 'Animation' },
      { id: 'object_stream', type: 'object_stream', label: 'Object Stream' }
    ],
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
  insert: insertDefinition,
  filter: filterDefinition,
  animation: animationDefinition,
  scene: sceneDefinition
};

export function getNodeDefinition(nodeType: string): NodeDefinition | undefined {
  return NODE_DEFINITIONS[nodeType];
}

export function getNodesByCategory(category: NodeDefinition['category']): NodeDefinition[] {
  return Object.values(NODE_DEFINITIONS).filter(def => def.category === category);
}