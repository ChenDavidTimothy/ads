// src/server/api/routers/animation.ts - Graceful error handling with comprehensive validation + debug execution
import { z } from "zod";
import type { createTRPCContext } from "@/server/api/trpc";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/server/api/trpc";
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
import { renderQueue, ensureWorkerReady } from "@/server/jobs/render-queue";
import { waitForRenderJobEvent } from "@/server/jobs/pg-events";
import { createServiceClient } from "@/utils/supabase/service";

type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

// Scene config schema (coerce types where the client might send strings)
const sceneConfigSchema = z.object({
  width: z.coerce.number().max(1920).optional(),
  height: z.coerce.number().max(1080).optional(),
  fps: z.coerce.number().max(60).optional(),
  backgroundColor: z.string().optional(),
  videoPreset: z.string().optional(),
  videoCrf: z.coerce.number().min(0).max(51).optional(),
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

// ReactFlow Edge schema
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

// Debug execution schema
const debugExecutionInputSchema = z.object({
  nodes: z.array(reactFlowNodeSchema),
  edges: z.array(reactFlowEdgeSchema),
  targetNodeId: z.string(), // Stop execution at this node
});

type GenerateSceneInput = z.infer<typeof generateSceneInputSchema>;
type ValidateSceneInput = z.infer<typeof validateSceneInputSchema>;
type DebugExecutionInput = z.infer<typeof debugExecutionInputSchema>;
type ReactFlowNodeInput = z.infer<typeof reactFlowNodeSchema>;
type ReactFlowEdgeInput = z.infer<typeof reactFlowEdgeSchema>;

// Validation result type for graceful error handling
interface ValidationResult {
  success: boolean;
  errors: Array<{
    type: 'error' | 'warning';
    code: string;
    message: string;
    suggestions?: string[];
    nodeId?: string;
    nodeName?: string;
  }>;
}

// User-friendly error translation
function translateDomainError(error: unknown): { message: string; suggestions: string[] } {
  if (!isDomainError(error)) {
    return {
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      suggestions: ['Please check your node configuration and try again']
    };
  }

  switch (error.code) {
    case 'ERR_SCENE_REQUIRED':
      return {
        message: 'A Scene node is required to generate video',
        suggestions: [
          'Add a Scene node from the Output section in the node palette',
          'Connect your animation flow to the Scene node'
        ]
      };

    case 'ERR_TOO_MANY_SCENES':
      return {
        message: 'Only one Scene node is allowed per workspace',
        suggestions: [
          'Remove extra Scene nodes',
          'Keep only one Scene node as the final output'
        ]
      };

    case 'ERR_INVALID_CONNECTION':
      return {
        message: error.message || 'Invalid connection detected',
        suggestions: [
          'Check that port types are compatible',
          'Verify merge nodes have unique connections per input port',
          'Ensure all connected nodes exist'
        ]
      };

    case 'ERR_MISSING_INSERT_CONNECTION':
      return {
        message: error.message || 'Geometry objects need timing information',
        suggestions: [
          'Connect geometry nodes through Insert nodes to control when they appear',
          'Insert nodes specify when objects become visible in the timeline'
        ]
      };

    case 'ERR_MULTIPLE_INSERT_NODES_IN_SERIES':
      return {
        message: error.message || 'Multiple Insert nodes detected in the same path',
        suggestions: [
          'Objects can only have one appearance time',
          'Use separate paths for different timing',
          'Use a Merge node to combine objects with different timing'
        ]
      };

    case 'ERR_DUPLICATE_OBJECT_IDS':
      return {
        message: error.message || 'Objects reach the same destination through multiple paths',
        suggestions: [
          'Add a Merge node to combine objects before they reach non-merge nodes',
          'Merge nodes resolve conflicts when identical objects arrive from different paths',
          'Check your flow for branching that reconnects later'
        ]
      };

    case 'ERR_NODE_VALIDATION_FAILED':
      return {
        message: 'Some nodes have invalid properties',
        suggestions: [
          'Check the Properties panel for validation errors',
          'Verify all required fields are filled',
          'Ensure numeric values are within valid ranges'
        ]
      };

    case 'ERR_SCENE_VALIDATION_FAILED':
      return {
        message: 'Scene configuration has issues',
        suggestions: [
          'Check animation duration and frame limits',
          'Verify scene properties in the Properties panel',
          'Ensure total frames don\'t exceed system limits'
        ]
      };

    case 'ERR_CIRCULAR_DEPENDENCY':
      return {
        message: 'Circular connections detected in your node graph',
        suggestions: [
          'Remove connections that create loops',
          'Ensure data flows in one direction from geometry to scene',
          'Check for accidentally connected output back to input'
        ]
      };

    default:
      return {
        message: error.message || 'Validation error occurred',
        suggestions: ['Please review your node setup and connections']
      };
  }
}

export const animationRouter = createTRPCRouter({
  // Debug execution endpoint for "Run to Here" functionality
  debugToNode: protectedProcedure
    .input(debugExecutionInputSchema)
    .mutation(async ({ input, ctx }: { input: DebugExecutionInput; ctx: TRPCContext }) => {
      try {
        // Convert React Flow nodes to backend format with proper ID mapping
        const backendNodes = input.nodes.map((n: ReactFlowNodeInput) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: n.data ?? {},
        }));

        // Convert React Flow edges to backend format with identifier ID mapping
        const nodeIdMap = new Map<string, string>();
        input.nodes.forEach(n => {
          if (n.data && typeof n.data === 'object' && n.data !== null) {
            const identifier = (n.data as { identifier?: { id?: string } }).identifier;
            if (identifier?.id) {
              nodeIdMap.set(n.id, identifier.id);
            }
          }
        });

        const backendEdges = input.edges.map((e: ReactFlowEdgeInput) => ({
          id: e.id,
          source: nodeIdMap.get(e.source) ?? e.source,
          target: nodeIdMap.get(e.target) ?? e.target,
          sourceHandle: e.sourceHandle ?? undefined,
          targetHandle: e.targetHandle ?? undefined,
        }));

        // Get target node identifier ID
        const targetReactFlowId = input.targetNodeId;
        const targetIdentifierId = nodeIdMap.get(targetReactFlowId) ?? targetReactFlowId;

        // Execute flow with debug stopping point
        const engine = new ExecutionEngine();
        const executionContext = await engine.executeFlowDebug(
          backendNodes as ReactFlowNode<NodeData>[],
          backendEdges,
          targetIdentifierId
        );

        // Extract debug logs from context and format for frontend consumption
        const debugLogs = (executionContext.executionLog || [])
          .filter(entry => entry.data && typeof entry.data === 'object' && 
                  (entry.data as { type?: string }).type === 'print_output')
          .map(entry => {
            return {
              nodeId: entry.nodeId,
              timestamp: entry.timestamp,
              action: entry.action,
              data: entry.data // Keep the full data structure for frontend processing
            };
          });

        return {
          success: true,
          executedNodeCount: executionContext.executedNodes.size,
          debugLogs,
          stoppedAt: targetIdentifierId
        };

      } catch (error) {
        // Log server-side error
        logger.domain('Debug execution failed', error, {
          path: 'animation.debugToNode',
          userId: ctx.user?.id,
          targetNodeId: input.targetNodeId
        });

        // Return error information
        const translated = translateDomainError(error);
        return {
          success: false,
          error: translated.message,
          suggestions: translated.suggestions
        };
      }
    }),

  // Main scene generation with comprehensive graceful validation
  generateScene: protectedProcedure
    .input(generateSceneInputSchema)
    .mutation(async ({ input, ctx }: { input: GenerateSceneInput; ctx: TRPCContext }) => {
      try {
        // Convert React Flow nodes to backend format with proper ID mapping
        const backendNodes = input.nodes.map((n: ReactFlowNodeInput) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: n.data ?? {},
        }));

        // Convert React Flow edges to backend format with identifier ID mapping
        const nodeIdMap = new Map<string, string>();
        input.nodes.forEach(n => {
          if (n.data && typeof n.data === 'object' && n.data !== null) {
            const identifier = (n.data as { identifier?: { id?: string } }).identifier;
            if (identifier?.id) {
              nodeIdMap.set(n.id, identifier.id);
            }
          }
        });

        const backendEdges = input.edges.map((e: ReactFlowEdgeInput) => ({
          id: e.id,
          source: nodeIdMap.get(e.source) ?? e.source,
          target: nodeIdMap.get(e.target) ?? e.target,
          sourceHandle: e.sourceHandle ?? undefined,
          targetHandle: e.targetHandle ?? undefined,
        }));

        // Registry-aware node validation with graceful error collection
        const nodeValidationResult = validateInputNodesGracefully(backendNodes);
        if (!nodeValidationResult.success) {
          return {
            success: false,
            errors: nodeValidationResult.errors,
            canRetry: true
          };
        }

        // Connection validation with graceful error handling
        const connectionValidationResult = validateConnectionsGracefully(input.nodes, input.edges);
        if (!connectionValidationResult.success) {
          return {
            success: false,
            errors: connectionValidationResult.errors,
            canRetry: true
          };
        }

        // Comprehensive flow validation with graceful error handling
        const flowValidationResult = await validateFlowGracefully(
          backendNodes as ReactFlowNode<NodeData>[],
          backendEdges
        );
        if (!flowValidationResult.success) {
          return {
            success: false,
            errors: flowValidationResult.errors,
            canRetry: true
          };
        }

        // If we get here, validation passed - proceed with generation
        const engine = new ExecutionEngine();
        const executionContext = await engine.executeFlow(
          backendNodes as ReactFlowNode<NodeData>[],
          backendEdges,
        );

        const sceneNode = findSceneNode(backendNodes);
        if (!sceneNode) {
          return {
            success: false,
            errors: [{
              type: 'error' as const,
              code: 'ERR_SCENE_REQUIRED',
              message: 'Scene node is required',
              suggestions: ['Add a Scene node from the Output section']
            }],
            canRetry: true
          };
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

        // Enforce total frame cap
        if (config.fps * totalDuration > 1800) {
          return {
            success: false,
            errors: [{
              type: 'error' as const,
              code: 'ERR_SCENE_VALIDATION_FAILED',
              message: `Animation too long: ${config.fps * totalDuration} frames exceeds limit of 1800`,
              suggestions: [
                'Reduce scene duration',
                'Lower frame rate',
                'Split into multiple shorter animations'
              ]
            }],
            canRetry: true
          };
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
          return {
            success: false,
            errors: [{
              type: 'error' as const,
              code: 'ERR_RENDER_QUEUE_FAILED',
              message: 'Failed to queue render job',
              suggestions: ['Please try again', 'Check your internet connection']
            }],
            canRetry: true
          };
        }

        await ensureWorkerReady();
        await renderQueue.enqueueOnly({
          scene,
          config,
          userId: ctx.user!.id,
          jobId: jobRow.id,
        });

        // Wait briefly for immediate completion
        const inlineWaitMsRaw = process.env.RENDER_JOB_INLINE_WAIT_MS ?? '500';
        const parsed = Number(inlineWaitMsRaw);
        const inlineWaitMs = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 5000) : 500;
        const notify = await waitForRenderJobEvent({ jobId: jobRow.id, timeoutMs: inlineWaitMs });
        
        if (notify && notify.status === 'completed' && notify.publicUrl) {
          return {
            success: true,
            videoUrl: notify.publicUrl,
            scene,
            config,
          } as const;
        }
        
        return {
          success: true,
          jobId: jobRow.id,
          scene,
          config,
        } as const;

      } catch (error) {
        // Log server-side error
        logger.domain('Scene generation failed', error, {
          path: 'animation.generateScene',
          userId: ctx.user?.id
        });

        // Graceful error response
        const translated = translateDomainError(error);
        return {
          success: false,
          errors: [{
            type: 'error' as const,
            code: isDomainError(error) ? error.code : 'ERR_UNKNOWN',
            message: translated.message,
            suggestions: translated.suggestions
          }],
          canRetry: true
        };
      }
    }),

  // Enhanced validation endpoint with graceful error reporting
  validateScene: protectedProcedure
    .input(validateSceneInputSchema)
    .query(async ({ input }: { input: ValidateSceneInput }) => {
      const backendNodes = input.nodes.map((n: ReactFlowNodeInput) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data ?? {},
      }));

      const nodeIdMap = new Map<string, string>();
      input.nodes.forEach(n => {
        if (n.data && typeof n.data === 'object' && n.data !== null) {
          const identifier = (n.data as { identifier?: { id?: string } }).identifier;
          if (identifier?.id) {
            nodeIdMap.set(n.id, identifier.id);
          }
        }
      });

      const backendEdges = input.edges.map((e) => ({
        id: e.id,
        source: nodeIdMap.get(e.source) ?? e.source,
        target: nodeIdMap.get(e.target) ?? e.target,
        sourceHandle: e.sourceHandle ?? undefined,
        targetHandle: e.targetHandle ?? undefined,
      }));

      const allErrors: ValidationResult['errors'] = [];

      // Node validation
      const nodeValidation = validateInputNodesGracefully(backendNodes);
      allErrors.push(...nodeValidation.errors);

      // Connection validation
      const connectionValidation = validateConnectionsGracefully(input.nodes, input.edges);
      allErrors.push(...connectionValidation.errors);

      // Flow validation
      try {
        const flowValidation = await validateFlowGracefully(
          backendNodes as ReactFlowNode<NodeData>[],
          backendEdges
        );
        allErrors.push(...flowValidation.errors);
      } catch (error) {
        const translated = translateDomainError(error);
        allErrors.push({
          type: 'error',
          code: isDomainError(error) ? error.code : 'ERR_VALIDATION_FAILED',
          message: translated.message,
          suggestions: translated.suggestions
        });
      }

      return {
        valid: allErrors.filter(e => e.type === 'error').length === 0,
        errors: allErrors
      };
    }),

  // Registry information endpoints (unchanged)
  getNodeDefinitions: publicProcedure.query(() => {
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

  getRenderJobStatus: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input, ctx }: { input: { jobId: string }; ctx: TRPCContext }) => {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from('render_jobs')
        .select('status, output_url, error')
        .eq('id', input.jobId)
        .eq('user_id', ctx.user!.id)
        .single();
      if (error) {
        throw new Error(error.message);
      }
      
      if (data?.status !== 'completed' || !data?.output_url) {
        const notify = await waitForRenderJobEvent({ jobId: input.jobId, timeoutMs: 25000 });
        if (notify && notify.status === 'completed' && notify.publicUrl) {
          return { status: 'completed', videoUrl: notify.publicUrl, error: null } as const;
        }
      }
      return { status: data?.status ?? 'unknown', videoUrl: data?.output_url ?? null, error: data?.error ?? null } as const;
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

// Graceful validation helper functions
function validateInputNodesGracefully(
  nodes: Array<{ id: string; type?: string; position: { x: number; y: number }; data: unknown }>
): ValidationResult {
  const errors: ValidationResult['errors'] = [];
  
  for (const node of nodes) {
    if (!node.type) {
      errors.push({
        type: 'error',
        code: 'ERR_MISSING_NODE_TYPE',
        message: `Node ${node.id} has no type specified`,
        nodeId: node.id
      });
      continue;
    }
    
    const definition = getNodeDefinition(node.type);
    if (!definition) {
      errors.push({
        type: 'error',
        code: 'ERR_UNKNOWN_NODE_TYPE',
        message: `Unknown node type: ${node.type}`,
        nodeId: node.id
      });
      continue;
    }
    
    const schema = buildZodSchemaFromProperties(definition.properties.properties);
    const result = schema.safeParse(node.data);
    if (!result.success) {
      const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
      errors.push({
        type: 'error',
        code: 'ERR_NODE_PROPERTY_VALIDATION',
        message: `Node property validation failed: ${issues}`,
        nodeId: node.id,
        suggestions: ['Check the Properties panel for this node', 'Verify all required fields are filled']
      });
    }
  }
  
  return { success: errors.filter(e => e.type === 'error').length === 0, errors };
}

function validateConnectionsGracefully(
  nodes: ReactFlowNodeInput[], 
  edges: ReactFlowEdgeInput[]
): ValidationResult {
  const errors: ValidationResult['errors'] = [];
  
  for (const edge of edges) {
    const source = nodes.find((n) => n.id === edge.source);
    const target = nodes.find((n) => n.id === edge.target);
    
    if (!source || !target) {
      errors.push({
        type: 'error',
        code: 'ERR_INVALID_CONNECTION',
        message: `Connection references non-existent nodes: ${edge.source} -> ${edge.target}`,
        suggestions: ['Remove invalid connections', 'Ensure all connected nodes exist']
      });
      continue;
    }
    
    const sourceDef = getNodeDefinition(source.type ?? "");
    const targetDef = getNodeDefinition(target.type ?? "");
    
    if (!sourceDef || !targetDef) {
      errors.push({
        type: 'error',
        code: 'ERR_INVALID_CONNECTION',
        message: `Unknown node types in connection: ${source.type} -> ${target.type}`,
        suggestions: ['Check node types are valid']
      });
      continue;
    }
    
    if ((edge as { kind?: 'data' | 'control' }).kind === 'control') continue;
    
    const sourcePort = sourceDef.ports.outputs.find(p => p.id === edge.sourceHandle);
    const targetPort = targetDef.ports.inputs.find(p => p.id === edge.targetHandle);
    
    if (sourcePort && targetPort && !arePortsCompatible(sourcePort.type, targetPort.type)) {
      errors.push({
        type: 'error',
        code: 'ERR_INVALID_CONNECTION',
        message: `Port types incompatible: ${sourcePort.type} → ${targetPort.type}`,
        suggestions: [
          'Connect compatible port types',
          'Check the node documentation for port compatibility'
        ]
      });
    }
  }
  
  return { success: errors.filter(e => e.type === 'error').length === 0, errors };
}

async function validateFlowGracefully(
  nodes: ReactFlowNode<NodeData>[],
  edges: Array<{ id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string }>
): Promise<ValidationResult> {
  const errors: ValidationResult['errors'] = [];
  
  try {
    const engine = new ExecutionEngine();
    await engine.executeFlow(nodes, edges);
  } catch (error) {
    const translated = translateDomainError(error);
    errors.push({
      type: 'error',
      code: isDomainError(error) ? error.code : 'ERR_FLOW_VALIDATION_FAILED',
      message: translated.message,
      suggestions: translated.suggestions
    });
  }
  
  return { success: errors.filter(e => e.type === 'error').length === 0, errors };
}

function findSceneNode(
  nodes: Array<{ id: string; type?: string; position: { x: number; y: number }; data: unknown }>
): typeof nodes[0] | null {
  const outputNodes = getNodesByCategory('output');
  const sceneNodeTypes = outputNodes.filter(def => def.type === 'scene').map(def => def.type);
  
  return nodes.find(node => node.type && sceneNodeTypes.includes(node.type)) ?? null;
}