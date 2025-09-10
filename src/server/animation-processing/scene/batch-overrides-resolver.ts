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
  // 🔍 DEBUG: Log all parameters
  logger.debug(`[BATCH RESOLVER DEBUG] resolveFieldValue - ${objectId}:`, {
    fieldPath,
    currentValue,
    batchKey: ctx.batchKey,
    hasPerObjectBatchOverrides: !!ctx.perObjectBatchOverrides,
    objectHasBatchOverrides: !!ctx.perObjectBatchOverrides?.[objectId],
    fieldBatchOverrides: ctx.perObjectBatchOverrides?.[objectId]?.[fieldPath],
    hasPerObjectBoundFields: !!ctx.perObjectBoundFields,
    objectBoundFields: ctx.perObjectBoundFields?.[objectId],
    isFieldBound: ctx.perObjectBoundFields?.[objectId]?.includes(fieldPath),
  });

  const boundSet = new Set(
    (ctx.perObjectBoundFields?.[objectId] ?? []).map(String),
  );
  if (boundSet.has(fieldPath)) {
    logger.debug(`[BATCH RESOLVER DEBUG] Field is bound - ${objectId}:${fieldPath} - returning currentValue`);
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
    // 🔍 DEBUG: Log per-key override lookup
    logger.debug(`[BATCH RESOLVER DEBUG] Looking for per-key override - ${objectId}:${fieldPath}:`, {
      batchKey: ctx.batchKey,
      availableKeys: Object.keys(byField),
      hasKeyOverride: ctx.batchKey in byField,
      keyOverrideValue: byField[ctx.batchKey],
    });

    const v = tryValue(byField[ctx.batchKey], "perKey");
    if (v !== undefined) {
      logger.debug(`[BATCH RESOLVER DEBUG] Using per-key override - ${objectId}:${fieldPath}:${ctx.batchKey} = ${v}`);
      return v;
    }
  }

  // 2) per-object default
  if (byField && Object.prototype.hasOwnProperty.call(byField, "__default__")) {
    // 🔍 DEBUG: Log default override lookup
    logger.debug(`[BATCH RESOLVER DEBUG] Looking for default override - ${objectId}:${fieldPath}:`, {
      hasDefaultOverride: "__default__" in byField,
      defaultOverrideValue: byField.__default__,
    });

    const v = tryValue(byField.__default__, "perObjectDefault");
    if (v !== undefined) {
      logger.debug(`[BATCH RESOLVER DEBUG] Using default override - ${objectId}:${fieldPath}:__default__ = ${v}`);
      return v;
    }
  }

  // 3) currentValue (node default or previously resolved)
  logger.debug(`[BATCH RESOLVER DEBUG] No override found - ${objectId}:${fieldPath} - returning currentValue: ${currentValue}`);
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
  // 🔍 DEBUG: Log incoming parameters
  logger.debug(`[BATCH RESOLVER DEBUG] applyOverridesToObject - ${obj.id}:`, {
    objectType: obj.type,
    objectId: obj.id,
    batchKey: ctx.batchKey,
    hasPerObjectBatchOverrides: !!ctx.perObjectBatchOverrides,
    objectBatchOverrides: ctx.perObjectBatchOverrides?.[obj.id],
    hasPerObjectBoundFields: !!ctx.perObjectBoundFields,
    objectBoundFields: ctx.perObjectBoundFields?.[obj.id],
  });

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

    // Apply Typography style fields to object.typography (non-destructive)
    const currentTypography = (next.typography ?? {}) as Record<
      string,
      unknown
    >;
    const withTypography: Record<string, unknown> = { ...currentTypography };

    const fontFamily = resolveFieldValue(
      obj.id,
      "Typography.fontFamily",
      (currentTypography.fontFamily as string | undefined) ?? undefined,
      ctx,
      stringCoerce,
    );
    if (fontFamily !== undefined) withTypography.fontFamily = fontFamily;

    const fontWeight = resolveFieldValue(
      obj.id,
      "Typography.fontWeight",
      (currentTypography.fontWeight as string | undefined) ?? undefined,
      ctx,
      stringCoerce,
    );
    if (fontWeight !== undefined) withTypography.fontWeight = fontWeight;

    const fontStyle = resolveFieldValue(
      obj.id,
      "Typography.fontStyle",
      (currentTypography.fontStyle as string | undefined) ?? undefined,
      ctx,
      stringCoerce,
    );
    if (fontStyle !== undefined) withTypography.fontStyle = fontStyle;

    const fillColor = resolveFieldValue(
      obj.id,
      "Typography.fillColor",
      (currentTypography.fillColor as string | undefined) ?? undefined,
      ctx,
      stringCoerce,
    );
    if (fillColor !== undefined) withTypography.fillColor = fillColor;

    const strokeColor = resolveFieldValue(
      obj.id,
      "Typography.strokeColor",
      (currentTypography.strokeColor as string | undefined) ?? undefined,
      ctx,
      stringCoerce,
    );
    if (strokeColor !== undefined) withTypography.strokeColor = strokeColor;

    const strokeWidth = resolveFieldValue(
      obj.id,
      "Typography.strokeWidth",
      (currentTypography.strokeWidth as number | undefined) ?? undefined,
      ctx,
      numberCoerce,
    );
    if (strokeWidth !== undefined) withTypography.strokeWidth = strokeWidth;

    if (Object.keys(withTypography).length > 0) {
      // Ensure typography block exists
      (next as { typography?: Record<string, unknown> }).typography =
        withTypography;
    }
  }

  // Media.imageAssetId → image properties.assetId
  if (obj.type === "image") {
    const currentAssetId =
      (next.properties as { assetId?: string })?.assetId ?? undefined;

    // 🔍 DEBUG: Log before resolveFieldValue
    logger.debug(`[BATCH RESOLVER DEBUG] Before resolveFieldValue - ${obj.id}:`, {
      currentAssetId,
      willCallResolveFieldValue: true,
    });

    const assetId = resolveFieldValue(
      obj.id,
      "Media.imageAssetId",
      currentAssetId,
      ctx,
      stringCoerce,
    );

    // 🔍 DEBUG: Log after resolveFieldValue
    logger.debug(`[BATCH RESOLVER DEBUG] After resolveFieldValue - ${obj.id}:`, {
      resolvedAssetId: assetId,
      assetIdType: typeof assetId,
      willSetProperty: typeof assetId === "string",
    });

    if (typeof assetId === "string") {
      (next.properties as { assetId?: string }).assetId = assetId;
      // 🔍 DEBUG: Confirm property was set
      logger.debug(`[BATCH RESOLVER DEBUG] Property set - ${obj.id}:`, {
        setAssetId: assetId,
        finalPropertiesAssetId: (next.properties as { assetId?: string }).assetId,
      });
    }

    // Apply remaining Media fields to image properties
    const coerceNum = numberCoerce;
    const props = next.properties as unknown as Record<string, unknown>;
    const cropX = resolveFieldValue(
      obj.id,
      "Media.cropX",
      (props.cropX as number | undefined) ?? 0,
      ctx,
      coerceNum,
    );
    props.cropX = cropX;
    const cropY = resolveFieldValue(
      obj.id,
      "Media.cropY",
      (props.cropY as number | undefined) ?? 0,
      ctx,
      coerceNum,
    );
    props.cropY = cropY;
    const cropWidth = resolveFieldValue(
      obj.id,
      "Media.cropWidth",
      (props.cropWidth as number | undefined) ?? 0,
      ctx,
      coerceNum,
    );
    props.cropWidth = cropWidth;
    const cropHeight = resolveFieldValue(
      obj.id,
      "Media.cropHeight",
      (props.cropHeight as number | undefined) ?? 0,
      ctx,
      coerceNum,
    );
    props.cropHeight = cropHeight;
    const displayWidth = resolveFieldValue(
      obj.id,
      "Media.displayWidth",
      (props.displayWidth as number | undefined) ?? 0,
      ctx,
      coerceNum,
    );
    props.displayWidth = displayWidth;
    const displayHeight = resolveFieldValue(
      obj.id,
      "Media.displayHeight",
      (props.displayHeight as number | undefined) ?? 0,
      ctx,
      coerceNum,
    );
    props.displayHeight = displayHeight;
  }

  // Timeline animation tracks - these are handled differently
  // The animation executor should apply track-specific batch overrides
  // But we don't need to resolve them here as they're applied during animation processing

  return next;
}
