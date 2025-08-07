// src/lib/defaults/nodes.ts - Enhanced registry-driven node defaults with template support
import type { Node } from "reactflow";
import type { 
  NodeData, 
  NodeType, 
  NodeIdentifier,
  NodeLineage,
  AnimationTrack,
  MoveTrackProperties,
  RotateTrackProperties,
  ScaleTrackProperties,
  FadeTrackProperties,
  ColorTrackProperties
} from "@/shared/types";
import { getNodeDefinition, getNodeDefaults, getTemplateRenderConfig } from "@/shared/registry/registry-utils";

// Enhanced node identification with template awareness
function getNodeShortId(nodeType: NodeType): string {
  const definition = getNodeDefinition(nodeType);
  if (!definition) return 'unk';
  
  // Generate short IDs based on category and template
  const categoryPrefixes: Record<string, string> = {
    geometry: 'geo',
    timing: 'time',
    logic: 'log',
    animation: 'anim',
    output: 'out',
    data: 'data',
    control_flow: 'ctrl'
  };
  
  const templateSuffixes: Record<string, string> = {
    basic: '',
    conditional: 'c',
    operation: 'o',
    data_source: 'd',
    custom: 'x'
  };
  
  const categoryPrefix = categoryPrefixes[definition.execution.category] || 'unk';
  const templateSuffix = templateSuffixes[definition.rendering.template] || '';
  
  return templateSuffix ? `${categoryPrefix}${templateSuffix}` : categoryPrefix;
}

function getNodeDisplayLabel(nodeType: NodeType): string {
  const definition = getNodeDefinition(nodeType);
  return definition?.label ?? 'Unknown Node';
}

// Enhanced unique name generation with template awareness
function generateUniqueDisplayName(
  nodeType: NodeType,
  existingNodes: Node<NodeData>[]
): string {
  const definition = getNodeDefinition(nodeType);
  if (!definition) return `Unknown ${Math.random().toString(36).substr(2, 4)}`;
  
  const baseName = definition.label;
  const template = definition.rendering.template;
  
  // Template-specific naming patterns
  const templatePatterns: Record<string, (baseName: string, counter: number) => string> = {
    basic: (base, counter) => `${base} ${counter}`,
    conditional: (base, counter) => `${base} ${counter}`,
    operation: (base, counter) => counter === 1 ? base : `${base} ${counter}`,
    data_source: (base, counter) => counter === 1 ? base : `${base} ${counter}`,
    custom: (base, counter) => `${base} ${counter}`
  };
  
  const nameGenerator = templatePatterns[template] || templatePatterns.basic;
  
  const existingNames = new Set(
    existingNodes.map(node => node.data.identifier.displayName.toLowerCase())
  );
  
  let counter = 1;
  let candidateName = nameGenerator(baseName, counter);
  
  while (existingNames.has(candidateName.toLowerCase())) {
    counter++;
    candidateName = nameGenerator(baseName, counter);
  }
  
  return candidateName;
}

// Enhanced node identifier generation
export function generateNodeIdentifier(
  nodeType: NodeType,
  existingNodes: Node<NodeData>[]
): NodeIdentifier {
  const year = new Date().getFullYear();
  const shortId = getNodeShortId(nodeType);
  
  const sameTypeNodes = existingNodes.filter(node => 
    node.data.identifier.type === nodeType
  );
  const sequence = sameTypeNodes.length + 1;
  
  const suffix = Math.random().toString(36).substr(2, 8);
  const id = `${shortId}_${year}_${sequence.toString().padStart(3, '0')}_${suffix}`;
  const displayName = generateUniqueDisplayName(nodeType, existingNodes);
  
  return {
    id,
    type: nodeType,
    createdAt: Date.now(),
    sequence,
    displayName
  };
}

// Create initial node lineage (unchanged)
function createInitialLineage(): NodeLineage {
  return {
    parentNodes: [],
    childNodes: [],
    flowPath: []
  };
}

// Enhanced registry-driven node data creation with template-specific defaults
export function getDefaultNodeData(
  nodeType: NodeType,
  existingNodes: Node<NodeData>[]
): NodeData {
  const identifier = generateNodeIdentifier(nodeType, existingNodes);
  const lineage = createInitialLineage();
  
  // Get base defaults from registry
  const registryDefaults = getNodeDefaults(nodeType);
  if (!registryDefaults) {
    throw new Error(`Unknown node type: ${nodeType}`);
  }
  
  // Get template-specific enhancements
  const definition = getNodeDefinition(nodeType);
  if (!definition) {
    throw new Error(`No definition found for node type: ${nodeType}`);
  }
  
  const templateConfig = getTemplateRenderConfig(definition.rendering.template);
  const templateDefaults = getTemplateSpecificDefaults(definition.rendering.template, definition);
  
  // Create base data with identifier and lineage
  const baseData = {
    identifier,
    lineage,
  };
  
  // Merge registry defaults with template-specific defaults
  const enhancedDefaults = {
    ...registryDefaults,
    ...templateDefaults,
    // Template-specific metadata for future use
    _templateConfig: {
      template: definition.rendering.template,
      ...templateConfig
    }
  };
  
  // Remove template config from final data (internal use only)
  const { _templateConfig, ...finalDefaults } = enhancedDefaults;
  
  return { ...baseData, ...finalDefaults } as NodeData;
}

// Template-specific default value generation
function getTemplateSpecificDefaults(
  template: string, 
  definition: ReturnType<typeof getNodeDefinition>
): Record<string, unknown> {
  if (!definition) return {};
  
  switch (template) {
    case 'conditional':
      return {
        // Future: Conditional node defaults
        condition: true,
        trueLabel: 'Yes',
        falseLabel: 'No',
        showLabels: true
      };
      
    case 'operation':
      return {
        // Future: Operation node defaults  
        operation: 'add',
        displayFormat: 'symbol', // vs 'text'
        precision: 2
      };
      
    case 'data_source':
      return {
        // Future: Data source node defaults
        dataType: 'number',
        value: 0,
        variableName: '',
        isConstant: true
      };
      
    case 'custom':
      return {
        // Future: Custom node defaults
        customConfig: {},
        renderMode: 'standard'
      };
      
    case 'basic':
    default:
      return {}; // Basic nodes use registry defaults only
  }
}

// Enhanced track property defaults with future logic preparation
export function getDefaultTrackProperties(trackType: AnimationTrack['type']): 
  MoveTrackProperties | RotateTrackProperties | ScaleTrackProperties | FadeTrackProperties | ColorTrackProperties {
  switch (trackType) {
    case 'move':
      return { from: { x: 0, y: 0 }, to: { x: 100, y: 100 } };
    case 'rotate':
      return { rotations: 1 };
    case 'scale':
      return { from: 1, to: 1.5 };
    case 'fade':
      return { from: 1, to: 0.5 };
    case 'color':
      return { from: '#ff0000', to: '#00ff00', property: 'fill' };
    default:
      throw new Error(`Unknown track type: ${trackType}`);
  }
}

// Future: Template-aware position calculation
export function getDefaultNodePosition(
  nodeType: NodeType,
  template: string,
  existingNodes: Node<NodeData>[],
  canvasSize?: { width: number; height: number }
): { x: number; y: number } {
  const canvas = canvasSize || { width: 1200, height: 800 };
  
  // Template-specific positioning strategies
  const templatePositioning = {
    basic: () => ({
      x: 250 + Math.random() * 200,
      y: 250 + Math.random() * 200
    }),
    conditional: () => ({
      x: 300 + Math.random() * 150, // More central for logic flow
      y: 200 + Math.random() * 300
    }),
    operation: () => ({
      x: 400 + Math.random() * 100, // Clustered for operations
      y: 300 + Math.random() * 200
    }),
    data_source: () => ({
      x: 100 + Math.random() * 100, // Left side for data sources
      y: 150 + Math.random() * 400
    }),
    custom: () => ({
      x: 250 + Math.random() * 200,
      y: 250 + Math.random() * 200
    })
  };
  
  const positionGenerator = templatePositioning[template as keyof typeof templatePositioning] 
    || templatePositioning.basic;
  
  let position = positionGenerator();
  
  // Avoid overlapping with existing nodes
  const minDistance = 150;
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    const hasCollision = existingNodes.some(node => {
      const dx = node.position.x - position.x;
      const dy = node.position.y - position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance < minDistance;
    });
    
    if (!hasCollision) break;
    
    position = positionGenerator();
    attempts++;
  }
  
  return position;
}

// Future: Template-specific validation for node creation
export function validateNodeDefaults(
  nodeType: NodeType,
  nodeData: Record<string, unknown>
): { valid: boolean; errors: string[] } {
  const definition = getNodeDefinition(nodeType);
  if (!definition) {
    return { valid: false, errors: [`Unknown node type: ${nodeType}`] };
  }
  
  const errors: string[] = [];
  
  // Template-specific validation
  switch (definition.rendering.template) {
    case 'conditional':
      if (!('condition' in nodeData)) {
        errors.push('Conditional nodes require a condition property');
      }
      break;
      
    case 'operation':
      if (!('operation' in nodeData)) {
        errors.push('Operation nodes require an operation property');
      }
      break;
      
    case 'data_source':
      if (!('value' in nodeData) && !('variableName' in nodeData)) {
        errors.push('Data source nodes require either a value or variable reference');
      }
      break;
  }
  
  // Validate required properties from definition
  const requiredProps = definition.properties.properties.filter(prop => prop.required);
  for (const prop of requiredProps) {
    if (!(prop.key in nodeData)) {
      errors.push(`Missing required property: ${prop.key}`);
    }
  }
  
  return { valid: errors.length === 0, errors };
}

// Future: Smart defaults based on existing node context
export function getSmartDefaults(
  nodeType: NodeType,
  existingNodes: Node<NodeData>[],
  connectionContext?: {
    sourceNodeType?: string;
    targetNodeType?: string;
    portType?: string;
  }
): Partial<Record<string, unknown>> {
  const definition = getNodeDefinition(nodeType);
  if (!definition) return {};
  
  const smartDefaults: Record<string, unknown> = {};
  
  // Context-aware defaults based on connected nodes
  if (connectionContext?.sourceNodeType) {
    const sourceDefinition = getNodeDefinition(connectionContext.sourceNodeType);
    
    // If connecting from geometry node, inherit some properties
    if (sourceDefinition?.execution.category === 'geometry' && 
        definition.execution.category === 'timing') {
      // Timing nodes connected to geometry can infer appearance time
      smartDefaults.appearanceTime = 0;
    }
    
    // If connecting from timing to animation, suggest reasonable duration
    if (sourceDefinition?.execution.category === 'timing' && 
        definition.execution.category === 'animation') {
      smartDefaults.duration = 2;
    }
  }
  
  // Scene-aware defaults (if scene node exists)
  const sceneNode = existingNodes.find(n => n.type === 'scene');
  if (sceneNode && definition.execution.category === 'geometry') {
    const sceneData = sceneNode.data as any;
    // Position geometry nodes relative to scene center
    smartDefaults.position = {
      x: (sceneData.width || 1920) / 2,
      y: (sceneData.height || 1080) / 2
    };
  }
  
  return smartDefaults;
}

// Future: Template-aware node cloning
export function cloneNodeWithTemplateAwareness(
  sourceNode: Node<NodeData>,
  existingNodes: Node<NodeData>[],
  offsetPosition: { x: number; y: number } = { x: 50, y: 50 }
): NodeData {
  const definition = getNodeDefinition(sourceNode.type!);
  if (!definition) {
    throw new Error(`Cannot clone unknown node type: ${sourceNode.type}`);
  }
  
  // Generate new identifier for cloned node
  const newIdentifier = generateNodeIdentifier(sourceNode.data.identifier.type, existingNodes);
  
  // Clone data with template-specific modifications
  const clonedData = {
    ...sourceNode.data,
    identifier: newIdentifier,
    lineage: createInitialLineage()
  };
  
  // Template-specific clone modifications
  switch (definition.rendering.template) {
    case 'basic':
      // Basic nodes clone all properties as-is
      break;
      
    case 'conditional':
      // Conditional nodes might need unique condition references
      if ('conditionVariable' in clonedData) {
        clonedData.conditionVariable = `${clonedData.conditionVariable}_copy`;
      }
      break;
      
    case 'data_source':
      // Data source nodes get unique variable names
      if ('variableName' in clonedData && clonedData.variableName) {
        clonedData.variableName = `${clonedData.variableName}_copy`;
      }
      break;
  }
  
  return clonedData as NodeData;
}