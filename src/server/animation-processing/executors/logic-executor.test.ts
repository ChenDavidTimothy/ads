import { describe, it, expect } from "vitest";
import { LogicNodeExecutor } from "./logic-executor";
import { createExecutionContext, setNodeOutput } from "../execution-context";

function makeNode(type: string, id: string, data: Record<string, unknown> = {}) {
  return {
    type,
    data: { identifier: { id, displayName: id, type }, ...data },
  } as any;
}

describe("Batch node", () => {
  it("tags objects with batch metadata and errors on empty key", async () => {
    const ex = new (LogicNodeExecutor as any)() as LogicNodeExecutor;
    // @ts-ignore - access protected
    ex.registerHandlers();

    const ctx = createExecutionContext();
    // Upstream object
    setNodeOutput(ctx, "up", "output", "object_stream", [
      { id: "o1", type: "rectangle", properties: { width: 5, height: 5 }, initialPosition: { x: 0, y: 0 } },
    ]);

    const node = makeNode("batch", "batch1", { key: "SKU123" });
    const edges = [
      { source: "up", sourceHandle: "output", target: "batch1", targetHandle: "input" },
    ] as any;

    await (ex as any).executeBatch(node, ctx, edges);
    const out = ctx.nodeOutputs.get("batch1.output");
    expect(out?.type).toBe("object_stream");
    const items = out?.data as any[];
    expect(items[0].batch).toBe(true);
    expect(items[0].batchKey).toBe("SKU123");

    // Empty key errors
    const node2 = makeNode("batch", "batch2", { key: "  " });
    const edges2 = [
      { source: "up", sourceHandle: "output", target: "batch2", targetHandle: "input" },
    ] as any;
    await expect((ex as any).executeBatch(node2, ctx, edges2)).rejects.toThrow(
      /Batch key resolved empty/,
    );
  });
});

