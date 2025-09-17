import { protectedProcedure } from '@/server/api/trpc';
import { logger } from '@/lib/logger';
import { ExecutionEngine } from '@/server/animation-processing/execution-engine';
import {
  convertBackendNodeToReactFlowNode,
  createNodeIdMap,
  mergeNodeDataWithDefaults,
  type BackendNode,
  type BackendEdge,
} from '@/server/animation-processing/flow-transformers';
import { translateDomainError } from '@/server/animation-processing/validators/scene-validation';
import { isDomainError } from '@/shared/errors/domain';
import type { AnimationTRPCContext } from '../context';
import {
  debugExecutionInputSchema,
  type DebugExecutionInput,
  type ReactFlowNodeInput,
  type ReactFlowEdgeInput,
} from '../schemas';

export const debugToNodeProcedure = protectedProcedure
  .input(debugExecutionInputSchema)
  .mutation(async ({ input, ctx }: { input: DebugExecutionInput; ctx: AnimationTRPCContext }) => {
    try {
      const backendNodes: BackendNode[] = input.nodes.map((node: ReactFlowNodeInput) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: mergeNodeDataWithDefaults(node.type, node.data),
      }));

      const nodeIdMap = createNodeIdMap(input.nodes);

      const backendEdges: BackendEdge[] = input.edges.map((edge: ReactFlowEdgeInput) => ({
        id: edge.id,
        source: nodeIdMap.get(edge.source) ?? edge.source,
        target: nodeIdMap.get(edge.target) ?? edge.target,
        sourceHandle: edge.sourceHandle ?? undefined,
        targetHandle: edge.targetHandle ?? undefined,
      }));

      const targetReactFlowId = input.targetNodeId;
      const targetIdentifierId = nodeIdMap.get(targetReactFlowId) ?? targetReactFlowId;

      const engine = new ExecutionEngine();
      const reactFlowNodes = backendNodes.map(convertBackendNodeToReactFlowNode);
      const executionContext = await engine.executeFlowDebug(
        reactFlowNodes,
        backendEdges,
        targetIdentifierId
      );

      const executionLog = executionContext.executionLog ?? [];
      const debugLogs = executionLog
        .filter((entry) => {
          return (
            entry.data &&
            typeof entry.data === 'object' &&
            entry.data !== null &&
            (entry.data as { type?: string }).type === 'result_output'
          );
        })
        .map((entry) => {
          const entryData = entry.data as {
            type: string;
            [key: string]: unknown;
          };
          return {
            nodeId: entry.nodeId,
            timestamp: entry.timestamp,
            action: entry.action,
            data: entryData,
          };
        });

      return {
        success: true,
        executedNodeCount: executionContext.executedNodes.size,
        debugLogs,
        stoppedAt: targetIdentifierId,
      } as const;
    } catch (error) {
      logger.domain('Debug execution failed', error, {
        path: 'animation.debugToNode',
        userId: ctx.user?.id,
        targetNodeId: input.targetNodeId,
      });

      const translated = translateDomainError(error);
      return {
        success: false,
        error: translated.message,
        suggestions: translated.suggestions,
        errorType: isDomainError(error) ? error.code : 'ERR_DEBUG_EXECUTION_FAILED',
      } as const;
    }
  });
