// src/shared/registry/registry-utils.ts - Dynamic generation from node definitions
import { NODE_DEFINITIONS, type NodeDefinition } from '../types/definitions';

// Derive NodeType from registry to avoid duplication elsewhere
export type NodeType = keyof typeof NODE_DEFINITIONS;

// Mutable registry copy to allow runtime registration of new nodes without touching static files
// Clone into mutable structures where needed to satisfy mutability of ports arrays
const REGISTRY: Record<string, NodeDefinition> = Object.fromEntries(
  Object.entries(NODE_DEFINITIONS).map(([key, def]) => [
    key,
    {
      ...def,
      ports: {
        inputs: [...def.ports.inputs],
        outputs: [...def.ports.outputs],
      },
      properties: {
        properties: [...def.properties.properties],
      },
      rendering: { ...def.rendering },
      defaults: { ...def.defaults },
    } satisfies NodeDefinition,
  ]),
) as Record<string, NodeDefinition>;

export function registerNodeDefinition(definition: NodeDefinition): void {
  REGISTRY[definition.type] = definition;
}

export function listNodeTypes(): string[] {
  return Object.keys(REGISTRY);
}

// Generate node colors from definitions (replaces hardcoded constants)
export function generateNodeColors() {
  const colors: Record<string, { primary: string; handle: string }> = {};
  
  for (const [nodeType, definition] of Object.entries(REGISTRY)) {
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
  return Object.values(REGISTRY).filter(def => def.execution.category === category);
}

export function getNodesByExecutor(executor: NodeDefinition['execution']['executor']): NodeDefinition[] {
  return Object.values(REGISTRY).filter(def => def.execution.executor === executor);
}

export function getNodeDefinition(nodeType: string): NodeDefinition | undefined {
  return REGISTRY[nodeType];
}

// Dynamic component mapping - returns actual component references
export function getNodeComponentMapping() {
  // Import components dynamically to avoid circular dependencies
  const {
    TriangleNode,
    CircleNode, 
    RectangleNode,
    InsertNode,
    FilterNode,
    AnimationNode,
    SceneNode
  } = require('@/components/editor/nodes');

  const mapping: Record<string, React.ComponentType<any>> = {};
  
  for (const [nodeType, definition] of Object.entries(REGISTRY)) {
    // Map to actual component references based on category
    switch (definition.execution.category) {
      case 'geometry':
        if (nodeType === 'triangle') mapping[nodeType] = TriangleNode;
        else if (nodeType === 'circle') mapping[nodeType] = CircleNode;
        else if (nodeType === 'rectangle') mapping[nodeType] = RectangleNode;
        break;
      case 'timing':
        mapping[nodeType] = InsertNode;
        break;
      case 'logic':
        mapping[nodeType] = FilterNode;
        break;
      case 'animation':
        mapping[nodeType] = AnimationNode;
        break;
      case 'output':
        mapping[nodeType] = SceneNode;
        break;
    }
  }
  
  return mapping;
}

// Validate node type at runtime
export function isValidNodeType(nodeType: string): nodeType is NodeType {
  return nodeType in REGISTRY;
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
  return Object.values(REGISTRY).filter(def =>
    def.execution.executionPriority !== undefined || def.execution.category === 'logic'
  );
}

// Resolution presets (preserved from existing)
export const RESOLUTION_PRESETS = [
  { label: "HD", width: 1280, height: 720 },
  { label: "FHD", width: 1920, height: 1080 },
  { label: "4K", width: 3840, height: 2160 },
  { label: "Square", width: 1080, height: 1080 },
] as const;