// src/lib/defaults/nodes.ts - Auto-incrementing unique naming system
import type { 
  NodeData, 
  NodeType, 
  AnimationTrack,
  MoveTrackProperties,
  RotateTrackProperties,
  ScaleTrackProperties,
  FadeTrackProperties,
  ColorTrackProperties
} from "../types/nodes";

// Global counters for unique naming
const nodeCounters: Record<NodeType, number> = {
  triangle: 0,
  circle: 0,  
  rectangle: 0,
  insert: 0,
  animation: 0,
  scene: 0
};

export function getDefaultNodeData(nodeType: NodeType): NodeData {
  const id = `${nodeType}-${Date.now()}`;
  
  // Auto-increment counter for unique names
  nodeCounters[nodeType]++;
  const counter = nodeCounters[nodeType];
  
  switch (nodeType) {
    case "triangle":
      return {
        id,
        userDefinedName: `Triangle ${counter}`,
        objectName: `Triangle Object ${counter}`,
        size: 80,
        color: "#ff4444",
        strokeColor: "#ffffff",
        strokeWidth: 3,
        position: { x: 960, y: 540 },
      };
    case "circle":
      return {
        id,
        userDefinedName: `Circle ${counter}`,
        objectName: `Circle Object ${counter}`,
        radius: 50,
        color: "#4444ff",
        strokeColor: "#ffffff", 
        strokeWidth: 2,
        position: { x: 960, y: 540 },
      };
    case "rectangle":
      return {
        id,
        userDefinedName: `Rectangle ${counter}`,
        objectName: `Rectangle Object ${counter}`,
        width: 100,
        height: 60,
        color: "#44ff44",
        strokeColor: "#ffffff",
        strokeWidth: 2,
        position: { x: 960, y: 540 },
      };
    case "insert":
      return {
        id,
        userDefinedName: `Insert ${counter}`,
        appearanceTime: 0,
      };
    case "animation":
      return {
        id,
        userDefinedName: `Animation ${counter}`,
        duration: 3,
        tracks: [],
      };
    case "scene":
      return {
        id,
        userDefinedName: `Scene ${counter}`,
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