// src/animation/execution/scene-renderer.ts
import type { NodeCanvasContext, Point2D, Transform } from '@/shared/types/core';
import type { AnimationScene, SceneObject, ObjectState, TriangleProperties, CircleProperties, RectangleProperties, TextProperties } from '@/shared/types/scene';
import { Timeline } from '../scene/timeline';
import { drawTriangle, type TriangleStyle } from '../geometry/triangle';
import { drawCircle, type CircleStyle } from '../geometry/circle';
import { drawRectangle, type RectangleStyle } from '../geometry/rectangle';
import { drawText, type TextStyle } from '../geometry/text';

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
  drawCallback: () => void
): void {
  ctx.save();
  applyTransform(ctx, transform);
  drawCallback();
  ctx.restore();
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

  renderFrame(ctx: NodeCanvasContext, time: number): void {
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

      this.renderObject(ctx, object, state);
    }
  }

  private renderObject(ctx: NodeCanvasContext, object: SceneObject, state: ObjectState): void {
    const transform = {
      translate: state.position,
      rotate: state.rotation,
      scale: state.scale
    };

    // Apply opacity
    const originalAlpha = ctx.globalAlpha;
    ctx.globalAlpha = originalAlpha * state.opacity;

    saveAndTransform(ctx, transform, () => {
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
        case 'text':
          this.renderText(ctx, object, state);
          break;
      }
    });

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

  private renderText(ctx: NodeCanvasContext, object: SceneObject, state: ObjectState): void {
    const props = object.properties as TextProperties;
    const textStyle = object.textStyle; // Applied by TextStyle node

    const style: TextStyle = {
      // Typography Core (FROM TEXTSTYLE) - Keep unchanged
      fontFamily: textStyle?.fontFamily ?? 'Arial',
      fontSize: textStyle?.fontSize ?? props.fontSize, // TextStyle fontSize first
      fontWeight: textStyle?.fontWeight ?? 'normal',
      fontStyle: textStyle?.fontStyle ?? 'normal',
      
      // Text Layout (FROM TEXTSTYLE)  
      textAlign: (textStyle?.textAlign as TextStyle['textAlign']) ?? 'center',
      textBaseline: (textStyle?.textBaseline as TextStyle['textBaseline']) ?? 'middle',
      direction: (textStyle?.direction as TextStyle['direction']) ?? 'ltr',
      
      // Text Spacing (FROM TEXTSTYLE)
      lineHeight: textStyle?.lineHeight ?? 1.2,
      letterSpacing: textStyle?.letterSpacing ?? 0,
      
      // CHANGE: Prioritize TextStyle colors over ObjectState
      fillColor: textStyle?.fillColor ?? state.colors.fill,
      strokeColor: textStyle?.strokeColor ?? state.colors.stroke ?? '#ffffff',
      strokeWidth: textStyle?.strokeWidth ?? state.strokeWidth ?? 0,
      
      // Text Effects (FROM TEXTSTYLE) - Keep unchanged
      shadowColor: textStyle?.shadowColor,
      shadowOffsetX: textStyle?.shadowOffsetX ?? 0,
      shadowOffsetY: textStyle?.shadowOffsetY ?? 0,
      shadowBlur: textStyle?.shadowBlur ?? 0,
      textOpacity: textStyle?.textOpacity ?? 1,
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