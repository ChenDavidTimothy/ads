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
  category: 'geometry' | 'timing' | 'animation' | 'logic' | 'output' | 'data' | 'text' | 'image' | 'input';
  executor: 'geometry' | 'timing' | 'animation' | 'logic' | 'scene' | 'text' | 'image';
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
  metadata?: {
    supportsDynamicPorts?: boolean;
    portGenerator?: 'merge' | 'boolean' | 'math' | 'custom';
    [key: string]: unknown;
  };
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
        { key: 'size', type: 'number', label: 'Size', min: 1, defaultValue: 80 }
      ]
    },
    rendering: {
      icon: '▲',
      colors: {
        primary: 'bg-[var(--node-geometry)]',
        handle: '!bg-[var(--node-geometry)]',
      }
    },
    defaults: {
      size: 80
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
        { key: 'radius', type: 'number', label: 'Radius', min: 1, defaultValue: 50 }
      ]
    },
    rendering: {
      icon: '●',
      colors: {
        primary: 'bg-[var(--node-geometry)]',
        handle: '!bg-[var(--node-geometry)]',
      }
    },
    defaults: {
      radius: 50
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
        { key: 'height', type: 'number', label: 'Height', min: 1, defaultValue: 60 }
      ]
    },
    rendering: {
      icon: '▬',
      colors: {
        primary: 'bg-[var(--node-geometry)]',
        handle: '!bg-[var(--node-geometry)]',
      }
    },
    defaults: {
      width: 100,
      height: 60
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
        primary: 'bg-[var(--transform-fade)]',
        handle: '!bg-[var(--transform-fade)]',
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
        primary: 'bg-[var(--node-logic)]',
        handle: '!bg-[var(--node-logic)]',
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
        primary: 'bg-[var(--node-logic)]',
        handle: '!bg-[var(--node-logic)]',
      }
    },
    defaults: {
      inputPortCount: 2,
    },
    metadata: {
      supportsDynamicPorts: true,
      portGenerator: 'merge'
    }
  },

  constants: {
    type: 'constants',
    label: 'Constants',
    description: 'Outputs constant values (numbers, strings, colors, booleans)',
    execution: {
      category: 'data',
      executor: 'logic',
    },
    ports: {
      inputs: [],
      outputs: [
        { id: 'output', type: 'data', label: 'Value' }
      ]
    },
    properties: {
      properties: [
        { 
          key: 'valueType', 
          type: 'select', 
          label: 'Type',
          options: [
            { value: 'number', label: 'Number' },
            { value: 'string', label: 'String' },
            { value: 'boolean', label: 'Boolean' },
            { value: 'color', label: 'Color' }
          ],
          defaultValue: 'number'
        },
        { key: 'numberValue', type: 'number', label: 'Number Value', defaultValue: 0 },
        { key: 'stringValue', type: 'string', label: 'String Value', defaultValue: '' },
        { 
          key: 'booleanValue', 
          type: 'select', 
          label: 'Boolean Value',
          options: [
            { value: 'true', label: 'True' },
            { value: 'false', label: 'False' }
          ],
          defaultValue: 'true'
        },
        { key: 'colorValue', type: 'color', label: 'Color Value', defaultValue: '#ffffff' }
      ]
    },
    rendering: {
      icon: '🔢',
      colors: {
        primary: 'bg-[var(--node-data)]',
        handle: '!bg-[var(--node-data)]',
      }
    },
    defaults: {
      valueType: 'number',
      numberValue: 0,
      stringValue: '',
      booleanValue: 'true',
      colorValue: '#ffffff'
    }
  },

  result: {
    type: 'result',
    label: 'Result',
    description: 'Displays final calculated result from logic operations',
    execution: {
      category: 'output',
      executor: 'logic',
    },
    ports: {
      inputs: [
        { id: 'input', type: 'data', label: 'Value' }
      ],
      outputs: [
        { id: 'output', type: 'data', label: 'Value' }
      ]
    },
    properties: {
      properties: [
        { key: 'label', type: 'string', label: 'Debug Label', defaultValue: 'Debug' }
      ]
    },
    rendering: {
      icon: '🎯',
      colors: {
        primary: 'bg-[var(--node-output)]',
        handle: '!bg-[var(--node-output)]',
      }
    },
    defaults: {
      label: 'Debug'
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
        primary: 'bg-[var(--node-animation)]',
        handle: '!bg-[var(--node-animation)]',
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
        primary: 'bg-[var(--node-output)]',
        handle: '!bg-[var(--node-output)]',
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
  },

  canvas: {
    type: 'canvas',
    label: 'Canvas',
    description: 'Static styling for image export (no tracks)',
    execution: {
      category: 'animation',
      executor: 'animation',
    },
    ports: {
      inputs: [
        { id: 'input', type: 'object_stream', label: 'Objects' }
      ],
      outputs: [
        { id: 'output', type: 'object_stream', label: 'Styled Objects' }
      ]
    },
    properties: {
      properties: [
        { key: 'position', type: 'point2d', label: 'Position', defaultValue: { x: 0, y: 0 } },
        { key: 'rotation', type: 'number', label: 'Rotation (radians)', defaultValue: 0 },
        { key: 'scale', type: 'point2d', label: 'Scale', defaultValue: { x: 1, y: 1 } },
        { key: 'opacity', type: 'number', label: 'Opacity', min: 0, max: 1, step: 0.05, defaultValue: 1 },
        { key: 'fillColor', type: 'color', label: 'Fill Color', defaultValue: '#ffffff' },
        { key: 'strokeColor', type: 'color', label: 'Stroke Color', defaultValue: '#000000' },
        { key: 'strokeWidth', type: 'number', label: 'Stroke Width', min: 0, step: 1, defaultValue: 2 }
      ]
    },
    rendering: {
      icon: '🖼️',
      colors: {
        primary: 'bg-[var(--node-animation)]',
        handle: '!bg-[var(--node-animation)]',
      }
    },
    defaults: {
      position: { x: 960, y: 540 }, // Center of 1920x1080
      rotation: 0,
      scale: { x: 1, y: 1 },
      opacity: 1,
      fillColor: '#4444ff', // Good default blue
      strokeColor: '#ffffff', // White stroke
      strokeWidth: 2, // Reasonable default
    }
  },

  frame: {
    type: 'frame',
    label: 'Frame',
    description: 'Final image output configuration',
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
        { key: 'backgroundColor', type: 'color', label: 'Background Color', defaultValue: '#000000' },
        { 
          key: 'format', 
          type: 'select', 
          label: 'Image Format', 
          options: [
            { value: 'png', label: 'PNG' },
            { value: 'jpeg', label: 'JPEG' }
          ],
          defaultValue: 'png'
        },
        { key: 'quality', type: 'range', label: 'JPEG Quality', min: 1, max: 100, defaultValue: 90 }
      ]
    },
    rendering: {
      icon: '🖨️',
      colors: {
        primary: 'bg-[var(--node-output)]',
        handle: '!bg-[var(--node-output)]',
      }
    },
    defaults: {
      width: 1920,
      height: 1080,
      backgroundColor: '#000000',
      format: 'png',
      quality: 90,
        }
  },
 
  compare: {
    type: 'compare',
    label: 'Compare',
    description: 'Compares two values with runtime type validation',
    execution: {
      category: 'logic',
      executor: 'logic',
    },
    ports: {
      inputs: [
        { id: 'input_a', type: 'data', label: 'A' },
        { id: 'input_b', type: 'data', label: 'B' }
      ],
      outputs: [
        { id: 'output', type: 'data', label: 'Result' }
      ]
    },
    properties: {
      properties: [
        { 
          key: 'operator', 
          type: 'select', 
          label: 'Operator',
          options: [
            { value: 'gt', label: 'Greater than (>)' },
            { value: 'lt', label: 'Less than (<)' },
            { value: 'eq', label: 'Equal (==)' },
            { value: 'neq', label: 'Not equal (!=)' },
            { value: 'gte', label: 'Greater or equal (>=)' },
            { value: 'lte', label: 'Less or equal (<=)' }
          ],
          defaultValue: 'gt'
        }
      ]
    },
    rendering: {
      icon: '≷',
      colors: {
        primary: 'bg-[var(--node-logic)]',
        handle: '!bg-[var(--node-logic)]',
      }
    },
    defaults: {
      operator: 'gt'
    }
  },

  if_else: {
    type: 'if_else',
    label: 'If/Else',
    description: 'Routes data to different paths based on boolean condition',
    execution: {
      category: 'logic',
      executor: 'logic',
    },
    ports: {
      inputs: [
        { id: 'condition', type: 'boolean', label: 'Condition', required: true },
        { id: 'data', type: 'data', label: 'Data', required: true }
      ],
      outputs: [
        { id: 'true_path', type: 'data', label: 'True' },
        { id: 'false_path', type: 'data', label: 'False' }
      ]
    },
    properties: {
      properties: []
    },
    rendering: {
      icon: '🔀',
      colors: {
        primary: 'bg-[var(--node-logic)]',
        handle: '!bg-[var(--node-logic)]',
      }
    },
    defaults: {}
  },

  boolean_op: {
    type: 'boolean_op',
    label: 'Boolean Operation',
    description: 'Boolean logic operations (AND, OR, NOT, XOR)',
    execution: {
      category: 'logic',
      executor: 'logic',
    },
    ports: {
      inputs: [
        { id: 'input1', type: 'data', label: 'A' },
        { id: 'input2', type: 'data', label: 'B' }
      ],
      outputs: [
        { id: 'output', type: 'data', label: 'Result' }
      ]
    },
    properties: {
      properties: [
        { 
          key: 'operator', 
          type: 'select',
          label: 'Operation',
          options: [
            { value: 'and', label: 'AND' },
            { value: 'or', label: 'OR' },
            { value: 'not', label: 'NOT' },
            { value: 'xor', label: 'XOR' }
          ],
          defaultValue: 'and'
        }
      ]
    },
    rendering: {
      icon: '⊙',
      colors: {
        primary: 'bg-[var(--node-logic)]',
        handle: '!bg-[var(--node-logic)]',
      }
    },
    defaults: {
      operator: 'and'
    },
    metadata: {
      supportsDynamicPorts: true,
      portGenerator: 'boolean'
    }
  },

  math_op: {
    type: 'math_op',
    label: 'Math Operation',
    description: 'Mathematical operations (+, -, ×, ÷, %, ^, √, abs, min, max)',
    execution: {
      category: 'logic',
      executor: 'logic',
    },
    ports: {
      inputs: [
        { id: 'input_a', type: 'data', label: 'A' },
        { id: 'input_b', type: 'data', label: 'B' }
      ],
      outputs: [
        { id: 'output', type: 'data', label: 'Result' }
      ]
    },
    properties: {
      properties: [
        { 
          key: 'operator', 
          type: 'select',
          label: 'Operation',
          options: [
            { value: 'add', label: 'Add (+)' },
            { value: 'subtract', label: 'Subtract (-)' },
            { value: 'multiply', label: 'Multiply (×)' },
            { value: 'divide', label: 'Divide (÷)' },
            { value: 'modulo', label: 'Modulo (%)' },
            { value: 'power', label: 'Power (^)' },
            { value: 'sqrt', label: 'Square Root (√)' },
            { value: 'abs', label: 'Absolute (|x|)' },
            { value: 'min', label: 'Minimum' },
            { value: 'max', label: 'Maximum' }
          ],
          defaultValue: 'add'
        }
      ]
    },
    rendering: {
      icon: '🧮',
      colors: {
        primary: 'bg-[var(--node-logic)]',
        handle: '!bg-[var(--node-logic)]',
      }
    },
    defaults: {
      operator: 'add'
    },
    metadata: {
      supportsDynamicPorts: true,
      portGenerator: 'math'
    }
  },

  duplicate: {
    type: 'duplicate',
    label: 'Duplicate',
    description: 'Creates multiple copies of objects with unique IDs while preserving all properties and metadata. Works with any node type.',
    execution: {
      category: 'logic',
      executor: 'logic',
    },
    ports: {
      inputs: [
        { id: 'input', type: 'object_stream', label: 'Objects' }
      ],
      outputs: [
        { id: 'output', type: 'object_stream', label: 'Duplicated' }
      ]
    },
    properties: {
      properties: [
        { 
          key: 'count', 
          type: 'number', 
          label: 'Total Count', 
          min: 1, 
          max: 50, 
          defaultValue: 3,
          description: 'Total number of objects (including original)'
        }
      ]
    },
    rendering: {
      icon: '⚌',
      colors: {
        primary: 'bg-[var(--node-logic)]',
        handle: '!bg-[var(--node-logic)]',
      }
    },
    defaults: {
      count: 3
    }
  },

          image: {
          type: 'image',
          label: 'Image',
          description: 'Basic image object for media processing',
          execution: {
            category: 'image',
            executor: 'image',
          },
    ports: {
      inputs: [],
      outputs: [
        { id: 'output', type: 'object_stream', label: 'Image Object' }
      ]
    },
              properties: {
            properties: []
          },
    rendering: {
      icon: '🖼️',
      colors: {
        primary: 'bg-[var(--node-input)]',
        handle: '!bg-[var(--node-input)]',
      }
    },
    defaults: {}
  },

  text: {
    type: 'text',
    label: 'Text',
    description: 'Text content object for dynamic text display',
    execution: {
      category: 'text',
      executor: 'text',
    },
    ports: {
      inputs: [],
      outputs: [
        { id: 'output', type: 'object_stream', label: 'Text Object' }
      ]
    },
    properties: {
      properties: [
        { 
          key: 'content', 
          type: 'string', 
          label: 'Content', 
          defaultValue: 'Hello World'
        },
        { 
          key: 'fontSize', 
          type: 'number', 
          label: 'Font Size (px)', 
          min: 8, 
          max: 200, 
          step: 1,
          defaultValue: 24
        }
      ]
    },
    rendering: {
      icon: 'T',
      colors: {
        primary: 'bg-[var(--node-text)]',
        handle: '!bg-[var(--node-text)]',
      }
    },
    defaults: {
      content: 'Hello World',
      fontSize: 24
    }
  },

  typography: {
    // Keep all existing metadata unchanged
    type: 'typography',
    label: 'Typography',
    description: 'Typography styling for text objects',
    execution: {
      category: 'animation',
      executor: 'animation',
    },
    ports: {
      inputs: [
        { id: 'input', type: 'object_stream', label: 'Text Objects' }
      ],
      outputs: [
        { id: 'output', type: 'object_stream', label: 'Styled Text Objects' }
      ]
    },
    properties: {
      properties: [
        // ADD Content as FIRST property
        { 
          key: 'content', 
          type: 'textarea', 
          label: 'Content', 
          rows: 4,
          defaultValue: 'Sample Text'
        },
        // Typography Core
        { 
          key: 'fontFamily', 
          type: 'select', 
          label: 'Font Family',
          options: [
            { value: 'Arial', label: 'Arial' },
            { value: 'Helvetica', label: 'Helvetica' },
            { value: 'Times New Roman', label: 'Times New Roman' },
            { value: 'Courier New', label: 'Courier New' },
            { value: 'Georgia', label: 'Georgia' },
            { value: 'Verdana', label: 'Verdana' }
          ],
          defaultValue: 'Arial'
        },
        { 
          key: 'fontSize', 
          type: 'number', 
          label: 'Font Size (px)', 
          min: 8, 
          max: 200, 
          step: 1,
          defaultValue: 24
        },
        { 
          key: 'fontWeight', 
          type: 'select', 
          label: 'Font Weight',
          options: [
            { value: 'normal', label: 'Normal (400)' },
            { value: 'bold', label: 'Bold (700)' },
            { value: '100', label: 'Thin (100)' },
            { value: '300', label: 'Light (300)' },
            { value: '500', label: 'Medium (500)' },
            { value: '600', label: 'Semi Bold (600)' },
            { value: '800', label: 'Extra Bold (800)' },
            { value: '900', label: 'Black (900)' }
          ],
          defaultValue: 'normal'
        },
        { 
          key: 'fontStyle', 
          type: 'select', 
          label: 'Font Style',
          options: [
            { value: 'normal', label: 'Normal' },
            { value: 'italic', label: 'Italic' },
            { value: 'oblique', label: 'Oblique' }
          ],
          defaultValue: 'normal'
        },
        
        // Text Colors
        { 
          key: 'fillColor', 
          type: 'color', 
          label: 'Fill Color', 
          defaultValue: '#000000'
        },
        { 
          key: 'strokeColor', 
          type: 'color', 
          label: 'Stroke Color', 
          defaultValue: '#ffffff'
        },
        { 
          key: 'strokeWidth', 
          type: 'number', 
          label: 'Stroke Width', 
          min: 0, 
          max: 10, 
          step: 0.5, 
          defaultValue: 0
        }
      ]
    },
    rendering: {
      icon: 'Aa',
      colors: {
        primary: 'bg-[var(--node-animation)]',
        handle: '!bg-[var(--node-animation)]',
      }
    },
    defaults: {
      content: 'Sample Text',  // ADD this line
      fontFamily: 'Arial',
      fontSize: 24,
      fontWeight: 'normal',
      fontStyle: 'normal',
      fillColor: '#000000',
      strokeColor: '#ffffff',
      strokeWidth: 0
    },
    metadata: {
      supportsVariableBinding: true,
      supportsPerObjectAssignments: true,
      requiresTextObjects: true
    }
  },

  media: {
    type: 'media',
    label: 'Media',
    description: 'Media processing for image objects',
    execution: {
      category: 'animation',
      executor: 'animation',
    },
    ports: {
      inputs: [
        { id: 'input', type: 'object_stream', label: 'Image Objects' }
      ],
      outputs: [
        { id: 'output', type: 'object_stream', label: 'Processed Media Objects' }
      ]
    },
    properties: {
      properties: [
        // Content Section
        { 
          key: 'imageAssetId', 
          type: 'string', 
          label: 'Image Asset', 
          defaultValue: '',
          description: 'Selected image from asset library'
        },
        
        // Crop Section
        { 
          key: 'cropX', 
          type: 'number', 
          label: 'Crop X Offset', 
          min: 0, 
          defaultValue: 0,
          description: 'Horizontal crop offset in pixels'
        },
        { 
          key: 'cropY', 
          type: 'number', 
          label: 'Crop Y Offset', 
          min: 0, 
          defaultValue: 0,
          description: 'Vertical crop offset in pixels'
        },
        { 
          key: 'cropWidth', 
          type: 'number', 
          label: 'Crop Width', 
          min: 0, 
          defaultValue: 0,
          description: 'Crop width (0 = use original)'
        },
        { 
          key: 'cropHeight', 
          type: 'number', 
          label: 'Crop Height', 
          min: 0, 
          defaultValue: 0,
          description: 'Crop height (0 = use original)'
        },
        
        // Display Section
        { 
          key: 'displayWidth', 
          type: 'number', 
          label: 'Display Width', 
          min: 0, 
          defaultValue: 0,
          description: 'Final display width (0 = use crop size)'
        },
        { 
          key: 'displayHeight', 
          type: 'number', 
          label: 'Display Height', 
          min: 0, 
          defaultValue: 0,
          description: 'Final display height (0 = use crop size)'
        }
      ]
    },
    rendering: {
      icon: '🎬',
      colors: {
        primary: 'bg-[var(--node-animation)]',
        handle: '!bg-[var(--node-animation)]',
      }
    },
    defaults: {
      imageAssetId: '',
      cropX: 0,
      cropY: 0,
      cropWidth: 0,
      cropHeight: 0,
      displayWidth: 0,
      displayHeight: 0
    },
    metadata: {
      supportsVariableBinding: true,
      supportsPerObjectAssignments: true,
      requiresImageObjects: true
    }
  }
} as const;

// Canonical node type derived from registry
export type NodeType = keyof typeof NODE_DEFINITIONS;