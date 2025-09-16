import { protectedProcedure } from "@/server/api/trpc";
import { logger } from "@/lib/logger";
import { ExecutionEngine } from "@/server/animation-processing/execution-engine";
import {
  convertBackendNodeToReactFlowNode,
  createNodeIdMap,
  mergeNodeDataWithDefaults,
  type BackendNode,
  type BackendEdge,
} from "@/server/animation-processing/flow-transformers";
import {
  translateDomainError,
  validateConnectionsGracefully,
  validateFlowGracefully,
  validateInputNodesGracefully,
} from "@/server/animation-processing/validators/scene-validation";
import {
  partitionObjectsByScenes,
} from "@/server/animation-processing/scene/scene-partitioner";
import {
  isDomainError,
  NoValidScenesError,
  UserJobLimitError,
} from "@/shared/errors/domain";
import { createServiceClient } from "@/utils/supabase/service";
import { generateVideoJobsWithAssetCache } from "@/server/rendering/jobs/asset-cache-service";
import type { AnimationTRPCContext } from "../context";
import {
  generateSceneInputSchema,
  type GenerateSceneInput,
  type ReactFlowNodeInput,
  type ReactFlowEdgeInput,
} from "../schemas";

export const generateSceneProcedure = protectedProcedure
  .input(generateSceneInputSchema)
  .mutation(async ({ input, ctx }: { input: GenerateSceneInput; ctx: AnimationTRPCContext }) => {
    try {
      const backendNodes: BackendNode[] = input.nodes.map(
        (node: ReactFlowNodeInput) => ({
          id: node.id,
          type: node.type,
          position: node.position,
          data: mergeNodeDataWithDefaults(node.type, node.data),
        }),
      );

      const nodeIdMap = createNodeIdMap(input.nodes);
      const backendEdges: BackendEdge[] = input.edges.map(
        (edge: ReactFlowEdgeInput) => ({
          id: edge.id,
          source: nodeIdMap.get(edge.source) ?? edge.source,
          target: nodeIdMap.get(edge.target) ?? edge.target,
          sourceHandle: edge.sourceHandle ?? undefined,
          targetHandle: edge.targetHandle ?? undefined,
        }),
      );

      const nodeValidationResult = validateInputNodesGracefully(backendNodes);
      if (!nodeValidationResult.success) {
        return {
          success: false,
          errors: nodeValidationResult.errors,
          canRetry: true,
        } as const;
      }

      const connectionValidationResult = validateConnectionsGracefully(
        input.nodes,
        input.edges,
      );
      if (!connectionValidationResult.success) {
        return {
          success: false,
          errors: connectionValidationResult.errors,
          canRetry: true,
        } as const;
      }

      const reactFlowNodesForValidation = backendNodes.map(
        convertBackendNodeToReactFlowNode,
      );
      const flowValidationResult = await validateFlowGracefully(
        reactFlowNodesForValidation,
        backendEdges,
      );
      if (!flowValidationResult.success) {
        return {
          success: false,
          errors: flowValidationResult.errors,
          canRetry: true,
        } as const;
      }

      const engine = new ExecutionEngine();
      const reactFlowNodesForExecution = backendNodes.map(
        convertBackendNodeToReactFlowNode,
      );
      const executionContext = await engine.executeFlow(
        reactFlowNodesForExecution,
        backendEdges,
      );

      const sceneNodes = reactFlowNodesForExecution.filter(
        (node) => node.type === "scene",
      );

      if (sceneNodes.length === 0) {
        return {
          success: false,
          errors: [
            {
              type: "error" as const,
              code: "ERR_SCENE_REQUIRED",
              message: "Scene node is required",
              suggestions: ["Add a Scene node from the Output section"],
            },
          ],
          canRetry: true,
        } as const;
      }

      const supabase = createServiceClient();
      const maxUserJobs = Number(process.env.MAX_USER_JOBS ?? "3");
      const staleJobCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      await supabase
        .from("render_jobs")
        .update({
          status: "failed",
          error: "Job timeout - cleaned up by system",
        })
        .eq("user_id", ctx.user!.id)
        .in("status", ["queued", "processing"])
        .lt("updated_at", staleJobCutoff);

      const { data: userActiveJobs, error: jobQueryError } = await supabase
        .from("render_jobs")
        .select("id, status, updated_at")
        .eq("user_id", ctx.user!.id)
        .in("status", ["queued", "processing"]);

      if (jobQueryError) {
        logger.error("Failed to query user jobs", {
          error: jobQueryError,
          userId: ctx.user!.id,
        });
      } else if (userActiveJobs && userActiveJobs.length >= maxUserJobs) {
        logger.info("User job limit reached", {
          userId: ctx.user!.id,
          activeJobs: userActiveJobs.length,
          maxJobs: maxUserJobs,
          jobs: userActiveJobs,
        });
        throw new UserJobLimitError(userActiveJobs.length, maxUserJobs);
      }

      const scenePartitions = partitionObjectsByScenes(
        executionContext,
        sceneNodes,
        backendEdges,
      );

      if (scenePartitions.length === 0) {
        throw new NoValidScenesError();
      }

      const result = await generateVideoJobsWithAssetCache(
        scenePartitions,
        ctx.user!.id,
        input.config,
      );

      return result;
    } catch (error) {
      logger.domain("Scene generation failed", error, {
        path: "animation.generateScene",
        userId: ctx.user?.id,
      });

      const translated = translateDomainError(error);
      return {
        success: false,
        errors: [
          {
            type: "error" as const,
            code: isDomainError(error) ? error.code : "ERR_UNKNOWN",
            message: translated.message,
            suggestions: translated.suggestions,
          },
        ],
        canRetry: true,
      } as const;
    }
  });


