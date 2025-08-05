import type { NodeData, NodeType, AnimationTrack } from "../types/nodes";

export function getDefaultNodeData(nodeType: NodeType): NodeData {
  const id = `${nodeType}-${Date.now()}`;
  
  switch (nodeType) {
    case "triangle":
      return {
        id,
        size: 80,
        color: "#ff4444",
        strokeColor: "#ffffff",
        strokeWidth: 3,
        position: { x: 960, y: 540 },
      };
    case "circle":
      return {
        id,
        radius: 50,
        color: "#4444ff",
        strokeColor: "#ffffff", 
        strokeWidth: 2,
        position: { x: 960, y: 540 },
      };
    case "rectangle":
      return {
        id,
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
        appearanceTime: 0,
      };
    case "animation":
      return {
        id,
        duration: 3,
        tracks: [],
      };
    case "scene":
      return {
        id,
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

export function getDefaultTrackProperties(trackType: AnimationTrack['type']): any {
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
      return {};
  }
}