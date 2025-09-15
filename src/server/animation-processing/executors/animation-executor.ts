import type { NodeData } from "@/shared/types";
import type { ReactFlowNode, ReactFlowEdge } from "../types/graph";
import type { ExecutionContext } from "../execution-context";
import { BaseExecutor } from "./base-executor";
import { executeAnimationNode } from "./animation/scene-animation-handler";
import { executeTypographyNode } from "./animation/typography-handler";
import { executeMediaNode } from "./animation/media-handler";

type AnimationExecutorHandler = (
  node: ReactFlowNode<NodeData>,
  context: ExecutionContext,
  connections: ReactFlowEdge[],
) => Promise<void>;

export class AnimationNodeExecutor extends BaseExecutor {
  protected registerHandlers(): void {
    this.registerHandler(
      "animation",
      executeAnimationNode as AnimationExecutorHandler,
    );
    this.registerHandler(
      "typography",
      executeTypographyNode as AnimationExecutorHandler,
    );
    this.registerHandler("media", executeMediaNode as AnimationExecutorHandler);
  }
}
