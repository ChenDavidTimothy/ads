// src/server/animation-processing/scene/batch-overrides-resolver.ts
import { logger } from "@/lib/logger";
import type { SceneObject } from "@/shared/types/scene";

export type PerObjectBatchOverrides = Record<
  string, // objectId
  Record<
    string, // fieldPath
    Record<string, unknown> // { [batchKey | "default"]: value }
  >
>;

export type PerObjectBoundFields = Record<string, string[]>; // objectId -> fieldPaths

export interface BatchResolveContext {
  batchKey: string | null;
  perObjectBatchOverrides?: PerObjectBatchOverrides;
  perObjectBoundFields?: PerObjectBoundFields;
}

/**
 * Resolve a single field value for an object using precedence:
 * bound > per-key override > per-object default > currentValue
 * Does NOT mutate the object.
 */
export function resolveFieldValue<T = unknown>(
  objectId: string,
  fieldPath: string,
  currentValue: T,
  ctx: BatchResolveContext,
  validateAndCoerce: (value: unknown) => {
    ok: boolean;
    value?: T;
    warn?: string;
  },
): T {
  const boundSet = new Set(
    (ctx.perObjectBoundFields?.[objectId] ?? []).map(String),
  );
  if (boundSet.has(fieldPath)) {
    return currentValue;
  }

  const forObject = ctx.perObjectBatchOverrides?.[objectId];
  const byField = forObject?.[fieldPath];

  // Soft cap warning per object+field
  if (byField) {
    const keyCount = Object.keys(byField).length;
    if (keyCount > 200) {
      logger.warn("Excessive per-key overrides for field", {
        objectId,
        fieldPath,
        keys: keyCount,
      });
    }
  }

  const tryValue = (raw: unknown, tier: string): T | undefined => {
    const res = validateAndCoerce(raw);
    if (res.ok) return res.value as T;
    if (raw !== undefined) {
      logger.warn("Invalid override value, falling back", {
        objectId,
        fieldPath,
        tier,
        rawType: typeof raw,
        warn: res.warn ?? "invalid",
      });
    }
    return undefined;
  };

  // 1) per-key override (only if batchKey present)
  if (
    ctx.batchKey &&
    byField &&
    Object.prototype.hasOwnProperty.call(byField, ctx.batchKey)
  ) {
    const v = tryValue(byField[ctx.batchKey], "perKey");
    if (v !== undefined) return v;
  }

  // 2) per-object default
  if (byField && Object.prototype.hasOwnProperty.call(byField, "default")) {
    const v = tryValue(byField.default, "perObjectDefault");
    if (v !== undefined) return v;
  }

  // 3) currentValue (node default or previously resolved)
  return currentValue;
}

/**
 * Produce a new SceneObject with overrides applied per supported field paths.
 * Does NOT mutate the input object.
 */
export function applyOverridesToObject(
  obj: SceneObject,
  ctx: BatchResolveContext,
): SceneObject {
  // Clone shallowly to avoid mutation
  const next = JSON.parse(JSON.stringify(obj)) as SceneObject;

  const numberCoerce = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value))
      return { ok: true, value };
    if (
      typeof value === "string" &&
      value.trim() !== "" &&
      !Number.isNaN(Number(value))
    ) {
      return { ok: true, value: Number(value) };
    }
    return { ok: false, warn: "expected number" };
  };

  const stringCoerce = (value: unknown) => {
    if (typeof value === "string") return { ok: true, value };
    return { ok: false, warn: "expected string" };
  };

  // Canvas.position.x/y
  next.initialPosition = {
    x: resolveFieldValue(
      obj.id,
      "Canvas.position.x",
      next.initialPosition?.x ?? 0,
      ctx,
      numberCoerce,
    ),
    y: resolveFieldValue(
      obj.id,
      "Canvas.position.y",
      next.initialPosition?.y ?? 0,
      ctx,
      numberCoerce,
    ),
  };

  // Canvas.scale.x/y
  next.initialScale = {
    x: resolveFieldValue(
      obj.id,
      "Canvas.scale.x",
      next.initialScale?.x ?? 1,
      ctx,
      numberCoerce,
    ),
    y: resolveFieldValue(
      obj.id,
      "Canvas.scale.y",
      next.initialScale?.y ?? 1,
      ctx,
      numberCoerce,
    ),
  };

  // Canvas.rotation
  next.initialRotation = resolveFieldValue(
    obj.id,
    "Canvas.rotation",
    next.initialRotation ?? 0,
    ctx,
    numberCoerce,
  );

  // Canvas.opacity
  next.initialOpacity = resolveFieldValue(
    obj.id,
    "Canvas.opacity",
    next.initialOpacity ?? 1,
    ctx,
    numberCoerce,
  );

  // Colors
  next.initialFillColor = resolveFieldValue(
    obj.id,
    "Canvas.fillColor",
    next.initialFillColor ?? "#000000",
    ctx,
    stringCoerce,
  );
  next.initialStrokeColor = resolveFieldValue(
    obj.id,
    "Canvas.strokeColor",
    next.initialStrokeColor ?? "#000000",
    ctx,
    stringCoerce,
  );
  next.initialStrokeWidth = resolveFieldValue(
    obj.id,
    "Canvas.strokeWidth",
    next.initialStrokeWidth ?? 0,
    ctx,
    numberCoerce,
  );

  // Typography.content → text properties.content
  if (obj.type === "text") {
    const currentContent =
      (next.properties as { content?: string })?.content ?? "";
    const content = resolveFieldValue(
      obj.id,
      "Typography.content",
      currentContent,
      ctx,
      stringCoerce,
    );
    (next.properties as { content?: string }).content = content;
  }

  // Media.imageAssetId → image properties.assetId
  if (obj.type === "image") {
    const currentAssetId =
      (next.properties as { assetId?: string })?.assetId ?? undefined;
    const assetId = resolveFieldValue(
      obj.id,
      "Media.imageAssetId",
      currentAssetId,
      ctx,
      stringCoerce,
    );
    if (typeof assetId === "string") {
      (next.properties as { assetId?: string }).assetId = assetId;
    }
  }

  return next;
}
