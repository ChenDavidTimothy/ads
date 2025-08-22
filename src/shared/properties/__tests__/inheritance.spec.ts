import { describe, it, expect } from "vitest";
import { buildSparseOverrides, buildSparsePoint2DOverride } from "../inheritance";

describe("buildSparseOverrides", () => {
	it("prefers per-object binding over everything", () => {
		const out = buildSparseOverrides<Record<string, number | string>>(
			["rotation", "opacity"],
			{ nodeDefaults: { rotation: 0, opacity: 1 }, nodeBoundValues: {}, inherit: {} },
			{ objectId: "o1", perObjectAssignments: { o1: { initial: { rotation: 10 } } }, perObjectBoundValues: { rotation: 5 } },
		);
		expect(out.rotation).toBe(5);
		expect(out.opacity).toBe(1);
	});

	it("uses per-object manual when no binding", () => {
		const out = buildSparseOverrides<Record<string, number | string>>(
			["rotation"],
			{ nodeDefaults: { rotation: 0 }, nodeBoundValues: {}, inherit: {} },
			{ objectId: "o1", perObjectAssignments: { o1: { initial: { rotation: 10 } } } },
		);
		expect(out.rotation).toBe(10);
	});

	it("omits property when Default inherit is true", () => {
		const out = buildSparseOverrides<Record<string, number | string>>(
			["opacity"],
			{ nodeDefaults: { opacity: 1 }, nodeBoundValues: {}, inherit: { opacity: true } },
		);
		expect("opacity" in out).toBe(false);
	});

	it("uses Default binding when not inheriting and no per-object", () => {
		const out = buildSparseOverrides<Record<string, number | string>>(
			["opacity"],
			{ nodeDefaults: { opacity: 1 }, nodeBoundValues: { opacity: 0.5 }, inherit: {} },
		);
		expect(out.opacity).toBe(0.5);
	});
});

describe("buildSparsePoint2DOverride", () => {
	it("respects per-object assignment per axis", () => {
		const out = buildSparsePoint2DOverride(
			"position",
			{ nodeDefaults: { position: { x: 0, y: 0 } }, nodeBoundValues: {}, inherit: {} },
			{ objectId: "o1", perObjectAssignments: { o1: { initial: { position: { x: 100 } } } } },
		);
		expect(out.position?.x).toBe(100);
		expect(out.position?.y).toBe(0);
	});

	it("applies Default inherit per axis", () => {
		const out = buildSparsePoint2DOverride(
			"scale",
			{ nodeDefaults: { scale: { x: 1, y: 1 } }, nodeBoundValues: {}, inherit: { scale: { x: true } } },
		);
		expect(out.scale?.x).toBeUndefined();
		expect(out.scale?.y).toBe(1);
	});
});