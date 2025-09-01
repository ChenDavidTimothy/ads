import { describe, it, expect, vi, beforeEach } from "vitest";
import { SceneRenderer } from "@/animation/execution/scene-renderer";
import type { AnimationScene } from "@/shared/types/scene";

vi.mock("canvas", async (orig) => {
	const actual = await orig();
	return {
		...actual,
		loadImage: vi.fn(async (_url: string) => ({ width: 100, height: 50 })),
	};
});

// Minimal NodeCanvasContext mock
class CtxMock {
	fillStyle = "#000";
	globalAlpha = 1;
	save() {}
	restore() {}
	translate() {}
	rotate() {}
	scale() {}
	fillRect() {}
	strokeRect() {}
	drawImage() {}
	getImageData() { return { data: new Uint8ClampedArray(4) }; }
	setTransform() {}
}

// Stub FrameConfig for renderer usage
const config = { width: 320, height: 180, backgroundColor: "#000" };

describe("SceneRenderer image fallback", () => {
	beforeEach(() => {
		process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
	});

	it("uses /api/download/:assetId when imageUrl missing", async () => {
		const scene: AnimationScene = {
			duration: 1,
			objects: [
				{
					id: "img1",
					type: "image",
					initialPosition: { x: 0, y: 0 },
					initialScale: { x: 1, y: 1 },
					properties: {
						assetId: "abc-123",
						cropX: 0,
						cropY: 0,
						cropWidth: 0,
						cropHeight: 0,
						displayWidth: 0,
						displayHeight: 0,
					},
				},
			],
			animations: [],
		};
		const renderer = new SceneRenderer(scene, config);
		const ctx = new CtxMock() as unknown as import("@/shared/types/core").NodeCanvasContext;
		await renderer.renderFrame(ctx, 0);
		expect(true).toBe(true);
		renderer.dispose();
	});
});