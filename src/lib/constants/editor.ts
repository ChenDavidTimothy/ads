// src/lib/constants/editor.ts - Enhanced registry-driven constants with template support
import { 
  generateNodeColors, 
  TRACK_COLORS, 
  TRACK_ICONS, 
  RESOLUTION_PRESETS,
  getTemplateRenderConfig,
  getNodesByTemplate
} from '@/shared/registry/registry-utils';
import { VIDEO_PRESETS, FPS_OPTIONS, type NodeRenderTemplate } from '@/shared/types/definitions';

// Generate node colors dynamically from registry
export const NODE_COLORS = generateNodeColors();

// Track constants (preserved existing behavior)
export { TRACK_COLORS, TRACK_ICONS };

// Re-export from registry for backwards compatibility
export { VIDEO_PRESETS, FPS_OPTIONS, RESOLUTION_PRESETS };

// Template-specific styling configurations
export const TEMPLATE_STYLES = {
  basic: {
    minWidth: 180,
    maxWidth: 280,
    borderRadius: 'rounded-lg',
    padding: 'p-4',
    headerSpacing: 'pb-3',
    bodySpacing: 'space-y-2',
    showIcon: true,
    showSequence: true
  },
  conditional: {
    minWidth: 200,
    maxWidth: 300,
    borderRadius: 'rounded-lg',
    padding: 'p-4',
    headerSpacing: 'pb-3',
    bodySpacing: 'space-y-2',
    showIcon: true,
    showSequence: false,
    specialBorder: 'border-2 border-yellow-500'
  },
  operation: {
    minWidth: 120,
    maxWidth: 160,
    borderRadius: 'rounded-full',
    padding: 'p-3',
    headerSpacing: 'pb-1',
    bodySpacing: 'space-y-1',
    showIcon: true,
    showSequence: false,
    centerContent: true
  },
  data_source: {
    minWidth: 140,
    maxWidth: 200,
    borderRadius: 'rounded-md',
    padding: 'p-3',
    headerSpacing: 'pb-2',
    bodySpacing: 'space-y-1',
    showIcon: true,
    showSequence: false,
    compactMode: true
  },
  custom: {
    minWidth: 200,
    maxWidth: 400,
    borderRadius: 'rounded-xl',
    padding: 'p-4',
    headerSpacing: 'pb-3',
    bodySpacing: 'space-y-3',
    showIcon: false,
    showSequence: false,
    allowOverflow: true
  }
} as const;

// Port positioning configurations for templates
export const TEMPLATE_PORT_CONFIGS = {
  basic: {
    inputPosition: 'left',
    outputPosition: 'right',
    multiInputSpacing: 'evenly-spaced',
    multiOutputSpacing: 'evenly-spaced',
    portSize: 'w-3 h-3'
  },
  conditional: {
    inputPosition: 'left',
    outputPosition: 'right',
    multiInputSpacing: 'evenly-spaced',
    multiOutputSpacing: 'split', // true/false outputs
    portSize: 'w-3 h-3',
    specialPorts: {
      condition: { position: 'top', color: 'yellow' },
      true_output: { position: 'bottom-right', color: 'green' },
      false_output: { position: 'top-right', color: 'red' }
    }
  },
  operation: {
    inputPosition: 'left',
    outputPosition: 'right',
    multiInputSpacing: 'stacked', // A/B inputs stacked
    multiOutputSpacing: 'center',
    portSize: 'w-2 h-2'
  },
  data_source: {
    inputPosition: 'none', // Data sources typically have no inputs
    outputPosition: 'right',
    multiInputSpacing: 'center',
    multiOutputSpacing: 'center',
    portSize: 'w-3 h-3'
  },
  custom: {
    inputPosition: 'flexible',
    outputPosition: 'flexible',
    multiInputSpacing: 'custom',
    multiOutputSpacing: 'custom',
    portSize: 'w-3 h-3'
  }
} as const;

// Template-specific animation configurations
export const TEMPLATE_ANIMATIONS = {
  basic: {
    hoverScale: 'hover:scale-[1.02]',
    clickAnimation: 'active:scale-[0.98]',
    transitionClass: 'transition-transform duration-150',
    glowEffect: false
  },
  conditional: {
    hoverScale: 'hover:scale-105',
    clickAnimation: 'active:scale-95',
    transitionClass: 'transition-all duration-200',
    glowEffect: true,
    glowColor: 'shadow-yellow-500/50'
  },
  operation: {
    hoverScale: 'hover:scale-110',
    clickAnimation: 'active:scale-90',
    transitionClass: 'transition-all duration-100',
    glowEffect: false,
    bounceOnHover: true
  },
  data_source: {
    hoverScale: 'hover:scale-[1.05]',
    clickAnimation: 'active:scale-95',
    transitionClass: 'transition-transform duration-150',
    glowEffect: false,
    pulseOnUpdate: true
  },
  custom: {
    hoverScale: 'hover:scale-[1.01]',
    clickAnimation: 'active:scale-[0.99]',
    transitionClass: 'transition-all duration-200',
    glowEffect: true,
    customAnimations: true
  }
} as const;

// Node category colors for palette organization
export const CATEGORY_COLORS = {
  geometry: 'from-red-500 to-red-700',
  timing: 'from-orange-500 to-orange-700',
  logic: 'from-violet-500 to-violet-700',
  animation: 'from-purple-500 to-purple-700',
  output: 'from-gray-500 to-gray-700',
  data: 'from-blue-500 to-blue-700',        // Future
  control_flow: 'from-green-500 to-green-700' // Future
} as const;

// Palette section configurations
export const PALETTE_SECTIONS = [
  {
    id: 'geometry',
    title: 'Geometry',
    description: 'Basic shapes and objects',
    icon: '🔷',
    gradient: CATEGORY_COLORS.geometry,
    collapsible: false,
    order: 1
  },
  {
    id: 'timing',
    title: 'Timing',
    description: 'Timeline control',
    icon: '⏱️',
    gradient: CATEGORY_COLORS.timing,
    collapsible: false,
    order: 2
  },
  {
    id: 'logic',
    title: 'Logic',
    description: 'Filters and conditions',
    icon: '🔀',
    gradient: CATEGORY_COLORS.logic,
    collapsible: false,
    order: 3
  },
  {
    id: 'animation',
    title: 'Animation',
    description: 'Movement and effects',
    icon: '🎬',
    gradient: CATEGORY_COLORS.animation,
    collapsible: false,
    order: 4
  },
  {
    id: 'output',
    title: 'Output',
    description: 'Final rendering',
    icon: '🎭',
    gradient: CATEGORY_COLORS.output,
    collapsible: false,
    order: 5
  },
  // Future sections
  {
    id: 'data',
    title: 'Data',
    description: 'Variables and constants',
    icon: '📊',
    gradient: CATEGORY_COLORS.data,
    collapsible: true,
    order: 6,
    comingSoon: true
  },
  {
    id: 'control_flow',
    title: 'Control Flow',
    description: 'Loops and functions',
    icon: '🔄',
    gradient: CATEGORY_COLORS.control_flow,
    collapsible: true,
    order: 7,
    comingSoon: true
  }
] as const;

// Editor UI constants
export const EDITOR_CONSTANTS = {
  // Canvas
  CANVAS_BACKGROUND_COLOR: '#374151',
  CANVAS_DEFAULT_ZOOM: 1,
  CANVAS_MIN_ZOOM: 0.25,
  CANVAS_MAX_ZOOM: 2,
  
  // Grid
  GRID_SIZE: 20,
  GRID_COLOR: '#4B5563',
  SNAP_TO_GRID: false,
  
  // Minimap
  MINIMAP_NODE_COLOR: '#6366f1',
  MINIMAP_MASK_COLOR: 'rgb(240, 240, 240, 0.1)',
  
  // Node spacing
  DEFAULT_NODE_SPACING: 150,
  MIN_NODE_DISTANCE: 100,
  AUTO_LAYOUT_SPACING: 200,
  
  // Property panel
  PROPERTY_PANEL_WIDTH: 320,
  PROPERTY_PANEL_MIN_WIDTH: 280,
  PROPERTY_PANEL_MAX_WIDTH: 400,
  
  // Node palette
  PALETTE_WIDTH: 256,
  PALETTE_MIN_WIDTH: 200,
  PALETTE_MAX_WIDTH: 320,
  
  // Connection validation
  CONNECTION_SNAP_DISTANCE: 20,
  PORT_HOVER_DISTANCE: 15,
  
  // Performance
  MAX_NODES_FOR_REALTIME_VALIDATION: 50,
  DEBOUNCE_VALIDATION_MS: 300,
  AUTO_SAVE_INTERVAL_MS: 30000,
  
  // Timeline editor
  TIMELINE_WIDTH: 800,
  TIMELINE_MIN_DURATION: 0.1,
  TIMELINE_MAX_DURATION: 60,
  TIMELINE_DEFAULT_DURATION: 3,
  
  // Video generation
  DEFAULT_VIDEO_WIDTH: 1920,
  DEFAULT_VIDEO_HEIGHT: 1080,
  DEFAULT_VIDEO_FPS: 60,
  MAX_VIDEO_DURATION: 300, // 5 minutes
} as const;

// Keyboard shortcuts
export const KEYBOARD_SHORTCUTS = {
  // Node operations
  DELETE_NODE: ['Delete', 'Backspace'],
  DUPLICATE_NODE: ['Ctrl+D', 'Cmd+D'],
  SELECT_ALL: ['Ctrl+A', 'Cmd+A'],
  
  // Canvas operations
  FIT_VIEW: ['F', 'Ctrl+0', 'Cmd+0'],
  ZOOM_IN: ['Ctrl+=', 'Cmd+=', '+'],
  ZOOM_OUT: ['Ctrl+-', 'Cmd+-', '-'],
  RESET_ZOOM: ['Ctrl+0', 'Cmd+0'],
  
  // Editor operations
  SAVE_FLOW: ['Ctrl+S', 'Cmd+S'],
  UNDO: ['Ctrl+Z', 'Cmd+Z'],
  REDO: ['Ctrl+Y', 'Cmd+Y', 'Ctrl+Shift+Z', 'Cmd+Shift+Z'],
  
  // Modal operations
  CLOSE_MODAL: ['Escape'],
  CONFIRM_MODAL: ['Enter'],
  
  // Generation
  GENERATE_VIDEO: ['Ctrl+Enter', 'Cmd+Enter'],
  
  // Debug
  TOGGLE_DEBUG: ['Ctrl+Shift+D', 'Cmd+Shift+D']
} as const;

// Validation constants
export const VALIDATION_RULES = {
  // Node naming
  MIN_NODE_NAME_LENGTH: 1,
  MAX_NODE_NAME_LENGTH: 50,
  FORBIDDEN_NODE_NAMES: ['null', 'undefined', 'scene', 'output'],
  
  // Flow validation
  MAX_NODES_PER_FLOW: 100,
  MAX_CONNECTIONS_PER_NODE: 10,
  MAX_SCENE_NODES: 1,
  
  // Property validation
  MIN_DURATION: 0.1,
  MAX_DURATION: 60,
  MIN_SIZE: 1,
  MAX_SIZE: 1000,
  MIN_POSITION: -10000,
  MAX_POSITION: 10000,
  
  // Performance limits
  MAX_ANIMATION_TRACKS: 20,
  MAX_GEOMETRY_OBJECTS: 50,
  MAX_FILTER_SELECTIONS: 25
} as const;

// Error messages with template context
export const ERROR_MESSAGES = {
  // Node creation errors
  UNKNOWN_NODE_TYPE: (nodeType: string) => `Unknown node type: ${nodeType}`,
  INVALID_TEMPLATE: (template: string) => `Invalid template configuration: ${template}`,
  MISSING_REQUIRED_PROPS: (props: string[]) => `Missing required properties: ${props.join(', ')}`,
  
  // Connection errors
  INCOMPATIBLE_PORTS: (sourceType: string, targetType: string) => 
    `Cannot connect ${sourceType} output to ${targetType} input`,
  DUPLICATE_OBJECT_IDS: (ids: string[]) => 
    `Duplicate object IDs detected: ${ids.join(', ')}`,
  GEOMETRY_TO_MULTIPLE_INSERTS: 'Geometry objects can only connect to one Insert node',
  
  // Flow validation errors
  NO_SCENE_NODE: 'Scene node is required for video generation',
  MULTIPLE_SCENE_NODES: 'Only one scene node allowed per workspace',
  DISCONNECTED_OBJECTS: 'Some geometry objects are not connected to the scene',
  MISSING_INSERT_NODES: 'Geometry objects must connect through Insert nodes to appear in scene',
  
  // Template-specific errors
  CONDITIONAL_MISSING_CONDITION: 'Conditional nodes require a condition input',
  OPERATION_MISSING_INPUTS: 'Operation nodes require at least one input',
  DATA_SOURCE_INVALID_VALUE: 'Data source nodes must have a valid value or variable reference',
  
  // General errors
  EXECUTION_FAILED: (nodeName: string, error: string) => 
    `Execution failed for ${nodeName}: ${error}`,
  VALIDATION_TIMEOUT: 'Flow validation timed out - flow may be too complex'
} as const;

// Success messages
export const SUCCESS_MESSAGES = {
  VIDEO_GENERATED: 'Video generated successfully!',
  FLOW_SAVED: 'Flow saved successfully',
  NODE_CREATED: (nodeType: string) => `${nodeType} node created`,
  CONNECTION_ESTABLISHED: 'Connection established',
  TIMELINE_UPDATED: 'Timeline updated',
  PROPERTIES_SAVED: 'Properties saved'
} as const;

// Helper function to get template-specific constants
export function getTemplateConstants(template: NodeRenderTemplate) {
  return {
    styles: TEMPLATE_STYLES[template],
    ports: TEMPLATE_PORT_CONFIGS[template],
    animations: TEMPLATE_ANIMATIONS[template],
    renderConfig: getTemplateRenderConfig(template)
  };
}

// Helper function to get nodes by template for UI organization
export function getNodesByTemplateWithConstants(template: NodeRenderTemplate) {
  const nodes = getNodesByTemplate(template);
  const constants = getTemplateConstants(template);
  
  return {
    nodes,
    constants,
    count: nodes.length
  };
}