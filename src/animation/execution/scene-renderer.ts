// src/animation/execution/scene-renderer.ts
import type {
  NodeCanvasContext,
  Point2D,
  Transform,
} from "@/shared/types/core";
import type {
  AnimationScene,
  SceneObject,
  ObjectState,
  TriangleProperties,
  CircleProperties,
  RectangleProperties,
  ImageProperties,
  TextProperties,
} from "@/shared/types/scene";
import { Timeline } from "../scene/timeline";
import { drawTriangle, type TriangleStyle } from "../geometry/triangle";
import { drawCircle, type CircleStyle } from "../geometry/circle";
import { drawRectangle, type RectangleStyle } from "../geometry/rectangle";
import { drawText, type Typography } from "../geometry/text";
import { loadImage, type Image } from "canvas";
// ADD this import after the existing canvas import
import { withTimeout } from "@/server/utils/timeout-utils";

function applyTranslation(
  ctx: NodeCanvasContext | CanvasRenderingContext2D,
  translation: Point2D,
): void {
  ctx.translate(Math.round(translation.x), Math.round(translation.y));
}

function applyRotation(
  ctx: NodeCanvasContext | CanvasRenderingContext2D,
  rotation: number,
): void {
  ctx.rotate(rotation);
}

function applyScale(
  ctx: NodeCanvasContext | CanvasRenderingContext2D,
  scale: Point2D,
): void {
  ctx.scale(scale.x, scale.y);
}

function applyTransform(
  ctx: NodeCanvasContext | CanvasRenderingContext2D,
  transform: Transform,
): void {
  applyTranslation(ctx, transform.translate);
  applyRotation(ctx, transform.rotate);
  applyScale(ctx, transform.scale);
}

function saveAndTransform(
  ctx: NodeCanvasContext | CanvasRenderingContext2D,
  transform: Transform,
  drawCallback: () => void | Promise<void>,
): void | Promise<void> {
  ctx.save();
  applyTransform(ctx, transform);
  const result = drawCallback();
  if (result instanceof Promise) {
    return result.then(() => {
      ctx.restore();
    });
  } else {
    ctx.restore();
    return result;
  }
}

export interface SceneRenderConfig {
  width: number;
  height: number;
  backgroundColor: string;
}

export class SceneRenderer {
  private scene: AnimationScene;
  private config: SceneRenderConfig;
  private timeline: Timeline;
  // ✅ REPLACE CACHE: Simple Map for preloaded images
  private loadedImages = new Map<string, Image>();
  private preloadPromise: Promise<void> | null = null;

  constructor(scene: AnimationScene, config: SceneRenderConfig) {
    this.scene = scene;
    this.config = config;
    this.timeline = new Timeline(scene);

    // ✅ PRELOAD: Load all images upfront (with error handling)
    try {
      this.preloadPromise = this.preloadImages();
    } catch (error) {
      console.error('[SCENE RENDERER] Preload initialization failed:', error);
      // Create a resolved promise so renderFrame doesn't hang
      this.preloadPromise = Promise.resolve();
    }
  }

  async renderFrame(ctx: NodeCanvasContext, time: number): Promise<void> {
    // ✅ ENSURE PRELOAD: Wait for images to be loaded before first render
    if (this.preloadPromise) {
      try {
        await this.preloadPromise;
      } catch (error) {
        console.error('[SCENE RENDERER] Preload failed during render:', error);
      }
      this.preloadPromise = null;
    }

    // Clear canvas with background
    const bgColor = this.scene.background?.color ?? this.config.backgroundColor;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, this.config.width, this.config.height);

    // Get current state of all objects using cached timeline index
    const sceneState = this.timeline.getSceneState(time);

    // Render each object
    for (const object of this.scene.objects) {
      const state = sceneState.get(object.id);
      if (!state) continue;

      await this.renderObject(ctx, object, state, time);
    }
  }

  private async renderObject(
    ctx: NodeCanvasContext,
    object: SceneObject,
    state: ObjectState,
    time: number,
  ): Promise<void> {
    const transform = {
      translate: state.position,
      rotate: state.rotation,
      scale: state.scale,
    };

    // Apply opacity
    const originalAlpha = ctx.globalAlpha;
    ctx.globalAlpha = originalAlpha * state.opacity;

    const result = saveAndTransform(ctx, transform, () => {
      switch (object.type) {
        case "triangle":
          this.renderTriangle(
            ctx,
            object.properties as TriangleProperties,
            state,
          );
          break;
        case "circle":
          this.renderCircle(ctx, object.properties as CircleProperties, state);
          break;
        case "rectangle":
          this.renderRectangle(
            ctx,
            object.properties as RectangleProperties,
            state,
          );
          break;
        case "image":
          return this.renderImage(
            ctx,
            object.properties as ImageProperties,
            state,
          );
        case "text":
          this.renderText(ctx, object, state, time);
          break;
      }
    });

    // Handle async result if present
    if (result instanceof Promise) {
      await result;
    }

    // Restore opacity
    ctx.globalAlpha = originalAlpha;
  }

  // Determine if a color animation exists for a specific property on an object
  private hasColorAnimationFor(
    objectId: string,
    property: "fill" | "stroke",
  ): boolean {
    return this.scene.animations.some(
      (a) =>
        a.objectId === objectId &&
        a.type === "color" &&
        (a as unknown as { properties?: { property?: string } }).properties
          ?.property === property,
    );
  }

  // Get the earliest start time for a color animation on a property
  private getEarliestColorAnimationStart(
    objectId: string,
    property: "fill" | "stroke",
  ): number | null {
    let earliest: number | null = null;
    for (const a of this.scene.animations) {
      if (a.objectId !== objectId || a.type !== "color") continue;
      const prop = (a as unknown as { properties?: { property?: string } })
        .properties?.property;
      if (prop !== property) continue;
      if (earliest == null || a.startTime < earliest) earliest = a.startTime;
    }
    return earliest;
  }

  private renderTriangle(
    ctx: NodeCanvasContext,
    props: TriangleProperties,
    state: ObjectState,
  ): void {
    const style: TriangleStyle = {
      fillColor: state.colors.fill,
      // Canvas/Animation must provide these - no fallback to props
      strokeColor: state.colors.stroke ?? "#ffffff",
      strokeWidth: state.strokeWidth, // ✅ CHANGE - Use ObjectState instead of hardcode
    };

    // Triangle is drawn at origin since transform is already applied
    drawTriangle(ctx, { x: 0, y: 0 }, props.size, 0, style);
  }

  private renderCircle(
    ctx: NodeCanvasContext,
    props: CircleProperties,
    state: ObjectState,
  ): void {
    const style: CircleStyle = {
      fillColor: state.colors.fill,
      // Canvas/Animation must provide these - no fallback to props
      strokeColor: state.colors.stroke ?? "#ffffff",
      strokeWidth: state.strokeWidth, // ✅ CHANGE - Use ObjectState instead of hardcode
    };

    drawCircle(ctx, { x: 0, y: 0 }, props.radius, style);
  }

  private renderRectangle(
    ctx: NodeCanvasContext,
    props: RectangleProperties,
    state: ObjectState,
  ): void {
    const style: RectangleStyle = {
      fillColor: state.colors.fill,
      // Canvas/Animation must provide these - no fallback to props
      strokeColor: state.colors.stroke ?? "#ffffff",
      strokeWidth: state.strokeWidth, // ✅ CHANGE - Use ObjectState instead of hardcode
    };

    // Draw rectangle centered at origin
    drawRectangle(
      ctx,
      { x: -props.width / 2, y: -props.height / 2 },
      props.width,
      props.height,
      style,
    );
  }

  // ✅ PRELOAD IMAGES: Load all images upfront to eliminate per-frame checks
  private async preloadImages(): Promise<void> {
    const imageUrls = new Set<string>();
    const assetsToLoad = new Map<string, SceneObject>();

    // Collect image URLs and assets that need loading
    for (const object of this.scene.objects) {
      if (object.type === "image") {
        const props = object.properties as ImageProperties;

        // Case 1: Direct imageUrl (already loaded by Media node in non-batch scenarios)
        if (props.imageUrl) {
          imageUrls.add(props.imageUrl);
        }
        // Case 2: assetId that needs loading (batch scenarios)
        else if (props.assetId) {
          assetsToLoad.set(props.assetId, object);
        }
      }
    }

    // Load assets and convert to imageUrls
    if (assetsToLoad.size > 0) {
      console.debug(`[PRELOAD] Loading ${assetsToLoad.size} assets from assetId`);

      try {
        // Dynamic imports to avoid circular dependencies
        const { createServiceClient } = await import("@/utils/supabase/service");
        const { STORAGE_CONFIG } = await import("@/server/storage/config");

        const supabase = createServiceClient();

        // Load all assets in parallel
        const assetLoadPromises = Array.from(assetsToLoad.entries()).map(async ([assetId, object]) => {
          try {
            const result = await supabase
              .from("user_assets")
              .select("bucket_name, storage_path, image_width, image_height")
              .eq("id", assetId)
              .single();

            const { data: asset, error } = result;
            if (!error && asset?.bucket_name && asset?.storage_path) {
              const { data: signedUrl, error: urlError } = await supabase.storage
                .from(asset.bucket_name)
                .createSignedUrl(asset.storage_path, STORAGE_CONFIG.SIGNED_URL_EXPIRY_SECONDS);

              if (!urlError && signedUrl) {
                // Update object properties with loaded URL
                const props = object.properties as ImageProperties;
                props.imageUrl = signedUrl.signedUrl;
                props.originalWidth = asset.image_width || 100;
                props.originalHeight = asset.image_height || 100;

                // Add to imageUrls for preloading
                imageUrls.add(signedUrl.signedUrl);

                console.debug(`[PRELOAD] ✓ Loaded asset ${assetId} -> URL`);
                return { success: true, assetId };
              }
            }
            console.warn(`[PRELOAD] ✗ Failed to get signed URL for asset ${assetId}`);
            return { success: false, assetId, error: "No signed URL" };
          } catch (error) {
            console.warn(`[PRELOAD] ✗ Failed to load asset ${assetId}:`, error);
            return { success: false, assetId, error };
          }
        });

        const assetResults = await Promise.allSettled(assetLoadPromises);
        const assetSuccessful = assetResults.filter(r => r.status === 'fulfilled' && r.value?.success).length;
        const assetFailed = assetResults.filter(r => r.status === 'fulfilled' && !r.value?.success).length;

        console.debug(`[PRELOAD] Asset loading: ${assetSuccessful} successful, ${assetFailed} failed`);
      } catch (error) {
        console.error(`[PRELOAD] Asset loading system failed:`, error);
      }
    }

    console.debug(`[PRELOAD] Starting image preload of ${imageUrls.size} URLs`);

    // Load all images in parallel with individual error handling
    const loadPromises = Array.from(imageUrls).map(async (imageUrl) => {
      try {
        console.debug(`[PRELOAD] Loading image: ${imageUrl}`);
        const img = await withTimeout(
          loadImage(imageUrl),
          30000,
          `Image preload timeout for: ${imageUrl}`,
        );
        this.loadedImages.set(imageUrl, img);
        console.debug(`[PRELOAD] ✓ Loaded: ${imageUrl}`);
        return { success: true, url: imageUrl };
      } catch (error) {
        console.warn(`[PRELOAD] ✗ Failed to load ${imageUrl}:`, error);
        return { success: false, url: imageUrl, error };
      }
    });

    // Use Promise.allSettled so failures don't break scene creation
    const results = await Promise.allSettled(loadPromises);

    const successful = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
    const failed = results.filter(r => r.status === 'fulfilled' && !r.value?.success).length;

    console.debug(`[PRELOAD] Completed - ${successful} successful, ${failed} failed, total loaded: ${this.loadedImages.size}`);

    // Scene can proceed even if some images failed to preload
    if (failed > 0) {
      console.warn(`[PRELOAD] ${failed} images failed to preload, but scene will continue`);
    }
  }

  // ✅ NO MORE CACHE CHECKS: Just draw preloaded images
  private async renderImage(
    ctx: NodeCanvasContext,
    props: ImageProperties,
    _state: ObjectState,
  ): Promise<void> {
    // ✅ STRICT POLICY: Only use provided imageUrl, no download API fallback
    if (!props.imageUrl) {
      console.warn(`Missing imageUrl for asset ${props.assetId || 'unknown'} - rendering placeholder`);
      this.drawImagePlaceholder(
        ctx,
        props.displayWidth || 100,
        props.displayHeight || 100,
      );
      return;
    }

    // ✅ SIMPLE: Just get preloaded image - no cache checks, no async loading
    const img = this.loadedImages.get(props.imageUrl);

    if (!img) {
      console.warn(`[RENDER] Image not preloaded: ${props.imageUrl} - rendering placeholder`);
      this.drawImagePlaceholder(
        ctx,
        props.displayWidth || 100,
        props.displayHeight || 100,
      );
      return;
    }

    console.debug(`[RENDER] Drawing preloaded image: ${props.imageUrl}`);

    // Existing crop/display logic (unchanged)
    const srcX = props.cropX ?? 0;
    const srcY = props.cropY ?? 0;
    const srcWidth = props.cropWidth && props.cropWidth !== 0 ? props.cropWidth : img.width;
    const srcHeight = props.cropHeight && props.cropHeight !== 0 ? props.cropHeight : img.height;
    const destWidth = props.displayWidth && props.displayWidth !== 0 ? props.displayWidth : srcWidth;
    const destHeight = props.displayHeight && props.displayHeight !== 0 ? props.displayHeight : srcHeight;

    ctx.drawImage(img, srcX, srcY, srcWidth, srcHeight, 0, 0, destWidth, destHeight);
  }

  private drawImagePlaceholder(
    ctx: NodeCanvasContext,
    width: number,
    height: number,
  ): void {
    // Draw placeholder rectangle
    ctx.fillStyle = "#cccccc";
    ctx.strokeStyle = "#999999";
    ctx.lineWidth = 2;
    ctx.fillRect(-width / 2, -height / 2, width, height);
    ctx.strokeRect(-width / 2, -height / 2, width, height);

    // Add text to indicate it's a placeholder
    ctx.fillStyle = "#666666";
    ctx.font = "16px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("IMAGE PLACEHOLDER", 0, 0);
  }

  private renderText(
    ctx: NodeCanvasContext,
    object: SceneObject,
    state: ObjectState,
    time: number,
  ): void {
    const props = object.properties as TextProperties;
    const typography = object.typography; // Applied by Typography node

    // Determine per-property precedence for colors:
    // - Before first color animation starts: use Typography color if provided
    // - From the first color animation start onward: use animated state color (persists after end)
    const hasFillAnim = this.hasColorAnimationFor(object.id, "fill");
    const hasStrokeAnim = this.hasColorAnimationFor(object.id, "stroke");
    const earliestFillStart = hasFillAnim
      ? this.getEarliestColorAnimationStart(object.id, "fill")
      : null;
    const earliestStrokeStart = hasStrokeAnim
      ? this.getEarliestColorAnimationStart(object.id, "stroke")
      : null;

    const useAnimatedFill =
      earliestFillStart != null ? time >= earliestFillStart : false;
    const useAnimatedStroke =
      earliestStrokeStart != null ? time >= earliestStrokeStart : false;

    const resolvedFillColor = useAnimatedFill
      ? state.colors.fill
      : (typography?.fillColor ?? state.colors.fill);
    const resolvedStrokeColor = useAnimatedStroke
      ? state.colors.stroke
      : (typography?.strokeColor ?? state.colors.stroke ?? "#ffffff");

    const style: Typography = {
      // Typography Core (FROM TYPOGRAPHY) - Keep unchanged
      fontFamily: typography?.fontFamily ?? "Arial",
      fontSize: props.fontSize, // Always use Text node fontSize
      fontWeight: typography?.fontWeight ?? "normal",
      fontStyle: typography?.fontStyle ?? "normal",
      // Colors with animation-aware precedence
      fillColor: resolvedFillColor,
      strokeColor: resolvedStrokeColor,
      strokeWidth: typography?.strokeWidth ?? state.strokeWidth ?? 0,
    };

    // Cast to CanvasRenderingContext2D for text rendering
    drawText(
      ctx as unknown as CanvasRenderingContext2D,
      { x: 0, y: 0 },
      props.content,
      style,
    );
  }

  // ✅ CLEANUP: Clear preloaded images
  dispose(): void {
    this.loadedImages.clear();
  }
}

// ------------------------------------------------------------
// ✅ REMOVED: Global caching no longer needed with preloading strategy
// ------------------------------------------------------------

// Factory function to create common scene patterns
export function createSimpleScene(duration: number): AnimationScene {
  return {
    duration,
    objects: [],
    animations: [],
    background: {
      color: "#000000",
    },
  };
}

// Helper to add objects to scene
export function addTriangleToScene(
  scene: AnimationScene,
  id: string,
  position: Point2D,
  size: number,
): void {
  scene.objects.push({
    id,
    type: "triangle",
    properties: {
      size,
    },
    initialPosition: position,
    initialRotation: 0,
    initialScale: { x: 1, y: 1 },
    initialOpacity: 1,
  });
}

export function addCircleToScene(
  scene: AnimationScene,
  id: string,
  position: Point2D,
  radius: number,
): void {
  scene.objects.push({
    id,
    type: "circle",
    properties: {
      radius,
    },
    initialPosition: position,
    initialRotation: 0,
    initialScale: { x: 1, y: 1 },
    initialOpacity: 1,
  });
}

export function addRectangleToScene(
  scene: AnimationScene,
  id: string,
  position: Point2D,
  width: number,
  height: number,
): void {
  scene.objects.push({
    id,
    type: "rectangle",
    properties: {
      width,
      height,
    },
    initialPosition: position,
    initialRotation: 0,
    initialScale: { x: 1, y: 1 },
    initialOpacity: 1,
  });
}
