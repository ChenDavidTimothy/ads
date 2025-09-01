import { describe, it, expect } from "vitest";
import { applyOverridesToObject, type BatchResolveContext } from "@/server/animation-processing/scene/batch-overrides-resolver";
import type { SceneObject } from "@/shared/types/scene";

describe("batch-overrides-resolver", () => {
	it("applies Typography.content and colors to text objects", () => {
		const textObj: SceneObject = {
			id: "obj1",
			type: "text",
			initialPosition: { x: 0, y: 0 },
			properties: { content: "hello", fontSize: 24 },
		};
		const ctx: BatchResolveContext = {
			batchKey: "k1",
			perObjectBatchOverrides: {
				obj1: {
					"Typography.content": { k1: "World" },
					"Typography.fillColor": { k1: "#ff0000" },
					"Typography.strokeColor": { k1: "#00ff00" },
					"Typography.strokeWidth": { k1: 3 },
				},
			},
		};
		const next = applyOverridesToObject(textObj, ctx);
		expect((next.properties as { content: string }).content).toBe("World");
		expect(next.typography?.fillColor).toBe("#ff0000");
		expect(next.typography?.strokeColor).toBe("#00ff00");
		expect(next.typography?.strokeWidth).toBe(3);
	});

	it("applies Media.imageAssetId to image properties", () => {
		const imgObj: SceneObject = {
			id: "img1",
			type: "image",
			initialPosition: { x: 0, y: 0 },
			properties: {},
		};
		const ctx: BatchResolveContext = {
			batchKey: "k1",
			perObjectBatchOverrides: {
				img1: {
					"Media.imageAssetId": { k1: "asset-xyz" },
				},
			},
		};
		const next = applyOverridesToObject(imgObj, ctx);
		expect((next.properties as { assetId?: string }).assetId).toBe("asset-xyz");
	});
});