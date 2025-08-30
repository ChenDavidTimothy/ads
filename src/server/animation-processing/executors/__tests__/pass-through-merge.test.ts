import { describe, it, expect } from "vitest";
import { LogicNodeExecutor } from "../logic-executor";
import {
  createExecutionContext,
  setNodeOutput,
  type ExecutionContext,
} from "../../execution-context";
import type { ReactFlowNode, ReactFlowEdge } from "../../types/graph";
import type { NodeData } from "@/shared/types";
import type { PerObjectBatchOverrides } from "../../scene/batch-overrides-resolver";

function node(
  id: string,
  type: string,
  extra?: Record<string, unknown>,
): ReactFlowNode<NodeData> {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: {
      identifier: { id, displayName: id, type },
      ...(extra ?? {}),
    } as unknown as NodeData,
  };
}

describe("Pass-through and Merge semantics", () => {
  it("Filter preserves perObjectBatchOverrides and perObjectBoundFields", async () => {
    const ctx: ExecutionContext = createExecutionContext();
    const src = "src1";
    const meta = {
      perObjectTimeCursor: { a: 0 },
      perObjectAnimations: {},
      perObjectAssignments: {},
      perObjectBatchOverrides: { a: { "Typography.content": { A: "KeyA" } } },
      perObjectBoundFields: { a: ["Typography.content"] },
    };
    setNodeOutput(ctx, src, "output", "object_stream", [{ id: "a" }], meta);

    const filter = node("filter1", "filter", { selectedObjectIds: ["a"] });
    const exec = new LogicNodeExecutor();
    const edges: ReactFlowEdge[] = [
      {
        id: "e",
        source: src,
        sourceHandle: "output",
        target: filter.id,
        targetHandle: "input",
      },
    ];
    await exec.execute(filter, ctx, edges);

    const out = ctx.nodeOutputs.get("filter1.output");
    expect(out?.metadata?.perObjectBatchOverrides).toBeTruthy();
    expect(out?.metadata?.perObjectBoundFields).toBeTruthy();
    const metadata = out?.metadata as {
      perObjectBatchOverrides?: PerObjectBatchOverrides;
    };
    expect(
      metadata?.perObjectBatchOverrides?.a?.["Typography.content"]?.A,
    ).toBe("KeyA");
  });

  it("Merge enforces port 1 priority (conflicting overrides)", async () => {
    const ctx: ExecutionContext = createExecutionContext();

    // Two upstream sources with conflicting per-key values
    const left = "left";
    const right = "right";
    setNodeOutput(ctx, left, "output", "object_stream", [{ id: "a" }], {
      perObjectBatchOverrides: {
        a: { "Typography.content": { A: "from-left" } },
      },
    });
    setNodeOutput(ctx, right, "output", "object_stream", [{ id: "a" }], {
      perObjectBatchOverrides: {
        a: { "Typography.content": { A: "from-right" } },
      },
    });

    const merge = node("merge1", "merge", { inputPortCount: 2 });
    const edges: ReactFlowEdge[] = [
      {
        id: "e1",
        source: left,
        sourceHandle: "output",
        target: merge.id,
        targetHandle: "input1",
      },
      {
        id: "e2",
        source: right,
        sourceHandle: "output",
        target: merge.id,
        targetHandle: "input2",
      },
    ];
    const exec = new LogicNodeExecutor();
    await exec.execute(merge, ctx, edges);

    const out = ctx.nodeOutputs.get("merge1.output");
    const overrides = (
      out?.metadata as { perObjectBatchOverrides?: PerObjectBatchOverrides }
    )?.perObjectBatchOverrides;
    expect(overrides?.a?.["Typography.content"]?.A).toBe("from-left"); // port 1 wins
  });
});
