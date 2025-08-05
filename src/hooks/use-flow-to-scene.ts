// src/hooks/use-flow-to-scene.ts
import { useCallback } from "react";
import type { Node, Edge } from "reactflow";
import type { AnimationScene } from "@/animation/scene/scene";
import type { NodeData } from "@/lib/types/nodes";
import { ExecutionEngine } from "@/lib/execution/execution-engine";

export function useFlowToScene() {
  const convertFlowToScene = useCallback(async (
    nodes: Node<NodeData>[], 
    edges: Edge[]
  ): Promise<AnimationScene | null> => {
    try {
      const engine = new ExecutionEngine();
      const context = await engine.executeFlow(nodes, edges);
      
      // Find scene configuration
      const sceneNode = nodes.find(node => node.type === "scene");
      if (!sceneNode) {
        throw new Error("Scene node is required");
      }
      
      const sceneData = sceneNode.data as any;
      
      // Calculate total duration
      const maxAnimationTime = context.sceneAnimations.length > 0 
        ? Math.max(...context.sceneAnimations.map(anim => anim.startTime + anim.duration))
        : 0;
      const totalDuration = Math.max(maxAnimationTime, sceneData.duration);
      
      // Validate object references
      const objectIds = new Set(context.sceneObjects.map(obj => obj.id));
      for (const animation of context.sceneAnimations) {
        if (!objectIds.has(animation.objectId)) {
          throw new Error(`Animation references unknown object: ${animation.objectId}`);
        }
      }
      
      // Build scene
      const scene: AnimationScene = {
        duration: totalDuration,
        objects: context.sceneObjects,
        animations: context.sceneAnimations,
        background: {
          color: sceneData.backgroundColor,
        },
      };
      
      return scene;
    } catch (error) {
      console.error('Flow to scene conversion failed:', error);
      throw error;
    }
  }, []);

  return { convertFlowToScene };
}