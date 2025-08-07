// src/shared/registry/registry-utils.ts - Dynamic generation from node definitions
import { NODE_DEFINITIONS, type NodeDefinition, type NodeType } from '../types/definitions';

// Generate node colors from definitions (replaces hardcoded constants)
export function generateNodeColors() {
  const colors: Record<string, { primary: string; handle: string }> = {};
  
  for (const [nodeType, definition] of Object.entries(NODE_DEFINITIONS)) {
    colors[nodeType] = definition.rendering.colors;
  }
  
  return colors;
}

// Generate track colors and icons (preserved from existing)
export const TRACK_COLORS = {
  move: "bg-purple-600",
  rotate: "bg-indigo-600", 
  scale: "bg-pink-600",
  fade: "bg-yellow-600",
  color: "bg-orange-600",
} as const;

export const TRACK_ICONS = {
  move: "→",
  rotate: "↻", 
  scale: "⚹",
  fade: "◐",
  color: "🎨",
} as const;

// Generate palette structure from definitions
export function generateNodePalette() {
  const geometryNodes = getNodesByCategory('geometry').map(def => ({
    type: def.type as NodeType,
    label: def.label,
    icon: def.rendering.icon
  }));

  const timingNodes = getNodesByCategory('timing').map(def => ({
    type: def.type as NodeType,
    label: def.label,
    icon: def.rendering.icon
  }));

  const logicNodes = getNodesByCategory('logic').map(def => ({
    type: def.type as NodeType,
    label: def.label,
    icon: def.rendering.icon
  }));

  const animationNodes = getNodesByCategory('animation').map(def => ({
    type: def.type as NodeType,
    label: def.label,
    icon: def.rendering.icon
  }));

  const utilityNodes = getNodesByCategory('output').map(def => ({
    type: def.type as NodeType,
    label: def.label,
    icon: def.rendering.icon
  }));

  return {
    geometryNodes,
    timingNodes,
    logicNodes,
    animationNodes,
    utilityNodes
  };
}

// Registry query functions
export function getNodesByCategory(category: NodeDefinition['execution']['category']): NodeDefinition[] {
  return Object.values(NODE_DEFINITIONS).filter(def => def.execution.category === category);
}

export function getNodesByExecutor(executor: NodeDefinition['execution']['executor']): NodeDefinition[] {
  return Object.values(NODE_DEFINITIONS).filter(def => def.execution.executor === executor);
}

export function getNodeDefinition(nodeType: string): NodeDefinition | undefined {
  return NODE_DEFINITIONS[nodeType as keyof typeof NODE_DEFINITIONS];
}

// Generate component mapping for future dynamic registration
export function getNodeComponentMapping(): Record<string, string> {
  const mapping: Record<string, string> = {};
  
  for (const [nodeType, definition] of Object.entries(NODE_DEFINITIONS)) {
    // Map to actual component names (preserving current behavior)
    switch (definition.execution.category) {
      case 'geometry':
        mapping[nodeType] = `${definition.label}Node`; // TriangleNode, CircleNode, etc.
        break;
      case 'timing':
        mapping[nodeType] = 'InsertNode';
        break;
      case 'logic':
        mapping[nodeType] = 'FilterNode'; // Currently only filter
        break;
      case 'animation':
        mapping[nodeType] = 'AnimationNode';
        break;
      case 'output':
        mapping[nodeType] = 'SceneNode';
        break;
    }
  }
  
  return mapping;
}

// Validate node type at runtime
export function isValidNodeType(nodeType: string): nodeType is NodeType {
  return nodeType in NODE_DEFINITIONS;
}

// Get default properties for a node type
export function getNodeDefaults(nodeType: string): Record<string, unknown> | undefined {
  const definition = getNodeDefinition(nodeType);
  return definition?.defaults;
}

// Get node rendering config
export function getNodeRenderConfig(nodeType: string) {
  const definition = getNodeDefinition(nodeType);
  return definition?.rendering;
}

// Get execution config for backend
export function getNodeExecutionConfig(nodeType: string) {
  const definition = getNodeDefinition(nodeType);
  return definition?.execution;
}

// Future-proof: Get nodes that support conditional execution
export function getConditionalExecutionNodes(): NodeDefinition[] {
  return Object.values(NODE_DEFINITIONS).filter(def => 
    def.execution.executionPriority !== undefined || 
    def.execution.category === 'logic'
  );
}

// Resolution presets (preserved from existing)
export const RESOLUTION_PRESETS = [
  { label: "HD", width: 1280, height: 720 },
  { label: "FHD", width: 1920, height: 1080 },
  { label: "4K", width: 3840, height: 2160 },
  { label: "Square", width: 1080, height: 1080 },
] as const;