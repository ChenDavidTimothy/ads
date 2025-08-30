import { describe, it, expect, vi } from "vitest";
import {
  applyOverridesToObject,
  type BatchResolveContext,
} from "../batch-overrides-resolver";
import type { SceneObject } from "@/shared/types/scene";

function baseText(id: string, content = "Base"): SceneObject {
  return {
    id,
    type: "text",
    properties: { content, fontSize: 16 },
    initialPosition: { x: 0, y: 0 },
    initialOpacity: 1,
  } as unknown as SceneObject;
}

function baseImage(id: string, assetId?: string): SceneObject {
  return {
    id,
    type: "image",
    properties: { assetId },
    initialPosition: { x: 0, y: 0 },
    initialOpacity: 1,
  } as unknown as SceneObject;
}

describe("Batch overrides resolver", () => {
  it("applies precedence: per-key > per-object default > node default (unbound)", () => {
    const obj = baseText("t1", "DefaultNode");
    const ctx: BatchResolveContext = {
      batchKey: "A",
      perObjectBatchOverrides: {
        t1: {
          "Typography.content": {
            default: "DefaultPerObject",
            A: "KeyA",
          },
        },
      },
      perObjectBoundFields: {},
    };

    const out = applyOverridesToObject(obj, ctx);
    // Key override wins
    expect((out.properties as { content?: string }).content).toBe("KeyA");
  });

  it("falls back to per-object default when per-key missing; then to node default", () => {
    const obj = baseText("t2", "DefaultNode");
    const ctx1: BatchResolveContext = {
      batchKey: "B",
      perObjectBatchOverrides: {
        t2: {
          "Typography.content": { default: "DefaultPerObject" },
        },
      },
      perObjectBoundFields: {},
    };
    const ctx2: BatchResolveContext = {
      batchKey: "C",
      perObjectBatchOverrides: {
        t2: {
          // No entry for Typography.content → should use node default
        } as Record<string, Record<string, unknown>>,
      },
      perObjectBoundFields: {},
    };

    const out1 = applyOverridesToObject(obj, ctx1);
    expect((out1.properties as { content?: string }).content).toBe(
      "DefaultPerObject",
    );

    const out2 = applyOverridesToObject(obj, ctx2);
    expect((out2.properties as { content?: string }).content).toBe(
      "DefaultNode",
    );
  });

  it("ignores per-key when non-batched (batchKey=null)", () => {
    const obj = baseText("t3", "Node");
    const ctx: BatchResolveContext = {
      batchKey: null,
      perObjectBatchOverrides: {
        t3: {
          "Typography.content": { default: "PerObject", X: "KeyX" },
        },
      },
      perObjectBoundFields: {},
    };

    const out = applyOverridesToObject(obj, ctx);
    // Per-key ignored; default applies
    expect((out.properties as { content?: string }).content).toBe("PerObject");
  });

  it("respects bound-fields mask (binding wins; overrides do not apply)", () => {
    const obj = baseText("t4", "FromBinding");
    const ctx: BatchResolveContext = {
      batchKey: "Y",
      perObjectBatchOverrides: {
        t4: {
          "Typography.content": { default: "PerObject", Y: "KeyY" },
        },
      },
      perObjectBoundFields: {
        t4: ["Typography.content"],
      },
    };

    const out = applyOverridesToObject(obj, ctx);
    // Bound mask causes resolver to return current value unchanged
    expect((out.properties as { content?: string }).content).toBe(
      "FromBinding",
    );
  });

  it("coerces types and logs warnings for invalid per-key values (string expected)", () => {
    const warn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined as unknown as void);
    const obj = baseText("t5", "Node");
    const ctx: BatchResolveContext = {
      batchKey: "Z",
      perObjectBatchOverrides: {
        t5: {
          "Typography.content": {
            Z: 12345 as unknown as string,
            default: "PerObject",
          },
        },
      },
      perObjectBoundFields: {},
    };

    const out = applyOverridesToObject(obj, ctx);
    // Invalid per-key value falls back to per-object default
    expect((out.properties as { content?: string }).content).toBe("PerObject");
    warn.mockRestore();
  });

  it("applies Canvas numeric overrides with precedence and no leakage across keys", () => {
    const base: SceneObject = {
      id: "c1",
      type: "rectangle",
      properties: { width: 10, height: 10 },
      initialPosition: { x: 1, y: 2 },
      initialScale: { x: 1, y: 1 },
      initialRotation: 0,
      initialOpacity: 1,
    } as unknown as SceneObject;

    const ctxA: BatchResolveContext = {
      batchKey: "A",
      perObjectBatchOverrides: {
        c1: {
          "Canvas.position.x": { A: 100, default: 50 },
          "Canvas.position.y": { default: 25 },
          "Canvas.scale.x": { A: 2 },
          "Canvas.scale.y": { default: 3 },
          "Canvas.rotation": { default: 10 },
          "Canvas.opacity": { A: 0.5, default: 0.8 },
          "Canvas.fillColor": { A: "#112233" },
          "Canvas.strokeColor": { default: "#445566" },
          "Canvas.strokeWidth": { default: 4 },
        },
      },
      perObjectBoundFields: {},
    };

    const ctxB: BatchResolveContext = {
      batchKey: "B",
      perObjectBatchOverrides: ctxA.perObjectBatchOverrides,
      perObjectBoundFields: {},
    };

    const outA = applyOverridesToObject(base, ctxA);
    const outB = applyOverridesToObject(base, ctxB);

    expect(outA.initialPosition.x).toBe(100); // per-key A wins
    expect(outA.initialPosition.y).toBe(25); // default
    expect(outA.initialScale?.x).toBe(2);
    expect(outA.initialScale?.y).toBe(3);
    expect(outA.initialRotation).toBe(10);
    expect(outA.initialOpacity).toBe(0.5);
    expect(outA.initialFillColor).toBe("#112233");
    expect(outA.initialStrokeColor).toBe("#445566");
    expect(outA.initialStrokeWidth).toBe(4);

    // Different key should not see per-key A values (no leakage)
    expect(outB.initialPosition.x).toBe(50); // per-key B missing → default 50
    expect(outB.initialOpacity).toBe(0.8); // per-key missing → default 0.8
  });

  it("applies Media.imageAssetId per-key override only when batchKey present", () => {
    const obj = baseImage("img1", undefined);

    const ctxKey: BatchResolveContext = {
      batchKey: "ad",
      perObjectBatchOverrides: {
        img1: { "Media.imageAssetId": { ad: "asset-123" } },
      },
      perObjectBoundFields: {},
    };
    const ctxNoKey: BatchResolveContext = {
      batchKey: null,
      perObjectBatchOverrides: {
        img1: { "Media.imageAssetId": { ad: "asset-123" } },
      },
      perObjectBoundFields: {},
    };

    const out1 = applyOverridesToObject(obj, ctxKey);
    expect((out1.properties as { assetId?: string }).assetId).toBe("asset-123");

    const out2 = applyOverridesToObject(obj, ctxNoKey);
    expect((out2.properties as { assetId?: string }).assetId).toBeUndefined();
  });
});
