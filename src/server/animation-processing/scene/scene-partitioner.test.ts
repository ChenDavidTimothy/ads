import { describe, it, expect } from "vitest";
import type { SceneObject } from "@/shared/types/scene";
import { partitionByBatchKey } from "./scene-partitioner";

function so(id: string, batch?: string): SceneObject {
  return {
    id,
    type: "rectangle",
    properties: { width: 10, height: 10 },
    initialPosition: { x: 0, y: 0 },
    ...(batch ? { batch: true, batchKey: batch } : {}),
  } as unknown as SceneObject;
}

describe("partitionByBatchKey", () => {
  it("returns single partition when no batched objects", () => {
    const base = {
      sceneNode: { data: { identifier: { id: "scene1" } } } as any,
      objects: [so("a"), so("b")],
      animations: [],
    };
    const out = partitionByBatchKey(base as any);
    expect(out).toHaveLength(1);
    expect(out[0].batchKey).toBeNull();
    expect(out[0].objects.map((o) => o.id)).toEqual(["a", "b"]);
  });

  it("creates per-key partitions with sorted keys and includes non-batched in each", () => {
    const base = {
      sceneNode: { data: { identifier: { id: "scene1" } } } as any,
      objects: [so("n1"), so("x", "B"), so("y", "A")],
      animations: [],
    };
    const out = partitionByBatchKey(base as any);
    expect(out).toHaveLength(2);
    expect(out[0].batchKey).toBe("A");
    expect(out[1].batchKey).toBe("B");
    expect(out[0].objects.map((o) => o.id).sort()).toEqual(["n1", "y"].sort());
    expect(out[1].objects.map((o) => o.id).sort()).toEqual(["n1", "x"].sort());
  });
});

