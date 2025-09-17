import { protectedProcedure } from '@/server/api/trpc';
import {
  convertBackendNodeToReactFlowNode,
  createNodeIdMap,
  mergeNodeDataWithDefaults,
  type BackendNode,
  type BackendEdge,
} from '@/server/animation-processing/flow-transformers';
import {
  translateDomainError,
  validateConnectionsGracefully,
  validateFlowGracefully,
  validateInputNodesGracefully,
} from '@/server/animation-processing/validators/scene-validation';
import { isDomainError } from '@/shared/errors/domain';
import type { AnimationTRPCContext } from '../context';
import {
  validateSceneInputSchema,
  type ValidateSceneInput,
  type ReactFlowNodeInput,
  type ReactFlowEdgeInput,
} from '../schemas';

export const validateSceneProcedure = protectedProcedure
  .input(validateSceneInputSchema)
  .query(async ({ input }: { input: ValidateSceneInput; ctx: AnimationTRPCContext }) => {
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

    const allErrors: ReturnType<typeof validateInputNodesGracefully>['errors'] = [];

    const nodeValidation = validateInputNodesGracefully(backendNodes);
    allErrors.push(...nodeValidation.errors);

    const connectionValidation = validateConnectionsGracefully(input.nodes, input.edges);
    allErrors.push(...connectionValidation.errors);

    try {
      const reactFlowNodesForFlowValidation = backendNodes.map(convertBackendNodeToReactFlowNode);
      const flowValidation = await validateFlowGracefully(
        reactFlowNodesForFlowValidation,
        backendEdges
      );
      allErrors.push(...flowValidation.errors);
    } catch (error) {
      const translated = translateDomainError(error);
      allErrors.push({
        type: 'error' as const,
        code: isDomainError(error) ? error.code : 'ERR_VALIDATION_FAILED',
        message: translated.message,
        suggestions: translated.suggestions,
      });
    }

    return {
      valid: allErrors.filter((err) => err.type === 'error').length === 0,
      errors: allErrors,
    } as const;
  });
