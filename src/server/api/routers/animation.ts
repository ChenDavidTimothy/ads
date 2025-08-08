// src/server/api/routers/animation.ts - Registry-aware animation router
import { z } from "zod";
import type { createTRPCContext } from "@/server/api/trpc";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/server/api/trpc";
import { logger as serverLogger } from "@/server/logger";
import { logger } from "@/lib/logger";
import { isDomainError, NodeValidationError, SceneValidationError } from "@/shared/errors/domain";
import { DEFAULT_SCENE_CONFIG, type SceneAnimationConfig } from "@/server/rendering/renderer";
import { validateScene } from "@/shared/types";
import { ExecutionEngine } from "@/server/animation-processing/execution-engine";
import { getNodeDefinition, getNodesByCategory } from "@/shared/registry/registry-utils";
import { buildZodSchemaFromProperties } from "@/shared/types/properties";
import { arePortsCompatible } from "@/shared/types/ports";
import type { AnimationScene, NodeData, SceneNodeData } from "@/shared/types";
import type { ReactFlowNode } from "@/server/animation-processing/execution-engine";
import { renderQueue } from "@/server/jobs/render-queue";
import { createServiceClient } from "@/utils/supabase/service";

type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

// Scene config schema (unchanged)
const sceneConfigSchema = z.object({
  width: z.number().max(1920).optional(),
  height: z.number().max(1080).optional(),
  fps: z.number().max(60).optional(),
  backgroundColor: z.string().optional(),
  videoPreset: z.string().optional(),
  videoCrf: z.number().min(0).max(51).optional(),
});

// Registry-aware ReactFlow Node schema
const reactFlowNodeSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  data: z.unknown(),
});

// ReactFlow Edge schema (unchanged)
const reactFlowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
});

const generateSceneInputSchema = z.object({
  nodes: z.array(reactFlowNodeSchema),
  edges: z.array(reactFlowEdgeSchema),
  config: sceneConfigSchema.optional(),
});

const validateSceneInputSchema = z.object({
  nodes: z.array(reactFlowNodeSchema),
  edges: z.array(reactFlowEdgeSchema),
});

type GenerateSceneInput = z.infer<typeof generateSceneInputSchema>;
type ValidateSceneInput = z.infer<typeof validateSceneInputSchema>;
type ReactFlowNodeInput = z.infer<typeof reactFlowNodeSchema>;
type ReactFlowEdgeInput = z.infer<typeof reactFlowEdgeSchema>;

export const animationRouter = createTRPCRouter({
  // Main scene-based endpoint - registry-aware
  generateScene: protectedProcedure
    .input(generateSceneInputSchema)
    .mutation(async ({ input, ctx }: { input: GenerateSceneInput; ctx: TRPCContext }) => {
      try {
        // Registry-aware node validation
        const normalizedNodesForValidation = input.nodes.map((n: ReactFlowNodeInput) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: n.data ?? {},
        }));
        const validationResult = validateInputNodes(normalizedNodesForValidation);
        if (!validationResult.valid) {
          throw new NodeValidationError(validationResult.errors);
        }

        // Validate connections by port compatibility
        const connectionErrors: string[] = [];
        for (const edge of input.edges as ReactFlowEdgeInput[]) {
          const source = input.nodes.find((n: ReactFlowNodeInput) => n.id === edge.source);
          const target = input.nodes.find((n: ReactFlowNodeInput) => n.id === edge.target);
          if (!source || !target) continue;
          const sourceDef = getNodeDefinition(source.type ?? "");
          const targetDef = getNodeDefinition(target.type ?? "");
          if (!sourceDef || !targetDef) continue;
          // Only validate data edges for port types; control edges will be used by a future scheduler
          if ((edge as { kind?: 'data' | 'control' }).kind === 'control') continue;
          const sourcePort = sourceDef.ports.outputs.find(p => p.id === edge.sourceHandle);
          const targetPort = targetDef.ports.inputs.find(p => p.id === edge.targetHandle);
          if (sourcePort && targetPort && !arePortsCompatible(sourcePort.type, targetPort.type)) {
            connectionErrors.push(`Edge ${edge.id}: ${source.type}.${edge.sourceHandle} (${sourcePort.type}) → ${target.type}.${edge.targetHandle} (${targetPort.type}) is incompatible`);
          }
        }
        if (connectionErrors.length > 0) {
          throw new NodeValidationError(connectionErrors);
        }

        // Use registry-aware ExecutionEngine
        const engine = new ExecutionEngine();
        const normalizedNodes = input.nodes.map((n: ReactFlowNodeInput) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: n.data ?? {},
        }));
        const normalizedEdges = input.edges.map((e: ReactFlowEdgeInput) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle ?? undefined,
          targetHandle: e.targetHandle ?? undefined,
        }));
        
        const executionContext = await engine.executeFlow(
          normalizedNodes as ReactFlowNode<NodeData>[],
          normalizedEdges,
        );

        // Registry-aware scene node lookup
        const sceneNode = findSceneNode(normalizedNodes);
        if (!sceneNode) {
          throw new SceneValidationError(["Scene node is required"]);
        }

        const sceneData = sceneNode.data as SceneNodeData;

        // Calculate total duration
        const maxAnimationTime =
          executionContext.sceneAnimations.length > 0
            ? Math.max(
                ...executionContext.sceneAnimations.map(
                  (anim) => anim.startTime + anim.duration,
                ),
              )
            : 0;
        const totalDuration = Math.min(
          Math.max(maxAnimationTime, sceneData.duration),
          15
        );

        // Build AnimationScene from execution context
        const scene: AnimationScene = {
          duration: totalDuration,
          objects: executionContext.sceneObjects,
          animations: executionContext.sceneAnimations,
          background: {
            color: sceneData.backgroundColor,
          },
        };

        // Prepare scene config using registry defaults
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
        // Enforce total frame cap: width/height/fps already bounded; cap duration as well
        if (config.fps * totalDuration > 1800) {
          throw new SceneValidationError([`Total frames exceed limit: ${config.fps * totalDuration} > 1800`]);
        }

        // Persist job row first
        const supabase = createServiceClient();
        const payload = { scene, config } as const;
        const { data: jobRow, error: insErr } = await supabase
          .from('render_jobs')
          .insert({ user_id: ctx.user!.id, status: 'queued', payload })
          .select('id')
          .single();
        if (insErr || !jobRow) {
          throw (insErr ?? new Error('Failed to create job'));
        }

        // Submit to queue
        const { publicUrl: videoUrl } = await renderQueue.enqueue({
          scene,
          config,
          userId: ctx.user!.id,
          jobId: jobRow.id as string,
        });

        return {
          success: true,
          videoUrl,
          scene,
          config,
        };
      } catch (error) {
        // Log server-side with structured logger
        if (isDomainError(error)) {
          logger.warn('Scene generation validation failed', { 
            path: 'animation.generateScene',
            userId: ctx.user?.id 
          }, error);
        } else {
          logger.error('Scene generation system error', { 
            path: 'animation.generateScene',
            userId: ctx.user?.id 
          }, error);
        }

        // Map domain errors to TRPC typed errors for the client
        if (isDomainError(error)) {
          throw new Error(error.message);
        }

        // Unknown/system error
        throw (error instanceof Error ? error : new Error('Scene animation generation failed'));
      }
    }),

  // Registry-aware scene validation endpoint
  validateScene: protectedProcedure
    .input(validateSceneInputSchema)
    .query(async ({ input }: { input: ValidateSceneInput }) => {
      try {
        // Registry-aware node validation
        const normalizedNodesForValidation = input.nodes.map((n: ReactFlowNodeInput) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: n.data ?? {},
        }));
        const nodeValidationResult = validateInputNodes(normalizedNodesForValidation);
        if (!nodeValidationResult.valid) {
          return { valid: false, errors: nodeValidationResult.errors };
        }

        // Registry-aware execution validation
        const engine = new ExecutionEngine();
        const normalizedNodes = input.nodes.map((n: ReactFlowNodeInput) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: n.data ?? {},
        }));
        const normalizedEdges = input.edges.map((e: ReactFlowEdgeInput) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle ?? undefined,
          targetHandle: e.targetHandle ?? undefined,
        }));
        const executionContext = await engine.executeFlow(
          normalizedNodes as ReactFlowNode<NodeData>[],
          normalizedEdges,
        );

        // Registry-aware scene node validation
        const sceneNode = findSceneNode(normalizedNodes);
        if (!sceneNode) {
          return { valid: false, errors: ["Scene node is required"] };
        }

        const sceneData = sceneNode.data as SceneNodeData;
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

  // Registry information endpoints
  getNodeDefinitions: publicProcedure.query(() => {
    // Future: Return registry definitions for dynamic UI generation
    const geometryNodes = getNodesByCategory('geometry');
    const timingNodes = getNodesByCategory('timing');
    const logicNodes = getNodesByCategory('logic');
    const animationNodes = getNodesByCategory('animation');
    const outputNodes = getNodesByCategory('output');
    
    return {
      geometry: geometryNodes,
      timing: timingNodes,
      logic: logicNodes,
      animation: animationNodes,
      output: outputNodes,
    };
  }),

  getNodeDefinition: publicProcedure
    .input(z.object({ nodeType: z.string() }))
    .query(({ input }: { input: { nodeType: string } }) => {
      const definition = getNodeDefinition(input.nodeType);
      if (!definition) {
        throw new Error(`Unknown node type: ${input.nodeType}`);
      }
      return definition;
    }),

  // Utility endpoints (unchanged)
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
});

// Registry-aware helper functions
function validateInputNodes(nodes: Array<{ id: string; type?: string; position: { x: number; y: number }; data: unknown }>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  for (const node of nodes) {
    if (!node.type) {
      errors.push(`Node ${node.id} has no type specified`);
      continue;
    }
    
    // Validate against registry
    const definition = getNodeDefinition(node.type);
    if (!definition) {
      errors.push(`Unknown node type: ${node.type}`);
      continue;
    }
    
    // Validate properties against generated Zod schema
    const schema = buildZodSchemaFromProperties(definition.properties.properties);
    const result = schema.safeParse(node.data as unknown);
    if (!result.success) {
      const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
      errors.push(`Node ${node.id} property validation failed: ${issues}`);
    }
  }
  
  return { valid: errors.length === 0, errors };
}

function findSceneNode(nodes: Array<{ id: string; type?: string; position: { x: number; y: number }; data: unknown }>): typeof nodes[0] | null {
  // Registry-aware scene node detection
  const outputNodes = getNodesByCategory('output');
  const sceneNodeTypes = outputNodes.filter(def => def.type === 'scene').map(def => def.type);
  
  return nodes.find(node => node.type && sceneNodeTypes.includes(node.type)) ?? null;
}

// Future: Registry-aware node capability detection
function getNodeCapabilities(nodeType: string): {
  canHandleConditionals: boolean;
  canModifyData: boolean;
  canCreateObjects: boolean;
  canControlFlow: boolean;
} {
  const definition = getNodeDefinition(nodeType);
  if (!definition) {
    return {
      canHandleConditionals: false,
      canModifyData: false,
      canCreateObjects: false,
      canControlFlow: false,
    };
  }
  
  return {
    canHandleConditionals: definition.execution.category === 'logic',
    canModifyData: ['logic', 'animation'].includes(definition.execution.category),
    canCreateObjects: definition.execution.category === 'geometry',
    canControlFlow: definition.execution.category === 'timing',
  };
}

// Future: Registry-aware flow analysis
function analyzeNodeFlow(
  nodes: Array<{ id: string; type?: string; position: { x: number; y: number }; data: Record<string, unknown> }>,
  edges: Array<{ id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string }>
): {
  hasGeometry: boolean;
  hasTiming: boolean;
  hasLogic: boolean;
  hasAnimation: boolean;
  hasOutput: boolean;
  flowComplexity: 'simple' | 'moderate' | 'complex';
} {
  const nodesByCategory = {
    geometry: 0,
    timing: 0,
    logic: 0,
    animation: 0,
    output: 0,
  };
  
  for (const node of nodes) {
    if (!node.type) continue;
    
    const definition = getNodeDefinition(node.type);
    if (definition) {
      nodesByCategory[definition.execution.category]++;
    }
  }
  
  const totalNodes = nodes.length;
  const totalEdges = edges.length;
  
  let flowComplexity: 'simple' | 'moderate' | 'complex' = 'simple';
  if (totalNodes > 10 || totalEdges > 15 || nodesByCategory.logic > 2) {
    flowComplexity = 'complex';
  } else if (totalNodes > 5 || totalEdges > 7 || nodesByCategory.logic > 0) {
    flowComplexity = 'moderate';
  }
  
  return {
    hasGeometry: nodesByCategory.geometry > 0,
    hasTiming: nodesByCategory.timing > 0,
    hasLogic: nodesByCategory.logic > 0,
    hasAnimation: nodesByCategory.animation > 0,
    hasOutput: nodesByCategory.output > 0,
    flowComplexity,
  };
}