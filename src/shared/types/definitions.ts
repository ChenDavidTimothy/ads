// src/shared/types/definitions.ts - Complete registry-driven node system
import type { NodePortConfig } from './ports';
import type { NodePropertyConfig } from './properties';

// Rendering metadata for UI generation
export interface NodeRenderConfig {
  icon: string;
  colors: {
    primary: string;
    handle: string;
  };
}

// Execution metadata for backend processing
export interface NodeExecutionConfig {
  category: 'geometry' | 'timing' | 'animation' | 'logic' | 'output';
  executor: 'geometry' | 'timing' | 'animation' | 'logic' | 'scene';
  executionPriority?: number; // For future conditional execution
}

// Complete node definition with all metadata
export interface NodeDefinition {
  type: string;
  label: string;
  description: string;
  execution: NodeExecutionConfig;
  ports: NodePortConfig;
  properties: NodePropertyConfig;
  rendering: NodeRenderConfig;
  defaults: Record<string, unknown>;
  version?: string; // optional semantic version for migrations
  migrate?: (data: Record<string, unknown>) => Record<string, unknown>; // optional migration hook
}

// Video and FPS options (existing)
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

// Complete node definitions with all metadata
export const NODE_DEFINITIONS = {
  triangle: {
    type: 'triangle',
    label: 'Triangle',
    description: 'Triangular geometry object',
    execution: {
      category: 'geometry',
      executor: 'geometry',
    },
    ports: {
      inputs: [],
      outputs: [
        { id: 'output', type: 'object_stream', label: 'Triangle' }
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
    },
    rendering: {
      icon: '▲',
      colors: {
        primary: 'bg-red-600',
        handle: '!bg-red-500',
      }
    },
    defaults: {
      size: 80,
      color: "#ff4444",
      strokeColor: "#ffffff",
      strokeWidth: 3,
      position: { x: 960, y: 540 },
    }
  },

  circle: {
    type: 'circle',
    label: 'Circle',
    description: 'Circular geometry object',
    execution: {
      category: 'geometry',
      executor: 'geometry',
    },
    ports: {
      inputs: [],
      outputs: [
        { id: 'output', type: 'object_stream', label: 'Circle' }
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
    },
    rendering: {
      icon: '●',
      colors: {
        primary: 'bg-blue-600',
        handle: '!bg-blue-500',
      }
    },
    defaults: {
      radius: 50,
      color: "#4444ff",
      strokeColor: "#ffffff", 
      strokeWidth: 2,
      position: { x: 960, y: 540 },
    }
  },

  rectangle: {
    type: 'rectangle',
    label: 'Rectangle',
    description: 'Rectangular geometry object',
    execution: {
      category: 'geometry',
      executor: 'geometry',
    },
    ports: {
      inputs: [],
      outputs: [
        { id: 'output', type: 'object_stream', label: 'Rectangle' }
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
    },
    rendering: {
      icon: '▬',
      colors: {
        primary: 'bg-green-600',
        handle: '!bg-green-500',
      }
    },
    defaults: {
      width: 100,
      height: 60,
      color: "#44ff44",
      strokeColor: "#ffffff",
      strokeWidth: 2,
      position: { x: 960, y: 540 },
    }
  },

  insert: {
    type: 'insert',
    label: 'Insert',
    description: 'Controls when an object appears in the timeline',
    execution: {
      category: 'timing',
      executor: 'timing',
    },
    ports: {
      inputs: [
        { id: 'input', type: 'object_stream', label: 'Object' }
      ],
      outputs: [
        { id: 'output', type: 'object_stream', label: 'Timed Object' }
      ]
    },
    properties: {
      properties: [
        { key: 'appearanceTime', type: 'number', label: 'Appearance Time (seconds)', min: 0, step: 0.1, defaultValue: 0 }
      ]
    },
    rendering: {
      icon: '⏰',
      colors: {
        primary: 'bg-orange-600',
        handle: '!bg-orange-500',
      }
    },
    defaults: {
      appearanceTime: 0,
    }
  },

  filter: {
    type: 'filter',
    label: 'Filter Objects',
    description: 'Filters objects from any data stream based on selection criteria',
    execution: {
      category: 'logic',
      executor: 'logic',
    },
    ports: {
      inputs: [
        { id: 'input', type: 'object_stream', label: 'Input Stream' }
      ],
      outputs: [
        { id: 'output', type: 'object_stream', label: 'Filtered Stream' }
      ]
    },
    properties: {
      properties: []
    },
    rendering: {
      icon: '⏷',
      colors: {
        primary: 'bg-violet-600',
        handle: '!bg-violet-500',
      }
    },
    defaults: {
      selectedObjectIds: [],
    }
  },

  merge: {
    type: 'merge',
    label: 'Merge Objects',
    description: 'Merges objects with identical IDs using port priority resolution',
    execution: {
      category: 'logic',
      executor: 'logic',
    },
    ports: {
      inputs: [
        { id: 'input1', type: 'object_stream', label: 'Input 1 (Priority)' },
        { id: 'input2', type: 'object_stream', label: 'Input 2' },
      ],
      outputs: [
        { id: 'output', type: 'object_stream', label: 'Merged Stream' }
      ]
    },
    properties: {
      properties: [
        { 
          key: 'inputPortCount', 
          type: 'select', 
          label: 'Input Ports',
          options: [
            { value: '2', label: '2 Ports' },
            { value: '3', label: '3 Ports' },
            { value: '4', label: '4 Ports' },
            { value: '5', label: '5 Ports' }
          ],
          defaultValue: '2'
        }
      ]
    },
    rendering: {
      icon: '⊕',
      colors: {
        primary: 'bg-teal-600',
        handle: '!bg-teal-500',
      }
    },
    defaults: {
      inputPortCount: 2,
    }
  },

  animation: {
    type: 'animation',
    label: 'Animation',
    description: 'Timeline-based animation container',
    execution: {
      category: 'animation',
      executor: 'animation',
    },
    ports: {
      inputs: [
        { id: 'input', type: 'object_stream', label: 'Objects' }
      ],
      outputs: [
        { id: 'output', type: 'object_stream', label: 'Animation' }
      ]
    },
    properties: {
      properties: [
        { key: 'duration', type: 'number', label: 'Duration (seconds)', min: 0.1, step: 0.1, defaultValue: 3 }
      ]
    },
    rendering: {
      icon: '🎬',
      colors: {
        primary: 'bg-purple-600',
        handle: '!bg-purple-500',
      }
    },
    defaults: {
      duration: 3,
      tracks: [],
    }
  },

  scene: {
    type: 'scene',
    label: 'Scene',
    description: 'Final video output configuration',
    execution: {
      category: 'output',
      executor: 'scene',
    },
    ports: {
      inputs: [
        { id: 'input', type: 'object_stream', label: 'Input' }
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
    },
    rendering: {
      icon: '🎭',
      colors: {
        primary: 'bg-gray-600',
        handle: '!bg-gray-500',
      }
    },
    defaults: {
      width: 1920,
      height: 1080,
      fps: 60,
      duration: 4,
      backgroundColor: "#1a1a2e",
      videoPreset: "medium",
      videoCrf: 18,
    }
  }
} as const;

// Canonical node type derived from registry
export type NodeType = keyof typeof NODE_DEFINITIONS;