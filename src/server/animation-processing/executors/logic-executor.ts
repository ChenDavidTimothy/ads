import type { NodeData } from "@/shared/types";
import type { ReactFlowNode, ReactFlowEdge } from "../types/graph";
import type { ExecutionContext } from "../execution-context";
import { BaseExecutor } from "./base-executor";
import { executeFilterNode } from "./logic/filter-handler";
import { executeMergeNode } from "./logic/merge-handler";
import { executeConstantsNode } from "./logic/constants-handler";
import { executeResultNode } from "./logic/result-handler";
import {
  executeCompareNode,
  executeIfElseNode,
  executeBooleanOpNode,
  executeMathOpNode,
} from "./logic/comparison-handlers";
import { executeDuplicateNode } from "./logic/duplicate-handler";
import { executeBatchNode } from "./logic/batch-handler";

type LogicExecutorHandler = (
  node: ReactFlowNode<NodeData>,
  context: ExecutionContext,
  connections: ReactFlowEdge[],
) => Promise<void>;

export class LogicNodeExecutor extends BaseExecutor {
  protected registerHandlers(): void {
    this.registerHandler("filter", executeFilterNode as LogicExecutorHandler);
    this.registerHandler("merge", executeMergeNode as LogicExecutorHandler);
    this.registerHandler(
      "constants",
      executeConstantsNode as LogicExecutorHandler,
    );
    this.registerHandler("result", executeResultNode as LogicExecutorHandler);
    this.registerHandler("compare", executeCompareNode as LogicExecutorHandler);
    this.registerHandler("if_else", executeIfElseNode as LogicExecutorHandler);
    this.registerHandler(
      "boolean_op",
      executeBooleanOpNode as LogicExecutorHandler,
    );
    this.registerHandler("math_op", executeMathOpNode as LogicExecutorHandler);
    this.registerHandler(
      "duplicate",
      executeDuplicateNode as LogicExecutorHandler,
    );
    this.registerHandler("batch", executeBatchNode as LogicExecutorHandler);
  }
}
