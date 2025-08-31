import { describe, it, expect } from "vitest";
import { convertTracksToSceneAnimations } from "../scene-assembler";
import type { AnimationTrack } from "@/shared/types";

function createMockTrack(
  type: "move" | "rotate" | "scale" | "fade" | "color",
  properties: Record<string, unknown>,
  identifier = { id: "track1", displayName: "Track 1" }
): AnimationTrack {
  return {
    type,
    startTime: 0,
    duration: 1,
    easing: "linear" as const,
    identifier,
    properties,
  } as AnimationTrack;
}

describe("Scene Assembler Timeline Batch Overrides", () => {
  it("applies Timeline batch overrides when context provided", () => {
    const tracks: AnimationTrack[] = [
      createMockTrack("move", {
        from: { x: 0, y: 0 },
        to: { x: 100, y: 100 },
      }),
    ];

    const batchOverrideContext = {
      batchKey: "A" as string | null,
      perObjectBatchOverrides: {
        obj1: {
          "Timeline.move.from.x": { A: 50, default: 25 },
          "Timeline.move.to.y": { A: 200, default: 150 },
        },
      },
      perObjectBoundFields: {},
    };

    const animations = convertTracksToSceneAnimations(
      tracks,
      "obj1",
      0,
      [],
      undefined,
      batchOverrideContext
    );

    expect(animations).toHaveLength(1);
    const moveAnimation = animations[0]!;
    expect(moveAnimation.properties.from.x).toBe(50); // per-key A override
    expect(moveAnimation.properties.from.y).toBe(0); // unchanged
    expect(moveAnimation.properties.to.x).toBe(100); // unchanged
    expect(moveAnimation.properties.to.y).toBe(200); // per-key A override
  });

  it("falls back to default values when per-key missing", () => {
    const tracks: AnimationTrack[] = [
      createMockTrack("rotate", {
        from: 0,
        to: 90,
      }),
    ];

    const batchOverrideContext = {
      batchKey: "B" as string | null, // B key not defined
      perObjectBatchOverrides: {
        obj2: {
          "Timeline.rotate.from": { A: 45, default: 30 },
          "Timeline.rotate.to": { default: 120 },
        },
      },
      perObjectBoundFields: {},
    };

    const animations = convertTracksToSceneAnimations(
      tracks,
      "obj2",
      0,
      [],
      undefined,
      batchOverrideContext
    );

    const rotateAnimation = animations[0]!;
    expect(rotateAnimation.properties.from).toBe(30); // default fallback
    expect(rotateAnimation.properties.to).toBe(120); // default fallback
  });

  it("respects bound fields mask", () => {
    const tracks: AnimationTrack[] = [
      createMockTrack("scale", {
        from: 1,
        to: 2,
      }),
    ];

    const batchOverrideContext = {
      batchKey: "A" as string | null,
      perObjectBatchOverrides: {
        obj3: {
          "Timeline.scale.from": { A: 1.5, default: 1.2 },
        },
      },
      perObjectBoundFields: {
        obj3: ["Timeline.scale.from"], // Bound field should mask override
      },
    };

    const animations = convertTracksToSceneAnimations(
      tracks,
      "obj3",
      0,
      [],
      undefined,
      batchOverrideContext
    );

    const scaleAnimation = animations[0]!;
    expect(scaleAnimation.properties.from).toBe(1); // Original value (bound field masks override)
    expect(scaleAnimation.properties.to).toBe(2); // Unchanged
  });

  it("handles multiple track types with mixed overrides", () => {
    const tracks: AnimationTrack[] = [
      createMockTrack("move", {
        from: { x: 0, y: 0 },
        to: { x: 100, y: 100 },
      }),
      createMockTrack("fade", {
        from: 0,
        to: 1,
      }),
      createMockTrack("color", {
        from: "#000000",
        to: "#ffffff",
      }, { id: "track2", displayName: "Track 2" }),
    ];

    const batchOverrideContext = {
      batchKey: "A" as string | null,
      perObjectBatchOverrides: {
        obj4: {
          "Timeline.move.from.x": { A: 25 },
          "Timeline.fade.from": { A: 0.3 },
          "Timeline.color.to": { A: "#ff0000" },
        },
      },
      perObjectBoundFields: {},
    };

    const animations = convertTracksToSceneAnimations(
      tracks,
      "obj4",
      0,
      [],
      undefined,
      batchOverrideContext
    );

    expect(animations).toHaveLength(3);

    const moveAnim = animations.find(a => a.type === "move")!;
    const fadeAnim = animations.find(a => a.type === "fade")!;
    const colorAnim = animations.find(a => a.type === "color")!;

    expect(moveAnim.properties.from.x).toBe(25);
    expect(fadeAnim.properties.from).toBe(0.3);
    expect(colorAnim.properties.to).toBe("#ff0000");
  });

  it("ignores per-key when batchKey is null", () => {
    const tracks: AnimationTrack[] = [
      createMockTrack("rotate", {
        from: 0,
        to: 90,
      }),
    ];

    const batchOverrideContext = {
      batchKey: null, // Non-batched
      perObjectBatchOverrides: {
        obj5: {
          "Timeline.rotate.from": { A: 45, default: 30 },
        },
      },
      perObjectBoundFields: {},
    };

    const animations = convertTracksToSceneAnimations(
      tracks,
      "obj5",
      0,
      [],
      undefined,
      batchOverrideContext
    );

    const rotateAnimation = animations[0]!;
    expect(rotateAnimation.properties.from).toBe(30); // Only default applies
    expect(rotateAnimation.properties.to).toBe(90); // Unchanged
  });

  it("works without batch context (backward compatibility)", () => {
    const tracks: AnimationTrack[] = [
      createMockTrack("scale", {
        from: 1,
        to: 2,
      }),
    ];

    const animations = convertTracksToSceneAnimations(
      tracks,
      "obj6",
      0,
      []
    );

    expect(animations).toHaveLength(1);
    const scaleAnimation = animations[0]!;
    expect(scaleAnimation.properties.from).toBe(1);
    expect(scaleAnimation.properties.to).toBe(2);
  });

  it("handles empty batch overrides gracefully", () => {
    const tracks: AnimationTrack[] = [
      createMockTrack("fade", {
        from: 0,
        to: 1,
      }),
    ];

    const batchOverrideContext = {
      batchKey: "A" as string | null,
      perObjectBatchOverrides: {
        obj7: {}, // Empty overrides
      },
      perObjectBoundFields: {},
    };

    const animations = convertTracksToSceneAnimations(
      tracks,
      "obj7",
      0,
      [],
      undefined,
      batchOverrideContext
    );

    const fadeAnimation = animations[0]!;
    expect(fadeAnimation.properties.from).toBe(0);
    expect(fadeAnimation.properties.to).toBe(1);
  });

  it("handles missing object in batch overrides", () => {
    const tracks: AnimationTrack[] = [
      createMockTrack("color", {
        from: "#000000",
        to: "#ffffff",
      }),
    ];

    const batchOverrideContext = {
      batchKey: "A" as string | null,
      perObjectBatchOverrides: {
        // obj8 not defined in overrides
        obj9: {
          "Timeline.color.from": { A: "#ff0000" },
        },
      },
      perObjectBoundFields: {},
    };

    const animations = convertTracksToSceneAnimations(
      tracks,
      "obj8", // Object not in batch overrides
      0,
      [],
      undefined,
      batchOverrideContext
    );

    const colorAnimation = animations[0]!;
    expect(colorAnimation.properties.from).toBe("#000000"); // Unchanged
    expect(colorAnimation.properties.to).toBe("#ffffff"); // Unchanged
  });
});
