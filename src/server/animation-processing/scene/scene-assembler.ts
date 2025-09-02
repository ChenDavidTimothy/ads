// src/server/animation-processing/scene/scene-assembler.ts
import type { AnimationTrack } from "@/shared/types";
import type { SceneAnimationTrack } from "@/shared/types/scene";
import type { SceneTransform } from "@/shared/types/transforms";
import { transformFactory } from "@/shared/registry/transforms";
import { transformEvaluator } from "@/shared/registry/transform-evaluator";
import type { Point2D } from "@/shared/types/core";
import type {
  PerObjectAssignments,
  TrackOverride,
} from "@/shared/properties/assignments";
import {
  resolveFieldValue,
  type BatchResolveContext,
} from "./batch-overrides-resolver";

export type PerObjectCursorMap = Record<string, number>;

// Coercion functions for Timeline batch overrides
const numberCoerce = (
  value: unknown,
): { ok: boolean; value?: number; warn?: string } => {
  if (typeof value === "number" && Number.isFinite(value))
    return { ok: true, value };
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return { ok: true, value: parsed };
  }
  return { ok: false, warn: `Expected number, got ${typeof value}` };
};

const stringCoerce = (
  value: unknown,
): { ok: boolean; value?: string; warn?: string } => {
  if (typeof value === "string") return { ok: true, value };
  return { ok: false, warn: `Expected string, got ${typeof value}` };
};

// Define proper types for animation track properties instead of using any
interface MoveTrackProperties {
  from?: Point2D;
  to?: Point2D;
}

interface RotateTrackProperties {
  from?: number;
  to?: number;
}

interface ScaleTrackProperties {
  from?: Point2D;
  to?: Point2D;
}

interface FadeTrackProperties {
  from?: number;
  to?: number;
}

interface ColorTrackProperties {
  from?: string;
  to?: string;
  property?: string;
}

// Union type for all track properties
type TrackProperties =
  | MoveTrackProperties
  | RotateTrackProperties
  | ScaleTrackProperties
  | FadeTrackProperties
  | ColorTrackProperties;

// Type guard functions
function hasFromProperty(props: unknown): props is { from: unknown } {
  return typeof props === "object" && props !== null && "from" in props;
}

function isColorProperties(
  props: TrackProperties,
): props is ColorTrackProperties {
  return hasFromProperty(props) && typeof props.from === "string";
}

export function isPerObjectCursorMap(
  value: unknown,
): value is PerObjectCursorMap {
  if (typeof value !== "object" || value === null) return false;
  for (const v of Object.values(value as Record<string, unknown>)) {
    if (typeof v !== "number") return false;
  }
  return true;
}

export function mergeCursorMaps(
  cursorMaps: PerObjectCursorMap[],
): PerObjectCursorMap {
  const merged: PerObjectCursorMap = {};
  for (const map of cursorMaps) {
    for (const [objectId, time] of Object.entries(map)) {
      if (!(objectId in merged)) {
        merged[objectId] = time;
      } else {
        merged[objectId] = Math.max(merged[objectId]!, time);
      }
    }
  }
  return merged;
}

export function pickCursorsForIds(
  cursorMap: PerObjectCursorMap,
  ids: string[],
): PerObjectCursorMap {
  const picked: PerObjectCursorMap = {};
  for (const id of ids) {
    if (id in cursorMap) picked[id] = cursorMap[id]!;
  }
  return picked;
}

function applyTrackOverride(
  base: AnimationTrack,
  override: TrackOverride,
): AnimationTrack {
  const baseProps = base.properties as unknown as Record<string, unknown>;
  const overrideProps = override.properties ?? {};
  const mergedProps: Record<string, unknown> = {
    ...baseProps,
    ...overrideProps,
  };

  // Deep-merge nested 'from'/'to' objects to preserve per-field overrides (e.g., move.from.x)
  if (
    typeof baseProps.from === "object" &&
    baseProps.from !== null &&
    typeof overrideProps.from === "object" &&
    overrideProps.from !== null
  ) {
    mergedProps.from = {
      ...(baseProps.from as Record<string, unknown>),
      ...(overrideProps.from as Record<string, unknown>),
    };
  }
  if (
    typeof baseProps.to === "object" &&
    baseProps.to !== null &&
    typeof overrideProps.to === "object" &&
    overrideProps.to !== null
  ) {
    mergedProps.to = {
      ...(baseProps.to as Record<string, unknown>),
      ...(overrideProps.to as Record<string, unknown>),
    };
  }

  // Create a new track with merged properties, maintaining the original type
  const merged = {
    ...base,
    startTime: override.startTime ?? base.startTime,
    duration: override.duration ?? base.duration,
    easing: override.easing ?? base.easing,
    properties: mergedProps as unknown as typeof base.properties,
  };
  return merged as AnimationTrack;
}

function pickOverridesForTrack(
  overrides: TrackOverride[] | undefined,
  track: AnimationTrack,
): TrackOverride | undefined {
  if (!overrides || overrides.length === 0) return undefined;
  const byId = overrides.find(
    (o) => o.trackId && o.trackId === track.identifier.id,
  );
  if (byId) return byId;
  return overrides.find((o) => !o.trackId && o.type === track.type);
}

/**
 * Apply Timeline batch overrides to tracks at scene level.
 * Used when batch context is available during scene building.
 */
function applyTimelineBatchOverridesToTracks(
  tracks: AnimationTrack[],
  objectId: string,
  context: {
    batchKey: string | null;
    perObjectBatchOverrides?: Record<
      string,
      Record<string, Record<string, unknown>>
    >;
    perObjectBoundFields?: Record<string, string[]>;
  },
): AnimationTrack[] {
  if (!context.perObjectBatchOverrides?.[objectId]) return tracks;

  const ctx: BatchResolveContext = {
    batchKey: context.batchKey,
    perObjectBatchOverrides: context.perObjectBatchOverrides,
    perObjectBoundFields: context.perObjectBoundFields,
  };

  return tracks.map((track: AnimationTrack): AnimationTrack => {
    const properties = track.properties as unknown as Record<string, unknown>;
    const updatedProperties = { ...properties };

    // Apply Timeline batch overrides per track type
    switch (track.type) {
      case "move": {
        const moveProps = updatedProperties as {
          from?: { x: number; y: number };
          to?: { x: number; y: number };
        };

        if (moveProps.from) {
          moveProps.from.x = resolveFieldValue(
            objectId,
            "Timeline.move.from.x",
            moveProps.from.x,
            ctx,
            numberCoerce,
          );
          moveProps.from.y = resolveFieldValue(
            objectId,
            "Timeline.move.from.y",
            moveProps.from.y,
            ctx,
            numberCoerce,
          );
        }

        if (moveProps.to) {
          moveProps.to.x = resolveFieldValue(
            objectId,
            "Timeline.move.to.x",
            moveProps.to.x,
            ctx,
            numberCoerce,
          );
          moveProps.to.y = resolveFieldValue(
            objectId,
            "Timeline.move.to.y",
            moveProps.to.y,
            ctx,
            numberCoerce,
          );
        }
        break;
      }

      case "rotate": {
        const rotateProps = updatedProperties as { from?: number; to?: number };
        if (typeof rotateProps.from === "number") {
          rotateProps.from = resolveFieldValue(
            objectId,
            "Timeline.rotate.from",
            rotateProps.from,
            ctx,
            numberCoerce,
          );
        }
        if (typeof rotateProps.to === "number") {
          rotateProps.to = resolveFieldValue(
            objectId,
            "Timeline.rotate.to",
            rotateProps.to,
            ctx,
            numberCoerce,
          );
        }
        break;
      }

      case "scale": {
        const scaleProps = updatedProperties as {
          from?: { x?: number; y?: number } | number;
          to?: { x?: number; y?: number } | number;
        };
        // Normalize to object form then resolve per-axis
        if (scaleProps.from !== undefined) {
          const fromObj =
            typeof scaleProps.from === "number"
              ? { x: scaleProps.from, y: scaleProps.from }
              : (scaleProps.from ?? {});
          const x = resolveFieldValue(
            objectId,
            "Timeline.scale.from.x",
            fromObj.x ?? 1,
            ctx,
            numberCoerce,
          );
          const y = resolveFieldValue(
            objectId,
            "Timeline.scale.from.y",
            fromObj.y ?? 1,
            ctx,
            numberCoerce,
          );
          scaleProps.from = { x, y } as unknown as Point2D;
        }
        if (scaleProps.to !== undefined) {
          const toObj =
            typeof scaleProps.to === "number"
              ? { x: scaleProps.to, y: scaleProps.to }
              : (scaleProps.to ?? {});
          const x = resolveFieldValue(
            objectId,
            "Timeline.scale.to.x",
            toObj.x ?? 1,
            ctx,
            numberCoerce,
          );
          const y = resolveFieldValue(
            objectId,
            "Timeline.scale.to.y",
            toObj.y ?? 1,
            ctx,
            numberCoerce,
          );
          scaleProps.to = { x, y } as unknown as Point2D;
        }
        break;
      }

      case "fade": {
        const fadeProps = updatedProperties as { from?: number; to?: number };
        if (typeof fadeProps.from === "number") {
          fadeProps.from = resolveFieldValue(
            objectId,
            "Timeline.fade.from",
            fadeProps.from,
            ctx,
            numberCoerce,
          );
        }
        if (typeof fadeProps.to === "number") {
          fadeProps.to = resolveFieldValue(
            objectId,
            "Timeline.fade.to",
            fadeProps.to,
            ctx,
            numberCoerce,
          );
        }
        break;
      }

      case "color": {
        const colorProps = updatedProperties as { from?: string; to?: string };
        if (typeof colorProps.from === "string") {
          colorProps.from = resolveFieldValue(
            objectId,
            "Timeline.color.from",
            colorProps.from,
            ctx,
            stringCoerce,
          );
        }
        if (typeof colorProps.to === "string") {
          colorProps.to = resolveFieldValue(
            objectId,
            "Timeline.color.to",
            colorProps.to,
            ctx,
            stringCoerce,
          );
        }
        break;
      }
    }

    return {
      ...track,
      properties: updatedProperties as unknown,
    } as AnimationTrack;
  });
}

export function convertTracksToSceneAnimations(
  tracks: AnimationTrack[],
  objectId: string,
  baselineTime: number,
  priorAnimations: SceneAnimationTrack[] = [],
  perObjectAssignments?: PerObjectAssignments,
  // Optional batch override context for Timeline batch overrides
  batchOverrideContext?: {
    batchKey: string | null;
    perObjectBatchOverrides?: Record<
      string,
      Record<string, Record<string, unknown>>
    >;
    perObjectBoundFields?: Record<string, string[]>;
  },
): SceneAnimationTrack[] {
  // Helper: deep-ish equality for 'from' defaults
  const isDefaultFrom = (type: string, value: unknown): boolean => {
    const defaults = transformFactory.getDefaultProperties(type);
    if (!defaults) return false;
    const def = defaults.from;
    switch (type) {
      case "move": {
        if (
          typeof def === "object" &&
          def !== null &&
          "x" in def &&
          "y" in def
        ) {
          const v = value as Point2D | undefined;
          const d = def as { x: number; y: number };
          return !!v && v.x === d.x && v.y === d.y;
        }
        return false;
      }
      case "rotate":
      case "scale": {
        if (
          typeof def === "object" &&
          def !== null &&
          "x" in def &&
          "y" in def
        ) {
          const v = value as Point2D | undefined;
          const d = def as { x: number; y: number };
          return !!v && v.x === d.x && v.y === d.y;
        }
        return false;
      }
      case "fade":
        return typeof def === "number" && value === def;
      case "color":
        return typeof def === "string" && value === def;
      default:
        return false;
    }
  };

  // Helper: get target property for a transform type
  const getTargetProperty = (type: string): string | undefined => {
    return transformFactory.getTransformDefinition(type)?.metadata
      ?.targetProperty;
  };

  // Helper: compute last value at a given absolute time from prior animations for the same target property
  const getPriorValue = (
    targetProperty: string | undefined,
    atTime: number,
    currentTrack?: AnimationTrack,
  ): unknown => {
    if (!targetProperty) return undefined;
    // Filter animations for this object and same target property
    let relevant = priorAnimations.filter(
      (a) =>
        a.objectId === objectId && getTargetProperty(a.type) === targetProperty,
    );

    // Special-case color: restrict to same fill/stroke property
    if (
      currentTrack?.type === "color" &&
      isColorProperties(currentTrack.properties)
    ) {
      const prop = currentTrack.properties.property;
      relevant = relevant.filter(
        (a) => a.type === "color" && a.properties.property === prop,
      );
    }
    if (relevant.length === 0) return undefined;

    // Prefer animations that have fully completed by 'atTime'
    const completed = relevant
      .filter((a) => atTime >= a.startTime + a.duration)
      .sort((a, b) => a.startTime + a.duration - (b.startTime + b.duration));
    if (completed.length > 0) {
      const last = completed[completed.length - 1]!;
      return transformEvaluator.getEndValue(sceneTrackToTransform(last));
    }

    // Fallback: sample the most recent animation at 'atTime'
    const sorted = relevant
      .filter((a) => atTime >= a.startTime && atTime < a.startTime + a.duration)
      .sort((a, b) => a.startTime - b.startTime);
    if (sorted.length > 0) {
      const last = sorted[sorted.length - 1]!;
      return transformEvaluator.evaluateTransform(
        sceneTrackToTransform(last),
        atTime,
      );
    }

    return undefined;
  };

  // Apply Timeline batch overrides to tracks if context provided
  const processedTracks = batchOverrideContext
    ? applyTimelineBatchOverridesToTracks(
        tracks,
        objectId,
        batchOverrideContext,
      )
    : tracks;

  const sceneTracks: SceneAnimationTrack[] = [];

  for (const track of processedTracks) {
    const overrides = perObjectAssignments?.[objectId]?.tracks;
    const override = pickOverridesForTrack(overrides, track);
    const baseTrack = override ? applyTrackOverride(track, override) : track;

    // Time calculations - startTime is relative to previous animation end, not baseline
    const effectiveStart =
      priorAnimations.length > 0
        ? Math.max(...priorAnimations.map((a) => a.startTime + a.duration)) +
          baseTrack.startTime
        : baselineTime + baseTrack.startTime;
    const properties = {
      ...(baseTrack.properties as unknown as Record<string, unknown>),
    };

    // Inheritance logic: auto-resolve unspecified 'from' values
    const defaultFrom = transformFactory.getDefaultProperties(
      baseTrack.type,
    )?.from;
    const tryComputeInherited = () =>
      getPriorValue(
        getTargetProperty(baseTrack.type),
        effectiveStart,
        baseTrack,
      );

    if (defaultFrom !== undefined) {
      const matchedOverride = perObjectAssignments?.[objectId]?.tracks?.find(
        (o: TrackOverride) =>
          (o.trackId && o.trackId === baseTrack.identifier.id) ??
          (!o.trackId && o.type === baseTrack.type),
      );
      const fromExplicitByOverride = !!(
        matchedOverride &&
        Object.prototype.hasOwnProperty.call(
          matchedOverride.properties ?? {},
          "from",
        )
      );

      // Type-safe property access instead of (baseTrack as any).properties.from
      const trackProps = baseTrack.properties as unknown as TrackProperties;
      const fromIsNonDefault = !isDefaultFrom(
        baseTrack.type,
        hasFromProperty(trackProps) ? trackProps.from : undefined,
      );
      const isFromExplicit = fromExplicitByOverride ?? fromIsNonDefault;

      if (
        !isFromExplicit &&
        hasFromProperty(properties) &&
        properties.from !== undefined &&
        defaultFrom !== undefined &&
        isDefaultFrom(baseTrack.type, properties.from)
      ) {
        const inh = tryComputeInherited();
        if (inh !== undefined) {
          (properties as Record<string, unknown>).from = inh;
        }
      }
      if (!isFromExplicit && !hasFromProperty(properties)) {
        const inh = tryComputeInherited();
        if (inh !== undefined) {
          (properties as Record<string, unknown>).from = inh;
        }
      }
    }

    // Use the registry system to create scene transforms
    const sceneTransform = transformFactory.createSceneTransform(
      {
        id: baseTrack.identifier.id,
        type: baseTrack.type,
        startTime: baseTrack.startTime,
        duration: baseTrack.duration,
        easing: baseTrack.easing,
        properties: properties as unknown as Record<string, unknown>,
      },
      objectId,
      baselineTime,
    );

    // Push typed scene animation track with a stable, collision-safe id
    const canonicalTrackId = baseTrack.identifier.id;
    sceneTracks.push({
      id: `${objectId}::${canonicalTrackId}::${effectiveStart}`,
      ...sceneTransform,
      properties: properties as SceneAnimationTrack["properties"],
    } as SceneAnimationTrack);
  }

  return sceneTracks;
}

function sceneTrackToTransform(track: SceneAnimationTrack): SceneTransform {
  return {
    objectId: track.objectId,
    type: track.type,
    startTime: track.startTime,
    duration: track.duration,
    easing: track.easing,
    properties: track.properties,
  };
}

export function extractObjectIdsFromInputs(
  inputs: Array<{ data: unknown }>,
): string[] {
  const ids: string[] = [];
  for (const input of inputs) {
    const items = Array.isArray(input.data) ? input.data : [input.data];
    for (const item of items) {
      if (typeof item === "object" && item !== null && "id" in item) {
        const id = (item as { id: unknown }).id;
        if (typeof id === "string") {
          ids.push(id);
        }
      }
    }
  }
  return ids;
}
