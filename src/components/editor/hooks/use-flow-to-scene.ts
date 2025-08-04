import { useCallback } from "react";
import type { Node, Edge } from "reactflow";
import type { AnimationScene } from "@/animation/scene/scene";

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
    const animationNodes = nodes.filter(node => 
      ["move", "rotate", "scale", "fade", "color"].includes(node.type!)
    );

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
    const animations = animationNodes.map(animNode => {
      // Find the geometry node connected to this animation
      const incomingEdge = edges.find(edge => edge.target === animNode.id);
      if (!incomingEdge) {
        throw new Error(`Animation node ${animNode.id} has no connected object`);
      }

      const baseAnimation = {
        objectId: incomingEdge.source,
        type: animNode.type as "move" | "rotate" | "scale" | "fade" | "color",
        startTime: animNode.data.startTime,
        duration: animNode.data.duration,
        easing: animNode.data.easing as "linear" | "easeInOut" | "easeIn" | "easeOut",
      };

      switch (animNode.type) {
        case "move":
          return {
            ...baseAnimation,
            properties: {
              from: animNode.data.from,
              to: animNode.data.to,
            },
          };
        case "rotate":
          return {
            ...baseAnimation,
            properties: {
              from: 0,
              to: 0,
              rotations: animNode.data.rotations,
            },
          };
        case "scale":
          return {
            ...baseAnimation,
            properties: {
              from: animNode.data.from,
              to: animNode.data.to,
            },
          };
        case "fade":
          return {
            ...baseAnimation,
            properties: {
              from: animNode.data.from,
              to: animNode.data.to,
            },
          };
        case "color":
          return {
            ...baseAnimation,
            properties: {
              from: animNode.data.from,
              to: animNode.data.to,
              property: animNode.data.property,
            },
          };
        default:
          throw new Error(`Unknown animation type: ${animNode.type}`);
      }
    });

    // Validate that all animations have valid object connections
    const objectIds = new Set(objects.map(obj => obj.id));
    for (const animation of animations) {
      if (!objectIds.has(animation.objectId)) {
        throw new Error(`Animation references unknown object: ${animation.objectId}`);
      }
    }

    // Build final scene
    const scene: AnimationScene = {
      duration: sceneNode.data.duration,
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