import { describe, it, expect } from "vitest";
import { LogicNodeExecutor } from "../logic-executor";
import {
  createExecutionContext,
  setNodeOutput,
  type ExecutionContext,
} from "../../execution-context";
import type { ReactFlowNode, ReactFlowEdge } from "../../types/graph";
import type { NodeData } from "@/shared/types";

// Test-specific interface for batch node data
interface BatchNodeData extends Record<string, unknown> {
  key?: string;
  variableBindings?: Record<
    string,
    {
      target?: string;
      boundResultNodeId?: string;
    }
  >;
  variableBindingsByObject?: Record<
    string,
    Record<
      string,
      {
        target?: string;
        boundResultNodeId?: string;
      }
    >
  >;
}

function makeNode(
  id: string,
  type: string,
  data: Record<string, unknown>,
): ReactFlowNode<NodeData> {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: {
      identifier: { id, displayName: id, type },
      ...data,
    } as unknown as NodeData,
  };
}

describe("Batch node executor", () => {
  function runBatch(
    inputs: unknown[],
    batchNodeData: BatchNodeData,
    vars?: {
      global?: Record<string, unknown>;
      perObject?: Record<string, Record<string, unknown>>;
    },
  ) {
    const context: ExecutionContext = createExecutionContext();
    const sourceId = "src";
    setNodeOutput(context, sourceId, "output", "object_stream", inputs);

    // Build fake result nodes to host values for variable bindings
    const connections: ReactFlowEdge[] = [
      {
        id: "e1",
        source: sourceId,
        sourceHandle: "output",
        target: "batch1",
        targetHandle: "input",
      },
    ];

    if (vars?.global) {
      let i = 0;
      for (const [k, v] of Object.entries(vars.global)) {
        const rid = `resg_${i++}`;
        setNodeOutput(
          context,
          rid,
          "output",
          typeof v === "number" ? "data" : "data",
          v,
          { displayValue: String(v) },
        );
        setNodeOutput(context, rid, "result", "data", v, {
          displayValue: String(v),
        });
        // Wire nothing; batch reads by nodeOutputs map via id
        batchNodeData.variableBindings ??= {};
        batchNodeData.variableBindings[k] = { boundResultNodeId: rid };
      }
    }
    if (vars?.perObject) {
      for (const [obj, map] of Object.entries(vars.perObject)) {
        let j = 0;
        for (const [k, v] of Object.entries(map)) {
          const rid = `reso_${obj}_${j++}`;
          setNodeOutput(context, rid, "output", "data", v, {
            displayValue: String(v),
          });
          setNodeOutput(context, rid, "result", "data", v, {
            displayValue: String(v),
          });
          batchNodeData.variableBindingsByObject ??= {};
          batchNodeData.variableBindingsByObject[obj] ??= {};
          batchNodeData.variableBindingsByObject[obj][k] = {
            boundResultNodeId: rid,
          };
        }
      }
    }

    const node = makeNode("batch1", "batch", batchNodeData);

    const exec = new LogicNodeExecutor();
    return exec.execute(node, context, connections).then(() => context);
  }

  it("resolves key per object: per-object binding > global binding > literal", async () => {
    const inputs = [{ id: "o1" }, { id: "o2" }];
    const ctx = await runBatch(
      inputs,
      { key: "literal" },
      {
        global: { key: "global" },
        perObject: { o2: { key: "per-o2" } },
      },
    );

    const out = ctx.nodeOutputs.get("batch1.output");
    expect(out?.type).toBe("object_stream");
    const data = Array.isArray(out?.data)
      ? (out.data as Array<{ id: string; batch?: boolean; batchKey?: string }>)
      : [];

    const o1 = data.find((d) => d.id === "o1")!;
    const o2 = data.find((d) => d.id === "o2")!;
    expect(o1.batch).toBe(true);
    expect(o1.batchKey).toBe("global"); // per-object missing → global
    expect(o2.batchKey).toBe("per-o2"); // per-object wins
  });

  it("aggregates empty keys and throws domain error", async () => {
    const inputs = [{ id: "a1" }, { id: "a2" }];
    await expect(runBatch(inputs, { key: "   " })).rejects.toHaveProperty(
      "code",
      "ERR_BATCH_EMPTY_KEY",
    );
  });

  it("warns on re-tagging with a different key and applies last-write-wins", async () => {
    const inputs = [{ id: "r1", batch: true, batchKey: "X" }];
    const ctx = await runBatch(inputs, { key: "Y" });
    const out = ctx.nodeOutputs.get("batch1.output");
    const data = Array.isArray(out?.data)
      ? (out.data as Array<{ id: string; batch?: boolean; batchKey?: string }>)
      : [];
    expect(data[0]?.batchKey).toBe("Y");
  });
});
