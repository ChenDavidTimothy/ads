import {
  setNodeOutput,
  getConnectedInputs,
  type ExecutionContext,
} from "../../execution-context";
import type { ReactFlowNode, ReactFlowEdge } from "../../types/graph";
import type { NodeData } from "@/shared/types";
import { logger } from "@/lib/logger";
import { MultipleResultValuesError } from "@/shared/errors/domain";
import {
  getValueType,
  formatValue,
  getDataSize,
  isComplexObject,
  hasNestedData,
} from "./shared/common";

export async function executeResultNode(
  node: ReactFlowNode<NodeData>,
  context: ExecutionContext,
  connections: ReactFlowEdge[],
): Promise<void> {
  const data = node.data as unknown as Record<string, unknown>;
  const label = typeof data.label === "string" ? data.label : "Debug";
  const nodeDisplayName = node.data.identifier.displayName;

  const inputs = getConnectedInputs(
    context,
    connections as unknown as Array<{
      target: string;
      targetHandle: string;
      source: string;
      sourceHandle: string;
    }>,
    node.data.identifier.id,
    "input",
  );

  if (inputs.length === 0) {
    const noInputMessage = "<no input connected>";
    logger.info(`[RESULT] ${label}: ${noInputMessage}`);

    const isDebugTarget = context.debugTargetNodeId === node.data.identifier.id;

    if (context.debugMode && context.executionLog && isDebugTarget) {
      context.executionLog.push({
        nodeId: node.data.identifier.id,
        timestamp: Date.now(),
        action: "execute",
        data: {
          type: "result_output",
          label,
          nodeDisplayName,
          value: null,
          valueType: "no_input",
          formattedValue: noInputMessage,
          executionContext: {
            hasConnections: false,
            inputCount: 0,
            executionId: `exec-${Date.now()}`,
            flowState: "no_input_connected",
          },
        },
      });
    }
    return;
  }

  if (inputs.length > 1) {
    const sourceNames = inputs
      .map((input) => `${input.nodeId}:${input.portId}`)
      .join(", ");
    throw new MultipleResultValuesError(
      nodeDisplayName,
      sourceNames.split(", "),
    );
  }

  const input = inputs[0]!;
  const value = input.data;
  const valueType = getValueType(value);
  const formattedValue = formatValue(value);
  const executionId = `exec-${Date.now()}`;

  logger.info(`[RESULT] ${label}: ${formattedValue} (${valueType})`);

  const isDebugTarget = context.debugTargetNodeId === node.data.identifier.id;

  if (context.debugMode && context.executionLog && isDebugTarget) {
    context.executionLog.push({
      nodeId: node.data.identifier.id,
      timestamp: Date.now(),
      action: "execute",
      data: {
        type: "result_output",
        label,
        nodeDisplayName,
        value,
        valueType,
        formattedValue,
        executionContext: {
          hasConnections: true,
          inputCount: 1,
          executionId,
          flowState: "executed_successfully",
        },
        metadata: {
          size: getDataSize(value),
          isComplex: isComplexObject(value),
          hasNestedData: hasNestedData(value),
        },
      },
    });
  }

  setNodeOutput(context, node.data.identifier.id, "output", "data", value, {
    label,
    displayName: nodeDisplayName,
    valueType,
    formattedValue,
    executionId,
  });
}
