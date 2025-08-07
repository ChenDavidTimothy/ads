// src/shared/registry/registry-utils.ts - Enhanced registry utilities for full scalability
import { NODE_DEFINITIONS, type NodeDefinition, type NodeType, type NodeRenderTemplate } from '../types/definitions';

// Generate node colors from enhanced definitions
export function generateNodeColors() {
  const colors: Record<string, { primary: string; handle: string }> = {};
  
  for (const [nodeType, definition] of Object.entries(NODE_DEFINITIONS)) {
    colors[nodeType] = definition.rendering.colors;
  }
  
  return colors;
}

// Track colors and icons (preserved from existing)
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

// Enhanced palette generation with template awareness
export function generateNodePalette() {
  const geometryNodes = getNodesByCategory('geometry').map(def => ({
    type: def.type as NodeType,
    label: def.label,
    icon: def.rendering.icon,
    template: def.rendering.template,
    description: def.description
  }));

  const timingNodes = getNodesByCategory('timing').map(def => ({
    type: def.type as NodeType,
    label: def.label,
    icon: def.rendering.icon,
    template: def.rendering.template,
    description: def.description
  }));

  const logicNodes = getNodesByCategory('logic').map(def => ({
    type: def.type as NodeType,
    label: def.label,
    icon: def.rendering.icon,
    template: def.rendering.template,
    description: def.description
  }));

  const animationNodes = getNodesByCategory('animation').map(def => ({
    type: def.type as NodeType,
    label: def.label,
    icon: def.rendering.icon,
    template: def.rendering.template,
    description: def.description
  }));

  const outputNodes = getNodesByCategory('output').map(def => ({
    type: def.type as NodeType,
    label: def.label,
    icon: def.rendering.icon,
    template: def.rendering.template,
    description: def.description
  }));

  // Future: Data and control flow nodes
  const dataNodes = getNodesByCategory('data').map(def => ({
    type: def.type as NodeType,
    label: def.label,
    icon: def.rendering.icon,
    template: def.rendering.template,
    description: def.description
  }));

  const controlFlowNodes = getNodesByCategory('control_flow').map(def => ({
    type: def.type as NodeType,
    label: def.label,
    icon: def.rendering.icon,
    template: def.rendering.template,
    description: def.description
  }));

  return {
    geometryNodes,
    timingNodes,
    logicNodes,
    animationNodes,
    outputNodes,
    dataNodes,      // Future-ready
    controlFlowNodes // Future-ready
  };
}

// Enhanced registry query functions
export function getNodesByCategory(category: NodeDefinition['execution']['category']): NodeDefinition[] {
  return Object.values(NODE_DEFINITIONS).filter(def => def.execution.category === category);
}

export function getNodesByExecutor(executor: NodeDefinition['execution']['executor']): NodeDefinition[] {
  return Object.values(NODE_DEFINITIONS).filter(def => def.execution.executor === executor);
}

export function getNodesByTemplate(template: NodeRenderTemplate): NodeDefinition[] {
  return Object.values(NODE_DEFINITIONS).filter(def => def.rendering.template === template);
}

export function getNodeDefinition(nodeType: string): NodeDefinition | undefined {
  return NODE_DEFINITIONS[nodeType as keyof typeof NODE_DEFINITIONS];
}

// Enhanced component mapping for future dynamic registration
export function getNodeComponentMapping(): Record<string, { 
  component: string; 
  template: NodeRenderTemplate;
  requiresCustomHandling: boolean;
}> {
  const mapping: Record<string, { 
    component: string; 
    template: NodeRenderTemplate;
    requiresCustomHandling: boolean;
  }> = {};
  
  for (const [nodeType, definition] of Object.entries(NODE_DEFINITIONS)) {
    mapping[nodeType] = {
      component: 'GenericNodeRenderer', // All use generic renderer now
      template: definition.rendering.template,
      requiresCustomHandling: definition.rendering.template !== 'basic'
    };
  }
  
  return mapping;
}

// Template-based rendering configuration
export function getTemplateRenderConfig(template: NodeRenderTemplate) {
  const configs = {
    basic: {
      showIcon: true,
      showColor: true,
      allowCompact: false,
      defaultWidth: 180,
      showSequenceId: true
    },
    conditional: {
      showIcon: true,
      showColor: false,
      allowCompact: false,
      defaultWidth: 200,
      showSequenceId: false,
      multipleOutputs: true
    },
    operation: {
      showIcon: true,
      showColor: false,
      allowCompact: true,
      defaultWidth: 120,
      showSequenceId: false,
      centerIcon: true
    },
    data_source: {
      showIcon: true,
      showColor: false,
      allowCompact: true,
      defaultWidth: 140,
      showSequenceId: false,
      showDataPreview: true
    },
    custom: {
      showIcon: false,
      showColor: false,
      allowCompact: false,
      defaultWidth: 200,
      showSequenceId: false,
      customRenderer: true
    }
  };
  
  return configs[template];
}

// Validate node type at runtime with enhanced checking
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

// Enhanced port analysis
export function getNodePortConfiguration(nodeType: string) {
  const definition = getNodeDefinition(nodeType);
  if (!definition) return null;
  
  return {
    inputs: definition.ports.inputs,
    outputs: definition.ports.outputs,
    hasMultipleInputs: definition.ports.inputs.length > 1,
    hasMultipleOutputs: definition.ports.outputs.length > 1,
    isConditional: definition.ports.outputs.some(port => 
      port.id.includes('true') || port.id.includes('false') || port.id.includes('condition')
    ),
    supportedTypes: [
      ...definition.ports.inputs.map(p => p.type),
      ...definition.ports.outputs.map(p => p.type)
    ]
  };
}

// Future: Get nodes that support conditional execution
export function getConditionalExecutionNodes(): NodeDefinition[] {
  return Object.values(NODE_DEFINITIONS).filter(def => 
    def.execution.executionPriority !== undefined || 
    def.execution.category === 'logic' ||
    def.execution.executionMode === 'conditional'
  );
}

// Future: Get nodes that support parallel execution
export function getParallelExecutionNodes(): NodeDefinition[] {
  return Object.values(NODE_DEFINITIONS).filter(def => 
    def.execution.executionMode === 'parallel' ||
    def.execution.category === 'geometry' ||
    def.execution.category === 'data'
  );
}

// Future: Dynamic node validation based on registry
export function validateNodeConfiguration(
  nodeType: string, 
  nodeData: Record<string, unknown>
): { valid: boolean; errors: string[] } {
  const definition = getNodeDefinition(nodeType);
  if (!definition) {
    return { valid: false, errors: [`Unknown node type: ${nodeType}`] };
  }
  
  const errors: string[] = [];
  
  // Validate required properties
  const requiredProps = definition.properties.properties.filter(prop => prop.required);
  for (const prop of requiredProps) {
    if (!(prop.key in nodeData)) {
      errors.push(`Missing required property: ${prop.key}`);
    }
  }
  
  // Validate property types
  for (const prop of definition.properties.properties) {
    if (prop.key in nodeData) {
      const value = nodeData[prop.key];
      const isValid = validatePropertyType(value, prop.type);
      if (!isValid) {
        errors.push(`Invalid type for property ${prop.key}: expected ${prop.type}`);
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}

// Property type validation helper
function validatePropertyType(value: unknown, expectedType: string): boolean {
  switch (expectedType) {
    case 'number':
      return typeof value === 'number';
    case 'string':
      return typeof value === 'string';
    case 'boolean':
      return typeof value === 'boolean';
    case 'color':
      return typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value);
    case 'point2d':
      return typeof value === 'object' && value !== null && 
             'x' in value && 'y' in value &&
             typeof (value as any).x === 'number' && typeof (value as any).y === 'number';
    case 'select':
      return typeof value === 'string';
    case 'range':
      return typeof value === 'number';
    default:
      return true; // Unknown types pass validation
  }
}

// Future: Node capability analysis for UI features
export function getNodeCapabilities(nodeType: string): {
  canHandleConditionals: boolean;
  canModifyData: boolean;
  canCreateObjects: boolean;
  canControlFlow: boolean;
  canExecuteInParallel: boolean;
  hasMultipleOutputs: boolean;
  requiresConfiguration: boolean;
} {
  const definition = getNodeDefinition(nodeType);
  if (!definition) {
    return {
      canHandleConditionals: false,
      canModifyData: false,
      canCreateObjects: false,
      canControlFlow: false,
      canExecuteInParallel: false,
      hasMultipleOutputs: false,
      requiresConfiguration: false,
    };
  }
  
  return {
    canHandleConditionals: definition.execution.category === 'logic',
    canModifyData: ['logic', 'animation', 'data'].includes(definition.execution.category),
    canCreateObjects: definition.execution.category === 'geometry',
    canControlFlow: ['timing', 'control_flow'].includes(definition.execution.category),
    canExecuteInParallel: definition.execution.executionMode === 'parallel',
    hasMultipleOutputs: definition.ports.outputs.length > 1,
    requiresConfiguration: definition.properties.properties.length > 0,
  };
}

// Future: Registry-based flow analysis
export function analyzeFlowComplexity(
  nodeTypes: string[]
): {
  hasGeometry: boolean;
  hasTiming: boolean;
  hasLogic: boolean;
  hasAnimation: boolean;
  hasOutput: boolean;
  hasData: boolean;
  hasControlFlow: boolean;
  flowComplexity: 'simple' | 'moderate' | 'complex' | 'advanced';
  estimatedExecutionTime: 'fast' | 'medium' | 'slow';
} {
  const nodesByCategory = {
    geometry: 0,
    timing: 0,
    logic: 0,
    animation: 0,
    output: 0,
    data: 0,
    control_flow: 0,
  };
  
  for (const nodeType of nodeTypes) {
    const definition = getNodeDefinition(nodeType);
    if (definition) {
      nodesByCategory[definition.execution.category]++;
    }
  }
  
  const totalNodes = nodeTypes.length;
  const logicNodeCount = nodesByCategory.logic + nodesByCategory.control_flow;
  
  let flowComplexity: 'simple' | 'moderate' | 'complex' | 'advanced' = 'simple';
  let estimatedExecutionTime: 'fast' | 'medium' | 'slow' = 'fast';
  
  if (totalNodes > 20 || logicNodeCount > 5 || nodesByCategory.control_flow > 0) {
    flowComplexity = 'advanced';
    estimatedExecutionTime = 'slow';
  } else if (totalNodes > 10 || logicNodeCount > 2) {
    flowComplexity = 'complex';
    estimatedExecutionTime = 'medium';
  } else if (totalNodes > 5 || logicNodeCount > 0) {
    flowComplexity = 'moderate';
    estimatedExecutionTime = 'medium';
  }
  
  return {
    hasGeometry: nodesByCategory.geometry > 0,
    hasTiming: nodesByCategory.timing > 0,
    hasLogic: nodesByCategory.logic > 0,
    hasAnimation: nodesByCategory.animation > 0,
    hasOutput: nodesByCategory.output > 0,
    hasData: nodesByCategory.data > 0,
    hasControlFlow: nodesByCategory.control_flow > 0,
    flowComplexity,
    estimatedExecutionTime,
  };
}

// Resolution presets (preserved from existing)
export const RESOLUTION_PRESETS = [
  { label: "HD", width: 1280, height: 720 },
  { label: "FHD", width: 1920, height: 1080 },
  { label: "4K", width: 3840, height: 2160 },
  { label: "Square", width: 1080, height: 1080 },
] as const;

// Future: Template-specific validation
export function validateNodeTemplate(
  template: NodeRenderTemplate,
  nodeData: Record<string, unknown>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  switch (template) {
    case 'conditional':
      // Conditional nodes should have boolean inputs/outputs
      if (!('condition' in nodeData)) {
        errors.push('Conditional nodes require a condition property');
      }
      break;
      
    case 'operation':
      // Operation nodes should have operation type
      if (!('operation' in nodeData)) {
        errors.push('Operation nodes require an operation property');
      }
      break;
      
    case 'data_source':
      // Data source nodes should have value or variable reference
      if (!('value' in nodeData) && !('variableName' in nodeData)) {
        errors.push('Data source nodes require either a value or variable name');
      }
      break;
  }
  
  return { valid: errors.length === 0, errors };
}

// Export node type checking utilities
export function isGeometryNode(nodeType: string): boolean {
  const definition = getNodeDefinition(nodeType);
  return definition?.execution.category === 'geometry' || false;
}

export function isLogicNode(nodeType: string): boolean {
  const definition = getNodeDefinition(nodeType);
  return definition?.execution.category === 'logic' || false;
}

export function isDataNode(nodeType: string): boolean {
  const definition = getNodeDefinition(nodeType);
  return definition?.execution.category === 'data' || false;
}

export function isControlFlowNode(nodeType: string): boolean {
  const definition = getNodeDefinition(nodeType);
  return definition?.execution.category === 'control_flow' || false;
}