// src/lib/defaults/nodes.ts - Updated with unified ID system
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
} from "../types/nodes";

// Utility functions for node identification
function getNodeShortId(nodeType: NodeType): string {
  const prefixes: Record<NodeType, string> = {
    triangle: 'tri',
    circle: 'cir',
    rectangle: 'rec',
    insert: 'ins',
    animation: 'ani',
    scene: 'scn'
  };
  return prefixes[nodeType];
}

function getNodeDisplayLabel(nodeType: NodeType): string {
  const labels: Record<NodeType, string> = {
    triangle: 'Triangle',
    circle: 'Circle',
    rectangle: 'Rectangle',
    insert: 'Insert',
    animation: 'Animation',
    scene: 'Scene'
  };
  return labels[nodeType];
}

// Generate structured node identifier
export function generateNodeIdentifier(
  nodeType: NodeType,
  existingNodes: Node<NodeData>[]
): NodeIdentifier {
  const year = new Date().getFullYear();
  const shortId = getNodeShortId(nodeType);
  
  // Calculate sequence number for this node type
  const sameTypeNodes = existingNodes.filter(node => 
    node.data.identifier.type === nodeType
  );
  const sequence = sameTypeNodes.length + 1;
  
  // Generate unique suffix
  const suffix = Math.random().toString(36).substr(2, 8);
  
  // Create structured ID: "tri_2024_001_a1b2c3d4"
  const id = `${shortId}_${year}_${sequence.toString().padStart(3, '0')}_${suffix}`;
  
  // Generate unique display name
  const displayName = generateUniqueDisplayName(nodeType, existingNodes);
  
  return {
    id,
    type: nodeType,
    createdAt: Date.now(),
    sequence,
    displayName
  };
}

// Generate unique display name with auto-incrementing
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

// Create initial node lineage
function createInitialLineage(): NodeLineage {
  return {
    parentNodes: [],
    childNodes: [],
    flowPath: []
  };
}

// Main function to get default node data
export function getDefaultNodeData(
  nodeType: NodeType,
  existingNodes: Node<NodeData>[]
): NodeData {
  const identifier = generateNodeIdentifier(nodeType, existingNodes);
  const lineage = createInitialLineage();
  
  switch (nodeType) {
    case "triangle":
      return {
        identifier,
        lineage,
        size: 80,
        color: "#ff4444",
        strokeColor: "#ffffff",
        strokeWidth: 3,
        position: { x: 960, y: 540 },
      };
    case "circle":
      return {
        identifier,
        lineage,
        radius: 50,
        color: "#4444ff",
        strokeColor: "#ffffff", 
        strokeWidth: 2,
        position: { x: 960, y: 540 },
      };
    case "rectangle":
      return {
        identifier,
        lineage,
        width: 100,
        height: 60,
        color: "#44ff44",
        strokeColor: "#ffffff",
        strokeWidth: 2,
        position: { x: 960, y: 540 },
      };
    case "insert":
      return {
        identifier,
        lineage,
        appearanceTime: 0,
      };
    case "animation":
      return {
        identifier,
        lineage,
        duration: 3,
        tracks: [],
      };
    case "scene":
      return {
        identifier,
        lineage,
        width: 1920,
        height: 1080,
        fps: 60,
        duration: 4,
        backgroundColor: "#1a1a2e",
        videoPreset: "medium",
        videoCrf: 18,
      };
    default:
      throw new Error(`Unknown node type: ${nodeType}`);
  }
}

// Get default track properties (unchanged functionality)
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