import { describe, it, expect } from "vitest";
import type { ReactFlowNode } from "../../types/graph";
import type { NodeData } from "@/shared/types";
import type { SceneObject, AnimationScene } from "@/shared/types/scene";
import { partitionByBatchKey, type ScenePartition } from "../scene-partitioner";
import {
  applyOverridesToObject,
  type BatchResolveContext,
} from "../batch-overrides-resolver";

function sceneNode(id: string, name: string): ReactFlowNode<NodeData> {
  return {
    id,
    position: { x: 0, y: 0 },
    data: {
      identifier: { id, displayName: name, type: "scene" },
    } as unknown as NodeData,
  };
}

describe("Scene integration smoke", () => {
  it("produces A/B partitions with non-batched included and per-key values isolated", () => {
    const sNode = sceneNode("scene1", "Demo Scene");

    const logo: SceneObject = {
      id: "logo",
      type: "rectangle",
      properties: { width: 10, height: 10 },
      initialPosition: { x: 0, y: 0 },
      initialOpacity: 1,
      batch: false,
    } as unknown as SceneObject;

    const textA: SceneObject = {
      id: "text",
      type: "text",
      properties: { content: "Node" },
      initialPosition: { x: 0, y: 0 },
      initialOpacity: 1,
      batch: true,
      batchKeys: ["A"],
    } as unknown as SceneObject;

    const textB: SceneObject = { ...textA, batchKeys: ["B"] } as SceneObject;

    const partition: ScenePartition = {
      sceneNode: sNode,
      objects: [logo, textA, textB],
      animations: [],
      batchOverrides: {
        text: {
          "Typography.content": { A: "Hello A", B: "Hello B" },
        },
      },
      boundFieldsByObject: {},
    };

    const subs = partitionByBatchKey(partition);
    expect(subs.map((p) => p.batchKey)).toEqual(["A", "B"]);

    // Build scenes applying overrides
    const build = (sub: (typeof subs)[number]): AnimationScene => {
      const ctx: BatchResolveContext = {
        batchKey: sub.batchKey,
        perObjectBatchOverrides: sub.batchOverrides,
        perObjectBoundFields: sub.boundFieldsByObject,
      };
      const objects = sub.objects.map((o) => applyOverridesToObject(o, ctx));
      return { duration: 1, objects, animations: [] };
    };

    const sceneA = build(subs[0]!);
    const sceneB = build(subs[1]!);

    // Non-batched logo appears in both
    expect(sceneA.objects.some((o) => o.id.startsWith("logo"))).toBe(true);
    expect(sceneB.objects.some((o) => o.id.startsWith("logo"))).toBe(true);

    const aText = sceneA.objects.find((o) => o.id.startsWith("text"))!;
    const bText = sceneB.objects.find((o) => o.id.startsWith("text"))!;

    expect((aText.properties as { content?: string }).content).toBe("Hello A");
    expect((bText.properties as { content?: string }).content).toBe("Hello B");
  });
});
