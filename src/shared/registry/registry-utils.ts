// src/shared/registry/registry-utils.ts - Dynamic generation from node definitions
import { NODE_DEFINITIONS, type NodeDefinition } from '../types/definitions';
import { COMPONENT_MAPPING } from '@/components/workspace/nodes/generated-mappings';

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
        properties: def.properties.properties.map(prop => {
          if (prop.type === 'select' && 'options' in prop) {
            return {
              ...prop,
              options: [...prop.options]
            };
          }
          return { ...prop };
        }),
      },
      rendering: { ...def.rendering },
      defaults: { ...def.defaults },
    } satisfies NodeDefinition,
  ]),
) as Record<string, NodeDefinition>;

export function registerNodeDefinition(definition: NodeDefinition): void {
  REGISTRY[definition.type] = definition;
}

// Map execution category to semantic token-based classes for UI tinting
function getCategoryTokenClass(category: NodeDefinition['execution']['category']): { primary: string; handle: string } {
  switch (category) {
    case 'animation':
      return { primary: 'bg-[var(--node-animation)]', handle: '!bg-[var(--node-animation)]' };
    case 'logic':
      return { primary: 'bg-[var(--node-logic)]', handle: '!bg-[var(--node-logic)]' };
    case 'geometry':
      return { primary: 'bg-[var(--node-geometry)]', handle: '!bg-[var(--node-geometry)]' };
    case 'text':
      return { primary: 'bg-[var(--node-text)]', handle: '!bg-[var(--node-text)]' };
    case 'timing':
      return { primary: 'bg-[var(--node-data)]', handle: '!bg-[var(--node-data)]' };
    case 'data':
      return { primary: 'bg-[var(--node-data)]', handle: '!bg-[var(--node-data)]' };
    case 'image':
      return { primary: 'bg-[var(--node-image)]', handle: '!bg-[var(--node-image)]' };
    case 'input':
      return { primary: 'bg-[var(--node-input)]', handle: '!bg-[var(--node-input)]' };
    case 'output':
      return { primary: 'bg-[var(--node-output)]', handle: '!bg-[var(--node-output)]' };
    default:
      return { primary: 'bg-[var(--accent-primary)]', handle: '!bg-[var(--accent-primary)]' };
  }
}

// Generate node colors from definitions (replaces hardcoded constants)
export function generateNodeColors() {
  const colors: Record<string, { primary: string; handle: string }> = {};
  
  for (const [nodeType, definition] of Object.entries(REGISTRY)) {
    // Prefer category token to avoid drift, fall back to definition colors if needed
    const categoryColors = getCategoryTokenClass(definition.execution.category);
    colors[nodeType] = definition.rendering?.colors ?? categoryColors;
  }
  
  return colors;
}

// Generate track colors and icons from transform definitions
export function getTrackColors(): Record<string, string> {
  const colors: Record<string, string> = {};
  // Use CSS variables for consistent colors
  colors.move = "bg-[var(--transform-move)]";
  colors.rotate = "bg-[var(--transform-rotate)]";
  colors.scale = "bg-[var(--transform-scale)]";
  colors.fade = "bg-[var(--transform-fade)]";
  colors.color = "bg-[var(--transform-color)]";
  return colors;
}

export const TRACK_ICONS = {
  move: "→",
  rotate: "↻", 
  scale: "⚹",
  fade: "◐",
  color: "🎨",
} as const;

// Future: These could be generated from transform definitions
// export function generateTrackColors() {
//   const colors: Record<string, string> = {};
//   // Implementation would use transform definitions
//   return colors;
// }

// Generate palette structure from definitions
export function generateNodePalette() {
  const geometryNodes = getNodesByCategory('geometry').map(def => ({
    type: def.type as NodeType,
    label: def.label,
    icon: def.rendering.icon
  }));

  const textNodes = getNodesByCategory('text').map(def => ({
    type: def.type as NodeType,
    label: def.label,
    icon: def.rendering.icon
  }));

  const dataNodes = getNodesByCategory('data').map(def => ({
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

  const imageNodes = getNodesByCategory('image').map(def => ({
    type: def.type as NodeType,
    label: def.label,
    icon: def.rendering.icon
  }));

  const inputNodes = getNodesByCategory('input').map(def => ({
    type: def.type as NodeType,
    label: def.label,
    icon: def.rendering.icon
  }));

  const outputNodes = getNodesByCategory('output').map(def => ({
    type: def.type as NodeType,
    label: def.label,
    icon: def.rendering.icon
  }));

  return {
    geometryNodes,
    textNodes,
    dataNodes,
    timingNodes,
    logicNodes,
    animationNodes,
    imageNodes,
    inputNodes,
    outputNodes
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

// Build-time generated component mapping - automatically maintained
export function getNodeComponentMapping() {
  return COMPONENT_MAPPING;
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

// Dynamic port generation for nodes with configurable ports
export function getNodeDefinitionWithDynamicPorts(nodeType: string, nodeData?: Record<string, unknown>): NodeDefinition | undefined {
  const baseDefinition = getNodeDefinition(nodeType);
  if (!baseDefinition?.metadata?.supportsDynamicPorts) {
    return baseDefinition;
  }

  // Generic port generation based on metadata
  switch (baseDefinition.metadata.portGenerator) {
    case 'merge':
      return generateMergePorts(baseDefinition, nodeData);
    case 'boolean':
      return generateBooleanPorts(baseDefinition, nodeData);
    case 'math':
      return generateMathPorts(baseDefinition, nodeData);
    case 'custom':
      // Future: support for custom port generators
      return generateCustomPorts(baseDefinition, nodeData);
    default:
      return baseDefinition;
  }
}

// Generate dynamic ports for merge nodes
function generateMergePorts(baseDefinition: NodeDefinition, nodeData?: Record<string, unknown>): NodeDefinition {
  const portCount = Number(nodeData?.inputPortCount) || 2;
  const dynamicInputs = Array.from({ length: portCount }, (_, i) => ({
    id: `input${i + 1}`,
    type: 'object_stream' as const,
    label: i === 0 ? 'Input 1 (Priority)' : `Input ${i + 1}`,
  }));

  return {
    ...baseDefinition,
    ports: {
      inputs: dynamicInputs,
      outputs: [...baseDefinition.ports.outputs],
    },
  };
}

// Generate dynamic ports for boolean operation nodes
function generateBooleanPorts(baseDefinition: NodeDefinition, nodeData?: Record<string, unknown>): NodeDefinition {
  const operator = nodeData?.operator as string;
  
  if (operator === 'not') {
    // NOT operation only needs one input
    return {
      ...baseDefinition,
      ports: {
        inputs: [{ id: 'input1', type: 'data' as const, label: 'Input' }],
        outputs: [...baseDefinition.ports.outputs],
      },
    };
  }
  
  // AND, OR, XOR operations need two inputs (default case)
  return {
    ...baseDefinition,
    ports: {
      inputs: [
        { id: 'input1', type: 'data' as const, label: 'A' },
        { id: 'input2', type: 'data' as const, label: 'B' }
      ],
      outputs: [...baseDefinition.ports.outputs],
    },
  };
}

// Generate dynamic ports for math operation nodes
function generateMathPorts(baseDefinition: NodeDefinition, nodeData?: Record<string, unknown>): NodeDefinition {
  const operator = nodeData?.operator as string;
  
  // Unary operations only need one input
  if (operator === 'sqrt' || operator === 'abs') {
    return {
      ...baseDefinition,
      ports: {
        inputs: [{ id: 'input_a', type: 'data' as const, label: 'A' }],
        outputs: [...baseDefinition.ports.outputs],
      },
    };
  }
  
  // Binary operations need two inputs (default case)
  return {
    ...baseDefinition,
    ports: {
      inputs: [
        { id: 'input_a', type: 'data' as const, label: 'A' },
        { id: 'input_b', type: 'data' as const, label: 'B' }
      ],
      outputs: [...baseDefinition.ports.outputs],
    },
  };
}

// Placeholder for future custom port generators
function generateCustomPorts(baseDefinition: NodeDefinition, _nodeData?: Record<string, unknown>): NodeDefinition {
  // Future implementation for nodes with custom port generation logic
  return baseDefinition;
}

// Resolution presets (preserved from existing)
export const RESOLUTION_PRESETS = [
  { label: "HD", width: 1280, height: 720 },
  { label: "FHD", width: 1920, height: 1080 },
  { label: "4K", width: 3840, height: 2160 },
  { label: "Square", width: 1080, height: 1080 },
] as const;