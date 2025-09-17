import {
  setNodeOutput,
  getTypedConnectedInput,
  getConnectedInput,
  type ExecutionContext,
} from '../../execution-context';
import type { ReactFlowNode, ReactFlowEdge } from '../../types/graph';
import type { NodeData } from '@/shared/types';
import { TypeValidationError } from '@/shared/types/validation';
import { logger } from '@/lib/logger';

export async function executeCompareNode(
  node: ReactFlowNode<NodeData>,
  context: ExecutionContext,
  connections: ReactFlowEdge[]
): Promise<void> {
  const data = node.data as unknown as {
    operator: 'gt' | 'lt' | 'eq' | 'neq' | 'gte' | 'lte';
  };

  let inputA: ReturnType<typeof getTypedConnectedInput<number>> | undefined;
  let inputB: ReturnType<typeof getTypedConnectedInput<number>> | undefined;

  try {
    inputA = getTypedConnectedInput<number>(
      context,
      connections as unknown as Array<{
        target: string;
        targetHandle: string;
        source: string;
        sourceHandle: string;
      }>,
      node.data.identifier.id,
      'input_a',
      'number'
    );
  } catch (error) {
    if (error instanceof TypeValidationError) {
      logger.error(
        `Type validation failed for input A in Compare node ${node.data.identifier.displayName}: ${error.message}`
      );
      throw error;
    }
    throw error;
  }

  try {
    inputB = getTypedConnectedInput<number>(
      context,
      connections as unknown as Array<{
        target: string;
        targetHandle: string;
        source: string;
        sourceHandle: string;
      }>,
      node.data.identifier.id,
      'input_b',
      'number'
    );
  } catch (error) {
    if (error instanceof TypeValidationError) {
      logger.error(
        `Type validation failed for input B in Compare node ${node.data.identifier.displayName}: ${error.message}`
      );
      throw error;
    }
    throw error;
  }

  if (!inputA || !inputB) {
    throw new Error(`Compare node ${node.data.identifier.displayName} missing required inputs`);
  }

  const valueA = inputA.data;
  const valueB = inputB.data;

  let result: boolean;
  switch (data.operator) {
    case 'gt':
      result = valueA > valueB;
      break;
    case 'lt':
      result = valueA < valueB;
      break;
    case 'eq':
      result = valueA === valueB;
      break;
    case 'neq':
      result = valueA !== valueB;
      break;
    case 'gte':
      result = valueA >= valueB;
      break;
    case 'lte':
      result = valueA <= valueB;
      break;
    default: {
      const _exhaustive: never = data.operator;
      throw new Error(`Unknown operator: ${String(_exhaustive)}`);
    }
  }

  logger.debug(
    `Compare ${node.data.identifier.displayName}: ${String(valueA)} ${data.operator} ${String(valueB)} = ${result}`
  );

  setNodeOutput(context, node.data.identifier.id, 'output', 'data', result, {
    logicType: 'boolean',
    validated: true,
  });
}

export async function executeIfElseNode(
  node: ReactFlowNode<NodeData>,
  context: ExecutionContext,
  connections: ReactFlowEdge[]
): Promise<void> {
  let condition: ReturnType<typeof getTypedConnectedInput<boolean>> | undefined;

  try {
    condition = getTypedConnectedInput<boolean>(
      context,
      connections as unknown as Array<{
        target: string;
        targetHandle: string;
        source: string;
        sourceHandle: string;
      }>,
      node.data.identifier.id,
      'condition',
      'boolean'
    );
  } catch (error) {
    if (error instanceof TypeValidationError) {
      logger.error(
        `Type validation failed for condition in If/Else node ${node.data.identifier.displayName}: ${error.message}`
      );
      throw error;
    }
    throw error;
  }

  if (!condition) {
    throw new Error(`If/Else node ${node.data.identifier.displayName} missing condition input`);
  }

  const dataInput = getConnectedInput(
    context,
    connections as unknown as Array<{
      target: string;
      targetHandle: string;
      source: string;
      sourceHandle: string;
    }>,
    node.data.identifier.id,
    'data'
  );

  if (!dataInput) {
    throw new Error(`If/Else node ${node.data.identifier.displayName} missing data input`);
  }

  if (condition.data) {
    setNodeOutput(context, node.data.identifier.id, 'true_path', 'data', dataInput.data);
    logger.debug(
      `If/Else ${node.data.identifier.displayName}: condition=true, routing data to true_path`
    );
  } else {
    setNodeOutput(context, node.data.identifier.id, 'false_path', 'data', dataInput.data);
    logger.debug(
      `If/Else ${node.data.identifier.displayName}: condition=false, routing data to false_path`
    );
  }
}

export async function executeBooleanOpNode(
  node: ReactFlowNode<NodeData>,
  context: ExecutionContext,
  connections: ReactFlowEdge[]
): Promise<void> {
  const data = node.data as unknown as {
    operator: 'and' | 'or' | 'not' | 'xor';
  };

  if (data.operator === 'not') {
    let input: ReturnType<typeof getTypedConnectedInput<boolean>> | undefined;

    try {
      input = getTypedConnectedInput<boolean>(
        context,
        connections as unknown as Array<{
          target: string;
          targetHandle: string;
          source: string;
          sourceHandle: string;
        }>,
        node.data.identifier.id,
        'input1',
        'boolean'
      );
    } catch (error) {
      if (error instanceof TypeValidationError) {
        logger.error(
          `Type validation failed for input in Boolean NOT node ${node.data.identifier.displayName}: ${error.message}`
        );
        throw error;
      }
      throw error;
    }

    if (!input) {
      throw new Error(`Boolean NOT node ${node.data.identifier.displayName} missing input`);
    }

    const result = !input.data;
    logger.debug(`Boolean NOT ${node.data.identifier.displayName}: !${input.data} = ${result}`);

    setNodeOutput(context, node.data.identifier.id, 'output', 'data', result, {
      logicType: 'boolean',
      validated: true,
    });
    return;
  }

  let inputA: ReturnType<typeof getTypedConnectedInput<boolean>> | undefined;
  let inputB: ReturnType<typeof getTypedConnectedInput<boolean>> | undefined;

  try {
    inputA = getTypedConnectedInput<boolean>(
      context,
      connections as unknown as Array<{
        target: string;
        targetHandle: string;
        source: string;
        sourceHandle: string;
      }>,
      node.data.identifier.id,
      'input1',
      'boolean'
    );
  } catch (error) {
    if (error instanceof TypeValidationError) {
      logger.error(
        `Type validation failed for input A in Boolean ${data.operator.toUpperCase()} node ${node.data.identifier.displayName}: ${error.message}`
      );
      throw error;
    }
    throw error;
  }

  try {
    inputB = getTypedConnectedInput<boolean>(
      context,
      connections as unknown as Array<{
        target: string;
        targetHandle: string;
        source: string;
        sourceHandle: string;
      }>,
      node.data.identifier.id,
      'input2',
      'boolean'
    );
  } catch (error) {
    if (error instanceof TypeValidationError) {
      logger.error(
        `Type validation failed for input B in Boolean ${data.operator.toUpperCase()} node ${node.data.identifier.displayName}: ${error.message}`
      );
      throw error;
    }
    throw error;
  }

  if (!inputA || !inputB) {
    throw new Error(
      `Boolean ${data.operator.toUpperCase()} node ${node.data.identifier.displayName} missing required inputs`
    );
  }

  const valueA = inputA.data;
  const valueB = inputB.data;

  let result: boolean;
  switch (data.operator) {
    case 'and':
      result = valueA && valueB;
      break;
    case 'or':
      result = valueA || valueB;
      break;
    case 'xor':
      result = valueA !== valueB;
      break;
    default: {
      const _exhaustive: never = data.operator;
      throw new Error(`Unknown boolean operator: ${String(_exhaustive)}`);
    }
  }

  logger.debug(
    `Boolean ${data.operator.toUpperCase()} ${node.data.identifier.displayName}: ${String(valueA)} ${data.operator} ${String(valueB)} = ${result}`
  );

  setNodeOutput(context, node.data.identifier.id, 'output', 'data', result, {
    logicType: 'boolean',
    validated: true,
  });
}

export async function executeMathOpNode(
  node: ReactFlowNode<NodeData>,
  context: ExecutionContext,
  connections: ReactFlowEdge[]
): Promise<void> {
  const data = node.data as unknown as {
    operator:
      | 'add'
      | 'subtract'
      | 'multiply'
      | 'divide'
      | 'modulo'
      | 'power'
      | 'sqrt'
      | 'abs'
      | 'min'
      | 'max';
  };

  if (data.operator === 'sqrt' || data.operator === 'abs') {
    let input: ReturnType<typeof getTypedConnectedInput<number>> | undefined;

    try {
      input = getTypedConnectedInput<number>(
        context,
        connections as unknown as Array<{
          target: string;
          targetHandle: string;
          source: string;
          sourceHandle: string;
        }>,
        node.data.identifier.id,
        'input_a',
        'number'
      );
    } catch (error) {
      if (error instanceof TypeValidationError) {
        logger.error(
          `Type validation failed for input in Math ${data.operator.toUpperCase()} node ${node.data.identifier.displayName}: ${error.message}`
        );
        throw error;
      }
      throw error;
    }

    if (!input) {
      throw new Error(
        `Math ${data.operator.toUpperCase()} node ${node.data.identifier.displayName} missing input`
      );
    }

    let result: number;
    switch (data.operator) {
      case 'sqrt':
        if (input.data < 0) {
          throw new Error(
            `Math SQRT node ${node.data.identifier.displayName}: Cannot take square root of negative number (${input.data})`
          );
        }
        result = Math.sqrt(input.data);
        break;
      case 'abs':
        result = Math.abs(input.data);
        break;
      default: {
        const _exhaustive: never = data.operator;
        throw new Error(`Unknown unary math operator: ${String(_exhaustive)}`);
      }
    }

    logger.debug(
      `Math ${data.operator.toUpperCase()} ${node.data.identifier.displayName}: ${data.operator}(${input.data}) = ${result}`
    );

    setNodeOutput(context, node.data.identifier.id, 'output', 'data', result, {
      logicType: 'number',
      validated: true,
    });
    return;
  }

  let inputA: ReturnType<typeof getTypedConnectedInput<number>> | undefined;
  let inputB: ReturnType<typeof getTypedConnectedInput<number>> | undefined;

  try {
    inputA = getTypedConnectedInput<number>(
      context,
      connections as unknown as Array<{
        target: string;
        targetHandle: string;
        source: string;
        sourceHandle: string;
      }>,
      node.data.identifier.id,
      'input_a',
      'number'
    );
  } catch (error) {
    if (error instanceof TypeValidationError) {
      logger.error(
        `Type validation failed for input A in Math ${data.operator.toUpperCase()} node ${node.data.identifier.displayName}: ${error.message}`
      );
      throw error;
    }
    throw error;
  }

  try {
    inputB = getTypedConnectedInput<number>(
      context,
      connections as unknown as Array<{
        target: string;
        targetHandle: string;
        source: string;
        sourceHandle: string;
      }>,
      node.data.identifier.id,
      'input_b',
      'number'
    );
  } catch (error) {
    if (error instanceof TypeValidationError) {
      logger.error(
        `Type validation failed for input B in Math ${data.operator.toUpperCase()} node ${node.data.identifier.displayName}: ${error.message}`
      );
      throw error;
    }
    throw error;
  }

  if (!inputA || !inputB) {
    throw new Error(
      `Math ${data.operator.toUpperCase()} node ${node.data.identifier.displayName} missing required inputs`
    );
  }

  const valueA = inputA.data;
  const valueB = inputB.data;

  let result: number;
  switch (data.operator) {
    case 'add':
      result = valueA + valueB;
      break;
    case 'subtract':
      result = valueA - valueB;
      break;
    case 'multiply':
      result = valueA * valueB;
      break;
    case 'divide':
      if (valueB === 0) {
        throw new Error(
          `Math DIVIDE node ${node.data.identifier.displayName}: Division by zero (A=${valueA}, B=${valueB})`
        );
      }
      result = valueA / valueB;
      break;
    case 'modulo':
      if (valueB === 0) {
        throw new Error(
          `Math MODULO node ${node.data.identifier.displayName}: Modulo by zero (A=${valueA}, B=${valueB})`
        );
      }
      result = valueA % valueB;
      break;
    case 'power':
      result = Math.pow(valueA, valueB);
      break;
    case 'min':
      result = Math.min(valueA, valueB);
      break;
    case 'max':
      result = Math.max(valueA, valueB);
      break;
    default: {
      const _exhaustive: never = data.operator;
      throw new Error(`Unknown binary math operator: ${String(_exhaustive)}`);
    }
  }

  if (!Number.isFinite(result)) {
    if (Number.isNaN(result)) {
      throw new Error(
        `Math ${data.operator.toUpperCase()} node ${node.data.identifier.displayName}: Operation resulted in NaN (A=${valueA}, B=${valueB})`
      );
    }
    if (!Number.isFinite(result)) {
      logger.warn(
        `Math ${data.operator.toUpperCase()} node ${node.data.identifier.displayName}: Operation resulted in ${result} (A=${valueA}, B=${valueB})`
      );
    }
  }

  logger.debug(
    `Math ${data.operator.toUpperCase()} ${node.data.identifier.displayName}: ${String(valueA)} ${data.operator} ${String(valueB)} = ${result}`
  );

  setNodeOutput(context, node.data.identifier.id, 'output', 'data', result, {
    logicType: 'number',
    validated: true,
  });
}
