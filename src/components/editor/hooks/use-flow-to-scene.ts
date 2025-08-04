import { useCallback } from "react";
import type { Node, Edge } from "reactflow";
import type { AnimationScene } from "@/animation/scene/scene";
import type { AnimationTrack } from "../nodes/animation-node";

export function useFlowToScene() {
  const convertFlowToScene = useCallback((nodes: Node[], edges: Edge[]): AnimationScene | null => {
    // Find scene node
    const sceneNode = nodes.find(node => node.type === "scene");
    if (!sceneNode) {
      throw new Error("Scene node is required");
    }

    // Get geometry nodes
    const geometryNodes = nodes.filter(node => 
      ["triangle", "circle", "rectangle"].includes(node.type!)
    );

    // Get animation nodes
    const animationNodes = nodes.filter(node => node.type === "animation");

    // Build objects from geometry nodes
    const objects = geometryNodes.map(node => {
      const baseObject = {
        id: node.id,
        type: node.type as "triangle" | "circle" | "rectangle",
        initialPosition: node.data.position,
        initialRotation: 0,
        initialScale: { x: 1, y: 1 },
        initialOpacity: 1,
      };

      switch (node.type) {
        case "triangle":
          return {
            ...baseObject,
            properties: {
              size: node.data.size,
              color: node.data.color,
              strokeColor: node.data.strokeColor,
              strokeWidth: node.data.strokeWidth,
            },
          };
        case "circle":
          return {
            ...baseObject,
            properties: {
              radius: node.data.radius,
              color: node.data.color,
              strokeColor: node.data.strokeColor,
              strokeWidth: node.data.strokeWidth,
            },
          };
        case "rectangle":
          return {
            ...baseObject,
            properties: {
              width: node.data.width,
              height: node.data.height,
              color: node.data.color,
              strokeColor: node.data.strokeColor,
              strokeWidth: node.data.strokeWidth,
            },
          };
        default:
          throw new Error(`Unknown geometry type: ${node.type}`);
      }
    });

    // Build animations from animation nodes and their connections
    const animations: any[] = [];
    let globalTimeOffset = 0;

    for (const animNode of animationNodes) {
      // Find the geometry node connected to this animation
      const incomingEdge = edges.find(edge => edge.target === animNode.id);
      if (!incomingEdge) {
        throw new Error(`Animation node ${animNode.id} has no connected object`);
      }

      const geometryObjectId = incomingEdge.source;
      const tracks: AnimationTrack[] = animNode.data.tracks || [];

      // Convert each track to global animation with offset
      for (const track of tracks) {
        const globalAnimation = {
          objectId: geometryObjectId,
          type: track.type,
          startTime: globalTimeOffset + track.startTime,
          duration: track.duration,
          easing: track.easing,
          properties: convertTrackProperties(track)
        };

        animations.push(globalAnimation);
      }

      // Move global time forward by this animation node's duration
      globalTimeOffset += animNode.data.duration;
    }

    // Calculate total scene duration
    const maxAnimationTime = animations.length > 0 
      ? Math.max(...animations.map(anim => anim.startTime + anim.duration))
      : 0;
    const totalDuration = Math.max(globalTimeOffset, maxAnimationTime, sceneNode.data.duration);

    // Validate that all animations have valid object connections
    const objectIds = new Set(objects.map(obj => obj.id));
    for (const animation of animations) {
      if (!objectIds.has(animation.objectId)) {
        throw new Error(`Animation references unknown object: ${animation.objectId}`);
      }
    }

    // Build final scene
    const scene: AnimationScene = {
      duration: totalDuration,
      objects,
      animations,
      background: {
        color: sceneNode.data.backgroundColor,
      },
    };

    return scene;
  }, []);

  return { convertFlowToScene };
}

function convertTrackProperties(track: AnimationTrack) {
  switch (track.type) {
    case 'move':
      return {
        from: track.properties.from,
        to: track.properties.to,
      };
    case 'rotate':
      return {
        from: 0,
        to: 0,
        rotations: track.properties.rotations,
      };
    case 'scale':
      return {
        from: track.properties.from,
        to: track.properties.to,
      };
    case 'fade':
      return {
        from: track.properties.from,
        to: track.properties.to,
      };
    case 'color':
      return {
        from: track.properties.from,
        to: track.properties.to,
        property: track.properties.property,
      };
    default:
      return track.properties;
  }
}