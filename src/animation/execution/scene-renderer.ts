// src/animation/execution/scene-renderer.ts
import type { NodeCanvasContext, Point2D, Transform } from '@/shared/types/core';
import type { AnimationScene, SceneObject, ObjectState, TriangleProperties, CircleProperties, RectangleProperties, ImageProperties, TextProperties } from '@/shared/types/scene';
import { Timeline } from '../scene/timeline';
import { drawTriangle, type TriangleStyle } from '../geometry/triangle';
import { drawCircle, type CircleStyle } from '../geometry/circle';
import { drawRectangle, type RectangleStyle } from '../geometry/rectangle';
import { drawText, type Typography } from '../geometry/text';
import { loadImage } from 'canvas';

function applyTranslation(
  ctx: NodeCanvasContext | CanvasRenderingContext2D,
  translation: Point2D
): void {
  ctx.translate(Math.round(translation.x), Math.round(translation.y));
}

function applyRotation(
  ctx: NodeCanvasContext | CanvasRenderingContext2D,
  rotation: number
): void {
  ctx.rotate(rotation);
}

function applyScale(
  ctx: NodeCanvasContext | CanvasRenderingContext2D,
  scale: Point2D
): void {
  ctx.scale(scale.x, scale.y);
}

function applyTransform(
  ctx: NodeCanvasContext | CanvasRenderingContext2D,
  transform: Transform
): void {
  applyTranslation(ctx, transform.translate);
  applyRotation(ctx, transform.rotate);
  applyScale(ctx, transform.scale);
}

function saveAndTransform(
  ctx: NodeCanvasContext | CanvasRenderingContext2D,
  transform: Transform,
  drawCallback: () => void | Promise<void>
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

  constructor(scene: AnimationScene, config: SceneRenderConfig) {
    this.scene = scene;
    this.config = config;
    this.timeline = new Timeline(scene);
  }

  async renderFrame(ctx: NodeCanvasContext, time: number): Promise<void> {
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

      await this.renderObject(ctx, object, state);
    }
  }

  private async renderObject(ctx: NodeCanvasContext, object: SceneObject, state: ObjectState): Promise<void> {
    const transform = {
      translate: state.position,
      rotate: state.rotation,
      scale: state.scale
    };

    // Apply opacity
    const originalAlpha = ctx.globalAlpha;
    ctx.globalAlpha = originalAlpha * state.opacity;

    const result = saveAndTransform(ctx, transform, () => {
      switch (object.type) {
        case 'triangle':
          this.renderTriangle(ctx, object.properties as TriangleProperties, state);
          break;
        case 'circle':
          this.renderCircle(ctx, object.properties as CircleProperties, state);
          break;
        case 'rectangle':
          this.renderRectangle(ctx, object.properties as RectangleProperties, state);
          break;
        case 'image':
          return this.renderImage(ctx, object.properties as ImageProperties, state);
        case 'text':
          this.renderText(ctx, object, state);
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

  private renderTriangle(ctx: NodeCanvasContext, props: TriangleProperties, state: ObjectState): void {
    const style: TriangleStyle = {
      fillColor: state.colors.fill,
      // Canvas/Animation must provide these - no fallback to props
      strokeColor: state.colors.stroke ?? '#ffffff', 
      strokeWidth: state.strokeWidth  // ✅ CHANGE - Use ObjectState instead of hardcode
    };

    // Triangle is drawn at origin since transform is already applied
    drawTriangle(ctx, { x: 0, y: 0 }, props.size, 0, style);
  }

  private renderCircle(ctx: NodeCanvasContext, props: CircleProperties, state: ObjectState): void {
    const style: CircleStyle = {
      fillColor: state.colors.fill,
      // Canvas/Animation must provide these - no fallback to props
      strokeColor: state.colors.stroke ?? '#ffffff',
      strokeWidth: state.strokeWidth  // ✅ CHANGE - Use ObjectState instead of hardcode
    };

    drawCircle(ctx, { x: 0, y: 0 }, props.radius, style);
  }

  private renderRectangle(ctx: NodeCanvasContext, props: RectangleProperties, state: ObjectState): void {
    const style: RectangleStyle = {
      fillColor: state.colors.fill,
      // Canvas/Animation must provide these - no fallback to props
      strokeColor: state.colors.stroke ?? '#ffffff',
      strokeWidth: state.strokeWidth  // ✅ CHANGE - Use ObjectState instead of hardcode
    };

    // Draw rectangle centered at origin
    drawRectangle(ctx, { x: -props.width / 2, y: -props.height / 2 }, props.width, props.height, style);
  }

  private async renderImage(ctx: NodeCanvasContext, props: ImageProperties, _state: ObjectState): Promise<void> {
    // Skip rendering if no image URL
    if (!props.imageUrl) return;

    // Calculate final dimensions based on crop and display settings
    // cropWidth/Height = 0 means "use original size"
    // displayWidth/Height = 0 means "use crop size"
    const cropWidth = props.cropWidth !== 0 ? props.cropWidth : (props.originalWidth ?? 100);
    const cropHeight = props.cropHeight !== 0 ? props.cropHeight : (props.originalHeight ?? 100);
    const finalWidth = props.displayWidth !== 0 ? props.displayWidth : cropWidth;
    const finalHeight = props.displayHeight !== 0 ? props.displayHeight : cropHeight;
    
    // Ensure we have valid dimensions
    const width = finalWidth ?? 100;
    const height = finalHeight ?? 100;
    
    // Try to load and render the actual image
    try {
      // Load the image and wait for it to complete
      const img = await loadImage(props.imageUrl);
      
      // Calculate crop and display parameters
      const srcX = props.cropX ?? 0;
      const srcY = props.cropY ?? 0;
      const srcWidth = props.cropWidth !== 0 ? props.cropWidth : img.width;
      const srcHeight = props.cropHeight !== 0 ? props.cropHeight : img.height;
      
      // Ensure source dimensions are valid numbers
      const finalSrcWidth = srcWidth ?? img.width;
      const finalSrcHeight = srcHeight ?? img.height;
      
      // Draw the image at top-left corner (0, 0)
      ctx.drawImage(
        img,
        srcX, srcY, finalSrcWidth, finalSrcHeight,  // Source rectangle
        0, 0, width, height  // Destination rectangle: top-left corner
      );
      
    } catch {
      // Fallback to placeholder if image loading fails
      this.drawImagePlaceholder(ctx, width, height);
    }
  }
  
  private drawImagePlaceholder(ctx: NodeCanvasContext, width: number, height: number): void {
    // Draw placeholder rectangle
    ctx.fillStyle = '#cccccc';
    ctx.strokeStyle = '#999999';
    ctx.lineWidth = 2;
    ctx.fillRect(-width / 2, -height / 2, width, height);
    ctx.strokeRect(-width / 2, -height / 2, width, height);
    
    // Add text to indicate it's a placeholder
    ctx.fillStyle = '#666666';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('IMAGE PLACEHOLDER', 0, 0);
  }

  private renderText(ctx: NodeCanvasContext, object: SceneObject, state: ObjectState): void {
    const props = object.properties as TextProperties;
    const typography = object.typography; // Applied by Typography node

    const style: Typography = {
      // Typography Core (FROM TYPOGRAPHY) - Keep unchanged
      fontFamily: typography?.fontFamily ?? 'Arial',
      fontSize: props.fontSize, // Always use Text node fontSize
      fontWeight: typography?.fontWeight ?? 'normal',
      fontStyle: typography?.fontStyle ?? 'normal',
      
      // Colors (FROM TYPOGRAPHY) - Prioritize Typography colors over ObjectState
      fillColor: typography?.fillColor ?? state.colors.fill,
      strokeColor: typography?.strokeColor ?? state.colors.stroke ?? '#ffffff',
      strokeWidth: typography?.strokeWidth ?? state.strokeWidth ?? 0,
    };

    // Cast to CanvasRenderingContext2D for text rendering
    drawText(ctx as unknown as CanvasRenderingContext2D, { x: 0, y: 0 }, props.content, style);
  }
}

// Factory function to create common scene patterns
export function createSimpleScene(duration: number): AnimationScene {
  return {
    duration,
    objects: [],
    animations: [],
    background: {
      color: '#000000'
    }
  };
}

// Helper to add objects to scene
export function addTriangleToScene(
  scene: AnimationScene,
  id: string,
  position: Point2D,
  size: number
): void {
  scene.objects.push({
    id,
    type: 'triangle',
    properties: {
      size
    },
    initialPosition: position,
    initialRotation: 0,
    initialScale: { x: 1, y: 1 },
    initialOpacity: 1
  });
}

export function addCircleToScene(
  scene: AnimationScene,
  id: string,
  position: Point2D,
  radius: number
): void {
  scene.objects.push({
    id,
    type: 'circle',
    properties: {
      radius
    },
    initialPosition: position,
    initialRotation: 0,
    initialScale: { x: 1, y: 1 },
    initialOpacity: 1
  });
}

export function addRectangleToScene(
  scene: AnimationScene,
  id: string,
  position: Point2D,
  width: number,
  height: number
): void {
  scene.objects.push({
    id,
    type: 'rectangle',
    properties: {
      width,
      height
    },
    initialPosition: position,
    initialRotation: 0,
    initialScale: { x: 1, y: 1 },
    initialOpacity: 1
  });
}