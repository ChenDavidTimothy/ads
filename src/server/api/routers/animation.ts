// src/server/api/routers/animation.ts - Updated with FlowTracker support
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import {
  generateSceneAnimation,
  DEFAULT_SCENE_CONFIG,
  type SceneAnimationConfig,
} from "@/animation/scene-generator";
import { validateScene } from "@/shared/types";
import { ExecutionEngine } from "@/server/animation-processing/execution-engine";
import type { AnimationScene, NodeData, SceneNodeData } from "@/shared/types";
import type { ReactFlowNode } from "@/server/animation-processing/execution-engine";

// Scene config schema
const sceneConfigSchema = z.object({
  width: z.number().optional(),
  height: z.number().optional(),
  fps: z.number().optional(),
  backgroundColor: z.string().optional(),
  videoPreset: z.string().optional(),
  videoCrf: z.number().optional(),
});

// ReactFlow Node schema - flexible data property to accommodate all node types
const reactFlowNodeSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  data: z.record(z.unknown()), // Flexible to accommodate all node properties
});

// ReactFlow Edge schema
const reactFlowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
});

// FlowTracker EdgeFlow schema
const edgeFlowSchema = z.object({
  edgeId: z.string(),
  sourceNodeId: z.string(),
  targetNodeId: z.string(),
  sourcePort: z.string(),
  targetPort: z.string(),
  availableNodeIds: z.array(z.string()),
  selectedNodeIds: z.array(z.string()),
  timestamp: z.number(),
});

// FlowTracker data schema
const flowTrackerSchema = z.record(edgeFlowSchema);

export const animationRouter = createTRPCRouter({
  // Main scene-based endpoint - UPDATED to accept FlowTracker data
  generateScene: publicProcedure
    .input(
      z.object({
        nodes: z.array(reactFlowNodeSchema),
        edges: z.array(reactFlowEdgeSchema),
        flowTracker: flowTrackerSchema.optional(), // NEW: FlowTracker edge filtering data
        config: sceneConfigSchema.optional(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        // Use backend ExecutionEngine to process the graph with FlowTracker data
        const engine = new ExecutionEngine();
        const executionContext = await engine.executeFlow(
          input.nodes as unknown as ReactFlowNode<NodeData>[],
          input.edges,
          input.flowTracker // Pass FlowTracker data to execution engine
        );

        // Find scene node to get configuration
        const sceneNode = input.nodes.find((node) => node.type === "scene");
        if (!sceneNode) {
          throw new Error("Scene node is required");
        }

        const sceneData = sceneNode.data as unknown as SceneNodeData;

        // Calculate total duration
        const maxAnimationTime =
          executionContext.sceneAnimations.length > 0
            ? Math.max(
                ...executionContext.sceneAnimations.map(
                  (anim) => anim.startTime + anim.duration,
                ),
              )
            : 0;
        const totalDuration = Math.max(maxAnimationTime, sceneData.duration);

        // Build AnimationScene from execution context
        const scene: AnimationScene = {
          duration: totalDuration,
          objects: executionContext.sceneObjects as any[], // Type assertion for SceneObject[]
          animations: executionContext.sceneAnimations,
          background: {
            color: sceneData.backgroundColor,
          },
        };

        // Prepare scene config
        const config: SceneAnimationConfig = {
          ...DEFAULT_SCENE_CONFIG,
          width: sceneData.width,
          height: sceneData.height,
          fps: sceneData.fps,
          backgroundColor: sceneData.backgroundColor,
          videoPreset: sceneData.videoPreset,
          videoCrf: sceneData.videoCrf,
          ...input.config,
        };

        const videoUrl = await generateSceneAnimation(scene, config);

        return {
          success: true,
          videoUrl,
          scene,
          config,
        };
      } catch (error) {
        console.error("Scene animation generation failed:", error);
        throw new Error(
          error instanceof Error
            ? `Scene animation generation failed: ${error.message}`
            : "Scene animation generation failed with unknown error",
        );
      }
    }),

  // Utility endpoints
  getDefaultSceneConfig: publicProcedure.query(() => {
    return DEFAULT_SCENE_CONFIG;
  }),

  getDefaultTriangleConfig: publicProcedure.query(() => {
    return {
      width: 1920,
      height: 1080,
      fps: 60,
      duration: 3,
      triangleSize: 80,
      margin: 100,
      rotations: 2,
      backgroundColor: "#000000",
      triangleColor: "#ff4444",
      strokeColor: "#ffffff",
      strokeWidth: 3,
      videoPreset: "medium",
      videoCrf: 18,
    };
  }),

  validateScene: publicProcedure
    .input(
      z.object({
        nodes: z.array(reactFlowNodeSchema),
        edges: z.array(reactFlowEdgeSchema),
        flowTracker: flowTrackerSchema.optional(),
      }),
    )
    .query(async ({ input }) => {
      try {
        const engine = new ExecutionEngine();
        const executionContext = await engine.executeFlow(
          input.nodes as unknown as ReactFlowNode<NodeData>[],
          input.edges,
          input.flowTracker
        );

        // Build scene for validation
        const sceneNode = input.nodes.find((node) => node.type === "scene");
        if (!sceneNode) {
          return { valid: false, errors: ["Scene node is required"] };
        }

        const sceneData = sceneNode.data as unknown as SceneNodeData;
        const maxAnimationTime =
          executionContext.sceneAnimations.length > 0
            ? Math.max(
                ...executionContext.sceneAnimations.map(
                  (anim) => anim.startTime + anim.duration,
                ),
              )
            : 0;
        const totalDuration = Math.max(maxAnimationTime, sceneData.duration);

        const scene: AnimationScene = {
          duration: totalDuration,
          objects: executionContext.sceneObjects,
          animations: executionContext.sceneAnimations,
          background: { color: sceneData.backgroundColor },
        };

        const errors = validateScene(scene);
        return { valid: errors.length === 0, errors };
      } catch (error) {
        return {
          valid: false,
          errors: [
            error instanceof Error ? error.message : "Unknown validation error",
          ],
        };
      }
    }),
});