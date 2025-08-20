// src/lib/defaults/nodes.ts - Registry-driven node defaults
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
import { getNodeDefinition, getNodeDefaults } from "@/shared/registry/registry-utils";

// Utility functions for node identification (unchanged)
function getNodeShortId(nodeType: NodeType): string {
  const prefixes: Record<NodeType, string> = {
    triangle: 'tri',
    circle: 'cir',
    rectangle: 'rec',
    text: 'txt',
    insert: 'ins',
    filter: 'flt',
    merge: 'mrg',
    constants: 'con',
    result: 'res',
    animation: 'ani',
    typography: 'tst',
    scene: 'scn',
    canvas: 'cnv',
    frame: 'frm',
    compare: 'cmp',
    if_else: 'ife',
    boolean_op: 'bop',
    math_op: 'mat',
    duplicate: 'dup'
  };
  return prefixes[nodeType];
}

function getNodeDisplayLabel(nodeType: NodeType): string {
  const definition = getNodeDefinition(nodeType);
  return definition?.label ?? 'Unknown Node';
}

// Generate structured node identifier (unchanged)
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

// Generate unique display name (unchanged)
function generateUniqueDisplayName(
  nodeType: NodeType,
  existingNodes: Node<NodeData>[]
): string {
  const baseName = getNodeDisplayLabel(nodeType);
  const existingNames = new Set(
    existingNodes.map(node => node.data.identifier.displayName.toLowerCase())
  );
  
  let counter = 1;
  let candidateName = `${baseName} ${counter}`;
  
  while (existingNames.has(candidateName.toLowerCase())) {
    counter++;
    candidateName = `${baseName} ${counter}`;
  }
  
  return candidateName;
}

// Create initial node lineage (unchanged)
function createInitialLineage(): NodeLineage {
  return {
    parentNodes: [],
    childNodes: [],
    flowPath: []
  };
}

// Registry-driven node data creation - replaces giant switch statement
export function getDefaultNodeData(
  nodeType: NodeType,
  existingNodes: Node<NodeData>[]
): NodeData {
  const identifier = generateNodeIdentifier(nodeType, existingNodes);
  const lineage = createInitialLineage();
  
  // Get defaults from registry instead of hardcoded switch
  const registryDefaults = getNodeDefaults(nodeType);
  if (!registryDefaults) {
    throw new Error(`Unknown node type: ${nodeType}`);
  }
  
  // Create base data with identifier and lineage
  const baseData = {
    identifier,
    lineage,
  };
  
  // Merge with registry defaults - type-safe because registry defines the shape
  return { ...baseData, ...registryDefaults } as NodeData;
}

// Track property defaults (unchanged - future logic node preparation)
export function getDefaultTrackProperties(trackType: AnimationTrack['type']): 
  MoveTrackProperties | RotateTrackProperties | ScaleTrackProperties | FadeTrackProperties | ColorTrackProperties {
  switch (trackType) {
    case 'move':
      return { from: { x: 0, y: 0 }, to: { x: 100, y: 100 } };
    case 'rotate':
      return { from: 0, to: 1 };
    case 'scale':
      return { from: 1, to: 1.5 };
    case 'fade':
      return { from: 1, to: 0.5 };
    case 'color':
      return { from: '#ff0000', to: '#00ff00', property: 'fill' };
    default:
      {
        const _exhaustiveCheck: never = trackType;
        void _exhaustiveCheck;
        throw new Error('Unknown track type');
      }
  }
}