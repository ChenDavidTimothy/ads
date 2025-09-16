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
  validateInputNodesGracefully,
} from "@/server/animation-processing/validators/scene-validation";
import { partitionObjectsByScenes } from "@/server/animation-processing/scene/scene-partitioner";
import { isDomainError, NoValidScenesError } from "@/shared/errors/domain";
import { generateImageJobsWithAssetCache } from "@/server/rendering/jobs/asset-cache-service";
import type { AnimationTRPCContext } from "../context";
import {
  generateSceneInputSchema,
  type GenerateSceneInput,
  type ReactFlowNodeInput,
  type ReactFlowEdgeInput,
} from "../schemas";

export const generateImageProcedure = protectedProcedure
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

      const engine = new ExecutionEngine();
      const reactFlowNodesForValidation = backendNodes.map(
        convertBackendNodeToReactFlowNode,
      );
      engine.runUniversalValidation(reactFlowNodesForValidation, backendEdges);

      const executionContext = await engine.executeFlow(
        reactFlowNodesForValidation,
        backendEdges,
        { requireScene: false },
      );

      const frameNodes = reactFlowNodesForValidation.filter(
        (node) => node.type === "frame",
      );

      if (frameNodes.length === 0) {
        return {
          success: false,
          errors: [
            {
              type: "error" as const,
              code: "ERR_FRAME_REQUIRED",
              message: "Frame node is required",
              suggestions: ["Add a Frame node from the Output section"],
            },
          ],
          canRetry: true,
        } as const;
      }

      const scenePartitions = partitionObjectsByScenes(
        executionContext,
        frameNodes,
        backendEdges,
      );
      if (scenePartitions.length === 0) {
        throw new NoValidScenesError();
      }

      const result = await generateImageJobsWithAssetCache(
        scenePartitions,
        ctx.user!.id,
      );

      return result;
    } catch (error) {
      logger.domain("Image generation failed", error, {
        path: "animation.generateImage",
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
