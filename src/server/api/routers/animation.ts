// src/server/api/routers/animation.ts - Graceful error handling with comprehensive validation + debug execution
import { z } from "zod";
import type { createTRPCContext } from "@/server/api/trpc";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/server/api/trpc";
import { logger } from "@/lib/logger";
import { isDomainError, UserJobLimitError, NoValidScenesError } from "@/shared/errors/domain";
import { DEFAULT_SCENE_CONFIG, type SceneAnimationConfig } from "@/server/rendering/renderer";
import { ExecutionEngine } from "@/server/animation-processing/execution-engine";
import { getNodeDefinition, getNodesByCategory } from "@/shared/registry/registry-utils";
import { buildZodSchemaFromProperties } from "@/shared/types/properties";
import { arePortsCompatible } from "@/shared/types/ports";
import type { AnimationScene, NodeData, SceneNodeData } from "@/shared/types";
import type { ReactFlowNode } from "@/server/animation-processing/execution-engine";
import { renderQueue, ensureWorkerReady } from "@/server/jobs/render-queue";
import { waitForRenderJobEvent } from "@/server/jobs/pg-events";
import { createServiceClient } from "@/utils/supabase/service";
import { partitionObjectsByScenes, buildAnimationSceneFromPartition } from "@/server/animation-processing/scene/scene-partitioner";

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
      const sceneCount = error.details?.info?.sceneCount as number | undefined;
      const maxAllowed = error.details?.info?.maxAllowed as number | undefined;
      return {
        message: maxAllowed 
          ? `Maximum ${maxAllowed} scenes per execution (found ${sceneCount ?? 'multiple'})`
          : 'Too many Scene nodes in workspace',
        suggestions: [
          'Reduce the number of Scene nodes',
          'Split complex flows into separate executions',
          'Consider using fewer scenes for better performance'
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

    case 'ERR_USER_JOB_LIMIT':
      const currentJobs = error.details?.info?.currentJobs as number | undefined;
      const maxJobs = error.details?.info?.maxJobs as number | undefined;
      return {
        message: maxJobs 
          ? `Maximum ${maxJobs} concurrent render jobs per user${currentJobs ? ` (currently: ${currentJobs})` : ''}`
          : 'Too many concurrent render jobs',
        suggestions: [
          'Wait for current jobs to complete before starting new ones',
          'Check your job status to see which jobs are still running',
          'Consider reducing the complexity of your animations'
        ]
      };

    case 'ERR_NO_VALID_SCENES':
      return {
        message: 'No scenes received valid data',
        suggestions: [
          'Ensure your geometry objects are connected to Scene nodes',
          'Check that Insert nodes are properly connected',
          'Verify that your flow produces valid objects'
        ]
      };

    case 'ERR_MULTIPLE_RESULT_VALUES':
      return {
        message: 'Result node received multiple values simultaneously',
        suggestions: [
          'Use If-Else or Boolean logic to ensure only one path executes',
          'Check that conditional branches don\'t execute simultaneously',
          'Verify logic flow produces single result'
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
             const identifier = (n.data as { identifier: { id: string } }).identifier;
             nodeIdMap.set(n.id, identifier.id);
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
        const executionLog = executionContext.executionLog ?? [];
        const debugLogs = executionLog
          .filter(entry => {
            return entry.data && 
                   typeof entry.data === 'object' && 
                   entry.data !== null &&
                   (entry.data as { type?: string }).type === 'result_output';
          })
          .map(entry => {
            const entryData = entry.data as { type: string; [key: string]: unknown };
            return {
              nodeId: entry.nodeId,
              timestamp: entry.timestamp,
              action: entry.action,
              data: entryData
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

        // Return detailed error information using the same translation as generate video
        const translated = translateDomainError(error);
        return {
          success: false,
          error: translated.message,
          suggestions: translated.suggestions,
          // Add additional context for debugging
          errorType: isDomainError(error) ? error.code : 'ERR_DEBUG_EXECUTION_FAILED'
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
             const identifier = (n.data as { identifier: { id: string } }).identifier;
             nodeIdMap.set(n.id, identifier.id);
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

        // Find all scene nodes for multi-scene support
        const sceneNodes = backendNodes.filter((node: ReactFlowNodeInput) => node.type === 'scene') as ReactFlowNode<NodeData>[];
        if (sceneNodes.length === 0) {
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

        // Check user job limits before processing
        const supabase = createServiceClient();
        const maxUserJobs = Number(process.env.MAX_USER_JOBS ?? '3');
        
        // First, clean up stale jobs (older than 10 minutes in queued/processing state)
        const staleJobCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        await supabase
          .from('render_jobs')
          .update({ status: 'failed', error: 'Job timeout - cleaned up by system' })
          .eq('user_id', ctx.user!.id)
          .in('status', ['queued', 'processing'])
          .lt('updated_at', staleJobCutoff);

        // Now check current active jobs
        const { data: userActiveJobs, error: jobQueryError } = await supabase
          .from('render_jobs')
          .select('id, status, updated_at')
          .eq('user_id', ctx.user!.id)
          .in('status', ['queued', 'processing']);

        if (jobQueryError) {
          logger.error('Failed to query user jobs', { error: jobQueryError, userId: ctx.user!.id });
          // Continue without job limit check rather than blocking the user
        } else if (userActiveJobs && userActiveJobs.length >= maxUserJobs) {
          logger.info('User job limit reached', { 
            userId: ctx.user!.id, 
            activeJobs: userActiveJobs.length, 
            maxJobs: maxUserJobs,
            jobs: userActiveJobs 
          });
          throw new UserJobLimitError(userActiveJobs.length, maxUserJobs);
        }

        // Partition objects by scenes
        const scenePartitions = partitionObjectsByScenes(executionContext, sceneNodes, backendEdges);
        
        if (scenePartitions.length === 0) {
          throw new NoValidScenesError();
        }

        // Create render jobs for each valid scene
        const jobIds: string[] = [];
        await ensureWorkerReady();

        for (const partition of scenePartitions) {
          const scene: AnimationScene = buildAnimationSceneFromPartition(partition);
          const sceneData = partition.sceneNode.data as SceneNodeData;
          
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

          // Enforce frame cap per scene
          if (config.fps * scene.duration > 1800) {
            logger.warn(`Scene ${partition.sceneNode.data.identifier.displayName} exceeds frame limit`, {
              frames: config.fps * scene.duration,
              duration: scene.duration,
              fps: config.fps
            });
            continue; // Skip this scene but continue with others
          }

          // Create job row for this scene
          const payload = { scene, config } as const;
          const { data: jobRow, error: insErr } = await supabase
            .from('render_jobs')
            .insert({ user_id: ctx.user!.id, status: 'queued', payload })
            .select('id')
            .single();
          
          if (insErr || !jobRow) {
            logger.error('Failed to create job row for scene', {
              sceneId: partition.sceneNode.data.identifier.id,
              error: insErr
            });
            continue; // Skip this scene but continue with others
          }

          // Enqueue the render job
          await renderQueue.enqueueOnly({
            scene,
            config,
            userId: ctx.user!.id,
            jobId: jobRow.id as string,
          });

          jobIds.push(jobRow.id as string);
        }

        if (jobIds.length === 0) {
          return {
            success: false,
            errors: [{
              type: 'error' as const,
              code: 'ERR_NO_VALID_SCENES',
              message: 'No scenes could be processed',
              suggestions: [
                'Check that scenes have valid objects',
                'Ensure scene durations are within limits',
                'Verify scene configurations'
              ]
            }],
            canRetry: true
          };
        }

        // For single scene, maintain backward compatibility with immediate polling
        if (jobIds.length === 1) {
          const inlineWaitMsRaw = process.env.RENDER_JOB_INLINE_WAIT_MS ?? '500';
          const parsed = Number(inlineWaitMsRaw);
          const inlineWaitMs = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 5000) : 500;
          const notify = await waitForRenderJobEvent({ jobId: jobIds[0]!, timeoutMs: inlineWaitMs });
          
          if (notify && notify.status === 'completed' && notify.publicUrl) {
            return {
              success: true,
              videoUrl: notify.publicUrl,
              jobId: jobIds[0]!,
              totalScenes: 1,
            } as const;
          }
        }
        
        return {
          success: true,
          jobIds,
          totalScenes: scenePartitions.length,
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
           const identifier = (n.data as { identifier: { id: string } }).identifier;
           nodeIdMap.set(n.id, identifier.id);
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
      
      // If job is already completed, return immediately
      if (data?.status === 'completed' && data?.output_url) {
        return { status: 'completed', videoUrl: data.output_url, error: null } as const;
      }
      
      // Only wait for pgBoss event if job is still processing
      if (data?.status === 'queued' || data?.status === 'processing') {
        const notify = await waitForRenderJobEvent({ jobId: input.jobId, timeoutMs: 25000 });
        if (notify && notify.status === 'completed' && notify.publicUrl) {
          return { status: 'completed', videoUrl: notify.publicUrl, error: null } as const;
        }
      }
      return { 
        status: (data?.status as string) ?? 'unknown', 
        videoUrl: (data?.output_url as string) ?? null, 
        error: (data?.error as string) ?? null 
      } as const;
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
    // Use universal validation only - don't require Scene node for general validation
    engine.runUniversalValidation(nodes, edges);
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

