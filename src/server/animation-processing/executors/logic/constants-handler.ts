import { setNodeOutput, type ExecutionContext } from '../../execution-context';
import type { ReactFlowNode, ReactFlowEdge } from '../../types/graph';
import type { NodeData } from '@/shared/types';
import { logger } from '@/lib/logger';

export async function executeConstantsNode(
  node: ReactFlowNode<NodeData>,
  context: ExecutionContext,
  _connections: ReactFlowEdge[]
): Promise<void> {
  const data = node.data as unknown as Record<string, unknown>;
  const valueType = data.valueType as string;

  let outputValue: unknown;
  let logicType: string;

  switch (valueType) {
    case 'number':
      outputValue = Number(data.numberValue);
      logicType = 'number';
      break;
    case 'string':
      outputValue =
        typeof data.stringValue === 'string' ? data.stringValue : (data.stringValue ?? '');
      logicType = 'string';
      break;
    case 'boolean':
      outputValue = (data.booleanValue as string) === 'true';
      logicType = 'boolean';
      break;
    case 'color':
      outputValue =
        typeof data.colorValue === 'string' ? data.colorValue : (data.colorValue ?? '#ffffff');
      logicType = 'color';
      break;
    default:
      outputValue = 0;
      logicType = 'number';
      logger.warn(`Unknown value type: ${valueType}, defaulting to number 0`);
  }

  logger.debug(
    `Constants ${node.data.identifier.displayName}: ${valueType} = ${String(outputValue)}`
  );

  setNodeOutput(context, node.data.identifier.id, 'output', 'data', outputValue, {
    logicType,
    validated: true,
  });
}
