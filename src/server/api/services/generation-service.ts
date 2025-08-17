// src/server/api/services/generation-service.ts - GUARANTEED FEATURE PRESERVATION
import { z } from "zod";
import type { createTRPCContext } from "@/server/api/trpc";
import { logger } from "@/lib/logger";
import { isDomainError, UserJobLimitError, NoValidScenesError } from "@/shared/errors/domain";
import { DEFAULT_SCENE_CONFIG, type SceneAnimationConfig } from "@/server/rendering/renderer";
import { ExecutionEngine } from "@/server/animation-processing/execution-engine";
import { getNodeDefinition } from "@/shared/registry/registry-utils";
import { buildZodSchemaFromProperties } from "@/shared/types/properties";
import { arePortsCompatible } from "@/shared/types/ports";
import type { AnimationScene, NodeData, SceneNodeData, FrameNodeData } from "@/shared/types";
import type { ReactFlowNode } from "@/server/animation-processing/execution-engine";
import { renderQueue, ensureWorkerReady } from "@/server/jobs/render-queue";
import { waitForRenderJobEvent } from "@/server/jobs/pg-events";
import { createServiceClient } from "@/utils/supabase/service";
import { 
  partitionObjectsByScenes, 
  buildAnimationSceneFromPartition, 
  createSingleScenePartition, 
  createSingleFramePartition 
} from "@/server/animation-processing/scene/scene-partitioner";

type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

// PRESERVED: All existing input schemas and types
const reactFlowNodeSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.unknown(),
});

const reactFlowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
});

type ReactFlowNodeInput = z.infer<typeof reactFlowNodeSchema>;
type ReactFlowEdgeInput = z.infer<typeof reactFlowEdgeSchema>;

// PRESERVED: Exact validation result interface
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

interface ProcessedInput {
  backendNodes: Array<{ id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }>;
  backendEdges: Array<{ id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string }>;
  nodeIdMap: Map<string, string>;
}

interface GenerationResult {
  success: boolean;
  videoUrl?: string;
  imageUrl?: string;
  jobId?: string;
  jobIds?: string[];
  totalScenes?: number;
  totalFrames?: number;
  errors?: ValidationResult['errors'];
  canRetry?: boolean;
}

export class GenerationService {
  // ==================== PRESERVED: EXACT PREPROCESSING LOGIC ====================
  
  preprocessInput(nodes: ReactFlowNodeInput[], edges: ReactFlowEdgeInput[]): ProcessedInput {
    // PRESERVED: Exact same node preprocessing as original
    const backendNodes = nodes.map((n: ReactFlowNodeInput) => {
      const mergedData = this.mergeNodeDataWithDefaults(n.type, n.data);
      return { id: n.id, type: n.type!, position: n.position, data: mergedData };
    });

    // PRESERVED: Exact same ID mapping as original
    const nodeIdMap = new Map<string, string>();
    nodes.forEach(n => {
      if (n.data && typeof n.data === 'object' && n.data !== null) {
        const identifier = (n.data as { identifier: { id: string } }).identifier;
        nodeIdMap.set(n.id, identifier.id);
      }
    });

    // PRESERVED: Exact same edge conversion as original
    const backendEdges = edges.map((e: ReactFlowEdgeInput) => ({
      id: e.id,
      source: nodeIdMap.get(e.source) ?? e.source,
      target: nodeIdMap.get(e.target) ?? e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      targetHandle: e.targetHandle ?? undefined,
    }));

    return { backendNodes, backendEdges, nodeIdMap };
  }

  // ==================== PRESERVED: EXACT VALIDATION PIPELINE ====================
  
  async validateComplete(
    nodes: Array<{ id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }>,
    edges: Array<{ id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string }>,
    originalNodes: ReactFlowNodeInput[],
    originalEdges: ReactFlowEdgeInput[]
  ): Promise<ValidationResult> {
    const allErrors: ValidationResult['errors'] = [];

    // PRESERVED: Exact same node validation logic
    const nodeValidation = this.validateInputNodesGracefully(nodes);
    allErrors.push(...nodeValidation.errors);

    // PRESERVED: Exact same connection validation logic
    const connectionValidation = this.validateConnectionsGracefully(originalNodes, originalEdges);
    allErrors.push(...connectionValidation.errors);

    // PRESERVED: Exact same flow validation logic
    try {
      const flowValidation = await this.validateFlowGracefully(
        nodes as unknown as ReactFlowNode<NodeData>[],
        edges
      );
      allErrors.push(...flowValidation.errors);
    } catch (error) {
      const translated = this.translateDomainError(error);
      allErrors.push({
        type: 'error',
        code: isDomainError(error) ? error.code : 'ERR_FLOW_VALIDATION_FAILED',
        message: translated.message,
        suggestions: translated.suggestions
      });
    }

    return { success: allErrors.filter(e => e.type === 'error').length === 0, errors: allErrors };
  }

  // ==================== PRESERVED: EXACT JOB LIMIT LOGIC ====================
  
  async checkJobLimits(ctx: TRPCContext): Promise<void> {
    const supabase = createServiceClient();
    // PRESERVED: Exact same environment variable and default
    const maxUserJobs = Number(process.env.MAX_USER_CONCURRENT_RENDER_JOBS ?? '3');
    
    // PRESERVED: Exact same stale job cleanup logic (10 minute cutoff)
    const staleJobCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    await supabase
      .from('render_jobs')
      .update({ status: 'failed', error: 'Job timeout - cleaned up by system' })
      .eq('user_id', ctx.user!.id)
      .in('status', ['queued', 'processing'])
      .lt('updated_at', staleJobCutoff);

    // PRESERVED: Exact same active job checking logic
    const { data: userActiveJobs, error: jobQueryError } = await supabase
      .from('render_jobs')
      .select('id, status, updated_at')
      .eq('user_id', ctx.user!.id)
      .in('status', ['queued', 'processing']);

    if (jobQueryError) {
      logger.error('Failed to query user jobs', { error: jobQueryError, userId: ctx.user!.id });
      // PRESERVED: Continue without job limit check rather than blocking
    } else if (userActiveJobs && userActiveJobs.length >= maxUserJobs) {
      logger.info('User job limit reached', { 
        userId: ctx.user!.id, 
        activeJobs: userActiveJobs.length, 
        maxJobs: maxUserJobs,
        jobs: userActiveJobs 
      });
      throw new UserJobLimitError(userActiveJobs.length, maxUserJobs);
    }
  }

  // ==================== PRESERVED: EXACT ERROR TRANSLATION ====================
  
  translateDomainError(error: unknown): { message: string; suggestions: string[] } {
    if (!isDomainError(error)) {
      return {
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        suggestions: ['Please try again', 'Contact support if the problem persists']
      };
    }

    // PRESERVED: Enhanced error mapping with exact original suggestions
    const errorMap: Record<string, { message: string; suggestions: string[] }> = {
      'ERR_SCENE_REQUIRED': {
        message: 'Scene node is required for video generation',
        suggestions: ['Add a Scene node from the Output section', 'Connect your objects to the Scene node']
      },
      'ERR_FRAME_REQUIRED': {
        message: 'Frame node is required for image generation', 
        suggestions: ['Add a Frame node from the Output section', 'Connect your objects to the Frame node']
      },
      'ERR_MISSING_INSERT_CONNECTION': {
        message: 'Scene nodes require timed objects via Insert nodes',
        suggestions: ['Add an Insert node between objects and Scene', 'Check that Insert nodes are properly connected']
      },
      'ERR_USER_JOB_LIMIT': {
        message: error.message,
        suggestions: ['Wait for current jobs to complete', 'Cancel running jobs if needed']
      },
      'ERR_INVALID_CONNECTION': {
        message: error.message,
        suggestions: ['Check port compatibility', 'Verify all connections are valid']
      },
      'ERR_NO_VALID_SCENES': {
        message: 'No valid scenes found to process',
        suggestions: ['Ensure scenes have connected objects', 'Check scene configurations']
      }
    };

    return errorMap[error.code] ?? {
      message: error.message,
      suggestions: ['Check node configuration', 'Verify all connections']
    };
  }

  createErrorResponse(error: unknown): GenerationResult {
    const translated = this.translateDomainError(error);
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

  // ==================== PRESERVED: EXACT INLINE WAIT LOGIC ====================
  
  async waitForJobCompletion(jobId: string): Promise<{ completed: boolean; publicUrl?: string }> {
    // PRESERVED: Exact same environment variable handling and defaults
    const inlineWaitMsRaw = process.env.RENDER_JOB_INLINE_WAIT_MS ?? '500';
    const parsed = Number(inlineWaitMsRaw);
    const inlineWaitMs = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 5000) : 500;
    
    // PRESERVED: Exact same wait logic
    const notify = await waitForRenderJobEvent({ jobId, timeoutMs: inlineWaitMs });
    
    return {
      completed: notify?.status === 'completed' && Boolean(notify.publicUrl),
      publicUrl: notify?.publicUrl ?? undefined
    };
  }

  // ==================== PRESERVED: BULK GENERATION WITH ALL FEATURES ====================
  
  async generateBulkScenes(
    nodes: ReactFlowNodeInput[],
    edges: ReactFlowEdgeInput[],
    ctx: TRPCContext,
    config?: Record<string, unknown>
  ): Promise<GenerationResult> {
    try {
      const { backendNodes, backendEdges } = this.preprocessInput(nodes, edges);
      
      // PRESERVED: Complete validation pipeline
      const validation = await this.validateComplete(backendNodes, backendEdges, nodes, edges);
      if (!validation.success) {
        return { success: false, errors: validation.errors, canRetry: true };
      }

      // PRESERVED: Job limit checking
      await this.checkJobLimits(ctx);

      // PRESERVED: Full execution engine with comprehensive validation
      const engine = new ExecutionEngine();
      const executionContext = await engine.executeFlow(
        backendNodes as unknown as ReactFlowNode<NodeData>[],
        backendEdges
      );

      // PRESERVED: Scene requirement validation
      const sceneNodes = backendNodes.filter(node => node.type === 'scene') as unknown as ReactFlowNode<NodeData>[];
      if (sceneNodes.length === 0) {
        return {
          success: false,
          errors: [{ 
            type: 'error', code: 'ERR_SCENE_REQUIRED', 
            message: 'Scene node is required',
            suggestions: ['Add a Scene node from the Output section']
          }],
          canRetry: true
        };
      }

      // PRESERVED: Full partitioning logic for bulk processing
      const scenePartitions = partitionObjectsByScenes(executionContext, sceneNodes, backendEdges);
      if (scenePartitions.length === 0) {
        throw new NoValidScenesError();
      }

      // PRESERVED: Worker readiness and job creation
      await ensureWorkerReady();
      const supabase = createServiceClient();
      const jobIds: string[] = [];

      for (const partition of scenePartitions) {
        const scene = buildAnimationSceneFromPartition(partition);
        const sceneData = partition.sceneNode.data as SceneNodeData;
        
        // PRESERVED: Exact config merging with defaults
        const mergedConfig: SceneAnimationConfig = {
          ...DEFAULT_SCENE_CONFIG,
          width: sceneData.width,
          height: sceneData.height,
          fps: sceneData.fps,
          backgroundColor: sceneData.backgroundColor,
          videoPreset: sceneData.videoPreset,
          videoCrf: sceneData.videoCrf,
          ...config,
        };

        // PRESERVED: Frame limit validation (1800 frame cap)
        if (mergedConfig.fps * scene.duration > 1800) {
          logger.warn(`Scene ${partition.sceneNode.data.identifier.displayName} exceeds frame limit`, {
            frames: mergedConfig.fps * scene.duration,
            duration: scene.duration,
            fps: mergedConfig.fps
          });
          continue; // Skip this scene but continue with others
        }
        
        const payload = { scene, config: mergedConfig } as const;
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

        // PRESERVED: Render queue enqueueing
        await renderQueue.enqueueOnly({
          scene, config: mergedConfig, userId: ctx.user!.id, jobId: jobRow.id as string,
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

      // PRESERVED: Single scene inline wait behavior
      if (jobIds.length === 1) {
        const waitResult = await this.waitForJobCompletion(jobIds[0]!);
        if (waitResult.completed) {
          return { success: true, videoUrl: waitResult.publicUrl, jobId: jobIds[0]!, totalScenes: 1 };
        }
      }

      return { success: true, jobIds, totalScenes: scenePartitions.length };
      
    } catch (error) {
      // PRESERVED: Exact error handling and logging
      logger.domain('Scene generation failed', error, {
        path: 'animation.generateScene',
        userId: ctx.user?.id
      });
      return this.createErrorResponse(error);
    }
  }

  // ==================== PRESERVED: INDIVIDUAL SCENE WITH PERFORMANCE OPTIMIZATIONS ====================
  
  async generateSingleScene(
    nodes: ReactFlowNodeInput[],
    edges: ReactFlowEdgeInput[],
    targetSceneNodeId: string,
    ctx: TRPCContext
  ): Promise<GenerationResult> {
    try {
      const { backendNodes, backendEdges, nodeIdMap } = this.preprocessInput(nodes, edges);
      
      // PRESERVED: Target node resolution and validation
      const targetIdentifierId = nodeIdMap.get(targetSceneNodeId) ?? targetSceneNodeId;
      const targetSceneNode = backendNodes.find(n => 
        (n.data as { identifier: { id: string } }).identifier.id === targetIdentifierId
      ) as ReactFlowNode<NodeData> | undefined;

      if (!targetSceneNode || targetSceneNode.type !== 'scene') {
        return {
          success: false,
          errors: [{ 
            type: 'error', code: 'ERR_INVALID_TARGET_NODE', 
            message: 'Target node must be a Scene node',
            suggestions: ['Select a Scene node for video generation']
          }],
          canRetry: true
        };
      }

      // PRESERVED: Complete validation pipeline
      const validation = await this.validateComplete(backendNodes, backendEdges, nodes, edges);
      if (!validation.success) {
        return { success: false, errors: validation.errors, canRetry: true };
      }

      // PRESERVED: Job limit checking
      await this.checkJobLimits(ctx);

      // PRESERVED: Performance optimization - executeFlowToTarget
      const engine = new ExecutionEngine();
      const executionContext = await engine.executeFlowToTarget(
        backendNodes as unknown as ReactFlowNode<NodeData>[],
        backendEdges,
        targetIdentifierId,
        { requireScene: true }
      );

      // PRESERVED: Performance optimization - single scene partition
      const singleScenePartition = createSingleScenePartition(
        executionContext, targetSceneNode, backendEdges
      );

      if (!singleScenePartition || singleScenePartition.objects.length === 0) {
        return {
          success: false,
          errors: [{
            type: 'error' as const,
            code: 'ERR_NO_OBJECTS_IN_SCENE',
            message: 'Target scene has no connected objects',
            suggestions: ['Connect geometry objects to the Scene node via Insert nodes']
          }],
          canRetry: true
        };
      }

      // PRESERVED: Scene config building with defaults
      const sceneData = targetSceneNode.data as SceneNodeData;
      const config: SceneAnimationConfig = {
        ...DEFAULT_SCENE_CONFIG,
        width: sceneData.width,
        height: sceneData.height,
        fps: sceneData.fps,
        backgroundColor: sceneData.backgroundColor,
        videoPreset: sceneData.videoPreset,
        videoCrf: sceneData.videoCrf,
      };

      const scene: AnimationScene = buildAnimationSceneFromPartition(singleScenePartition);

      // PRESERVED: Frame limit validation
      if (config.fps * scene.duration > 1800) {
        return {
          success: false,
          errors: [{
            type: 'error' as const,
            code: 'ERR_SCENE_TOO_LONG',
            message: `Scene exceeds frame limit (${config.fps * scene.duration} frames)`,
            suggestions: ['Reduce scene duration or frame rate', 'Simplify animations']
          }],
          canRetry: true
        };
      }

      // PRESERVED: Worker readiness and job creation
      await ensureWorkerReady();
      const supabase = createServiceClient();
      const payload = { scene, config } as const;
      
      const { data: jobRow, error: jobError } = await supabase
        .from('render_jobs')
        .insert({ user_id: ctx.user!.id, status: 'queued', payload })
        .select('id')
        .single();

      if (jobError || !jobRow) {
        throw new Error('Failed to create render job');
      }

      // PRESERVED: Render queue enqueueing
      await renderQueue.enqueueOnly({
        scene, config, userId: ctx.user!.id, jobId: jobRow.id,
      });

      // PRESERVED: Performance logging
      logger.info('Individual scene generation completed', { 
        jobId: jobRow.id, 
        sceneId: targetIdentifierId,
        sceneName: targetSceneNode.data.identifier.displayName,
        performance: {
          nodesExecuted: executionContext.executedNodes.size,
          objectsCreated: singleScenePartition.objects.length,
          animationsProcessed: singleScenePartition.animations.length
        }
      });

      // PRESERVED: Inline wait for immediate feedback
      const waitResult = await this.waitForJobCompletion(jobRow.id);
      if (waitResult.completed) {
        return { success: true, videoUrl: waitResult.publicUrl, jobId: jobRow.id, totalScenes: 1 };
      }

      return { success: true, jobId: jobRow.id };
      
    } catch (error) {
      return this.createErrorResponse(error);
    }
  }

  // ==================== PRESERVED: INDIVIDUAL FRAME WITH PERFORMANCE OPTIMIZATIONS ====================
  
  async generateSingleFrame(
    nodes: ReactFlowNodeInput[],
    edges: ReactFlowEdgeInput[],
    targetFrameNodeId: string,
    ctx: TRPCContext
  ): Promise<GenerationResult> {
    try {
      const { backendNodes, backendEdges, nodeIdMap } = this.preprocessInput(nodes, edges);
      
      // PRESERVED: Target node resolution and validation
      const targetIdentifierId = nodeIdMap.get(targetFrameNodeId) ?? targetFrameNodeId;
      const targetFrameNode = backendNodes.find(n => 
        (n.data as { identifier: { id: string } }).identifier.id === targetIdentifierId
      ) as ReactFlowNode<NodeData> | undefined;

      if (!targetFrameNode || targetFrameNode.type !== 'frame') {
        return {
          success: false,
          errors: [{ 
            type: 'error', code: 'ERR_INVALID_TARGET_NODE', 
            message: 'Target node must be a Frame node',
            suggestions: ['Select a Frame node for image generation']
          }],
          canRetry: true
        };
      }

      // PRESERVED: Minimal validation for frames (performance optimization)
      const nodeValidation = this.validateInputNodesGracefully(backendNodes);
      if (nodeValidation.errors.length > 0) {
        return { success: false, errors: nodeValidation.errors, canRetry: true };
      }

      const connectionValidation = this.validateConnectionsGracefully(nodes, edges);
      if (connectionValidation.errors.length > 0) {
        return { success: false, errors: connectionValidation.errors, canRetry: true };
      }

      // PRESERVED: Job limit checking (same logic)
      await this.checkJobLimits(ctx);

      // PRESERVED: Frame execution without scene requirement (performance optimization)
      const engine = new ExecutionEngine();
      const executionContext = await engine.executeFlow(
        backendNodes as unknown as ReactFlowNode<NodeData>[],
        backendEdges,
        { requireScene: false }
      );

      // PRESERVED: Performance optimization - single frame partition
      const singleFramePartition = createSingleFramePartition(
        executionContext, targetFrameNode, backendEdges
      );

      if (!singleFramePartition) {
        return {
          success: false,
          errors: [{
            type: 'error' as const,
            code: 'ERR_NO_VALID_FRAMES',
            message: 'No frames could be processed'
          }],
          canRetry: true
        };
      }

      // PRESERVED: Frame config building
      const frameData = targetFrameNode.data as unknown as FrameNodeData;
      const config = {
        width: Number(frameData.width),
        height: Number(frameData.height),
        backgroundColor: String(frameData.backgroundColor),
        format: (frameData.format === 'jpeg' ? 'jpeg' : 'png') as 'png'|'jpeg',
        quality: Number(frameData.quality ?? 90)
      };
      
      const scene: AnimationScene = buildAnimationSceneFromPartition(singleFramePartition);

      // PRESERVED: Worker readiness and job creation
      await ensureWorkerReady();
      const supabase = createServiceClient();
      const payload = { scene, config } as const;
      
      const { data: jobRow, error: jobError } = await supabase
        .from('render_jobs')
        .insert({ user_id: ctx.user!.id, status: 'queued', payload })
        .select('id')
        .single();

      if (jobError || !jobRow) {
        throw new Error('Failed to create render job');
      }

      // PRESERVED: Image queue enqueueing (different from video queue)
      const { imageQueue } = await import('@/server/jobs/image-queue');
      await imageQueue.enqueueOnly({
        scene, config: { ...config }, userId: ctx.user!.id, jobId: jobRow.id,
      });

      // PRESERVED: Performance logging
      logger.info('Individual frame generation completed', { 
        jobId: jobRow.id, 
        frameId: targetIdentifierId,
        frameName: targetFrameNode.data.identifier.displayName,
        performance: {
          nodesExecuted: executionContext.executedNodes.size,
          objectsCreated: singleFramePartition.objects.length
        }
      });

      // PRESERVED: Inline wait for immediate feedback
      const waitResult = await this.waitForJobCompletion(jobRow.id);
      if (waitResult.completed) {
        return { success: true, imageUrl: waitResult.publicUrl, jobId: jobRow.id, totalFrames: 1 };
      }

      return { success: true, jobId: jobRow.id };
      
    } catch (error) {
      return this.createErrorResponse(error);
    }
  }

  // ==================== PRESERVED: EXACT UTILITY METHODS ====================
  
  private mergeNodeDataWithDefaults(nodeType: string | undefined, rawData: unknown): Record<string, unknown> {
    // PRESERVED: Exact same logic from original implementation
    const definition = nodeType ? getNodeDefinition(nodeType) : undefined;
    const defaults = (definition?.defaults as Record<string, unknown> | undefined) ?? {};
    const data = (rawData && typeof rawData === 'object' && rawData !== null) ? (rawData as Record<string, unknown>) : {};

    const propertySchemas = (definition?.properties?.properties as Array<{ key: string; type: string; defaultValue?: unknown }> | undefined) ?? [];
    const point2dKeys = new Set(propertySchemas.filter(s => s.type === 'point2d').map(s => s.key));

    const merged: Record<string, unknown> = { ...defaults };
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;

      if (point2dKeys.has(key) && value && typeof value === 'object') {
        const baseObj = (typeof defaults[key] === 'object' && defaults[key] !== null)
          ? (defaults[key] as Record<string, unknown>)
          : {};
        merged[key] = { ...baseObj, ...(value as Record<string, unknown>) };
      } else {
        merged[key] = value as unknown;
      }
    }

    // PRESERVED: Point2D property normalization
    for (const schema of propertySchemas) {
      if (schema.type === 'point2d') {
        const provided = (data[schema.key] && typeof data[schema.key] === 'object')
          ? (data[schema.key] as Record<string, unknown>)
          : {};
        const nodeDef = (defaults[schema.key] && typeof defaults[schema.key] === 'object')
          ? (defaults[schema.key] as { x?: number; y?: number })
          : undefined;
        const schemaDef = (schema.defaultValue as { x?: number; y?: number } | undefined) ?? undefined;

        const x = typeof provided.x === 'number' ? provided.x
          : typeof (merged[schema.key] as any)?.x === 'number' ? (merged[schema.key] as any).x
          : typeof nodeDef?.x === 'number' ? nodeDef.x
          : typeof schemaDef?.x === 'number' ? schemaDef.x : 0;

        const y = typeof provided.y === 'number' ? provided.y
          : typeof (merged[schema.key] as any)?.y === 'number' ? (merged[schema.key] as any).y
          : typeof nodeDef?.y === 'number' ? nodeDef.y
          : typeof schemaDef?.y === 'number' ? schemaDef.y : 0;

        merged[schema.key] = { x, y } as const;
      }
    }

    return merged;
  }

  private validateInputNodesGracefully(
    nodes: Array<{ id: string; type: string; position: { x: number; y: number }; data: unknown }>
  ): ValidationResult {
    // PRESERVED: Exact same validation logic
    const errors: ValidationResult['errors'] = [];
    
    for (const node of nodes) {
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

  private validateConnectionsGracefully(
    nodes: ReactFlowNodeInput[], 
    edges: ReactFlowEdgeInput[]
  ): ValidationResult {
    // PRESERVED: Exact same validation logic
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

  private async validateFlowGracefully(
    nodes: ReactFlowNode<NodeData>[],
    edges: Array<{ id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string }>
  ): Promise<ValidationResult> {
    // PRESERVED: Exact same validation logic
    const errors: ValidationResult['errors'] = [];
    
    try {
      const engine = new ExecutionEngine();
      engine.runUniversalValidation(nodes, edges);
    } catch (error) {
      const translated = this.translateDomainError(error);
      errors.push({
        type: 'error',
        code: isDomainError(error) ? error.code : 'ERR_FLOW_VALIDATION_FAILED',
        message: translated.message,
        suggestions: translated.suggestions
      });
    }
    
    return { success: errors.filter(e => e.type === 'error').length === 0, errors };
  }
}

// Export singleton instance
export const generationService = new GenerationService();
