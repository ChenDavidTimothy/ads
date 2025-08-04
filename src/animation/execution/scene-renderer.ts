// src/animation/execution/scene-renderer.ts
import type { NodeCanvasContext, Point2D } from '../types';
import type { AnimationScene, SceneObject, ObjectState, TriangleProperties, CircleProperties, RectangleProperties } from '../scene/scene';
import { getSceneStateAtTime } from '../scene/timeline';
import { drawTriangle, type TriangleStyle } from '../geometry/triangle';
import { drawCircle, type CircleStyle } from '../geometry/circle';
import { drawRectangle, type RectangleStyle } from '../geometry/rectangle';
import { saveAndTransform } from '../core/transforms';

export interface SceneRenderConfig {
  width: number;
  height: number;
  backgroundColor: string;
}

export class SceneRenderer {
  private scene: AnimationScene;
  private config: SceneRenderConfig;

  constructor(scene: AnimationScene, config: SceneRenderConfig) {
    this.scene = scene;
    this.config = config;
  }

  renderFrame(ctx: NodeCanvasContext, time: number): void {
    // Clear canvas with background
    const bgColor = this.scene.background?.color ?? this.config.backgroundColor;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, this.config.width, this.config.height);

    // Get current state of all objects
    const sceneState = getSceneStateAtTime(this.scene, time);

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
      }
    });

    // Restore opacity
    ctx.globalAlpha = originalAlpha;
  }

  private renderTriangle(ctx: NodeCanvasContext, props: TriangleProperties, state: ObjectState): void {
    const style: TriangleStyle = {
      fillColor: state.colors.fill,
      strokeColor: state.colors.stroke ?? props.strokeColor ?? '#ffffff',
      strokeWidth: props.strokeWidth ?? 2
    };

    // Triangle is drawn at origin since transform is already applied
    drawTriangle(ctx, { x: 0, y: 0 }, props.size, 0, style);
  }

  private renderCircle(ctx: NodeCanvasContext, props: CircleProperties, state: ObjectState): void {
    const style: CircleStyle = {
      fillColor: state.colors.fill,
      strokeColor: state.colors.stroke ?? props.strokeColor ?? '#ffffff',
      strokeWidth: props.strokeWidth ?? 2
    };

    drawCircle(ctx, { x: 0, y: 0 }, props.radius, style);
  }

  private renderRectangle(ctx: NodeCanvasContext, props: RectangleProperties, state: ObjectState): void {
    const style: RectangleStyle = {
      fillColor: state.colors.fill,
      strokeColor: state.colors.stroke ?? props.strokeColor ?? '#ffffff',
      strokeWidth: props.strokeWidth ?? 2
    };

    // Draw rectangle centered at origin
    drawRectangle(ctx, { x: -props.width / 2, y: -props.height / 2 }, props.width, props.height, style);
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
  size: number,
  color: string,
  strokeColor?: string,
  strokeWidth?: number
): void {
  scene.objects.push({
    id,
    type: 'triangle',
    properties: {
      size,
      color,
      strokeColor,
      strokeWidth
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
  radius: number,
  color: string,
  strokeColor?: string,
  strokeWidth?: number
): void {
  scene.objects.push({
    id,
    type: 'circle',
    properties: {
      radius,
      color,
      strokeColor,
      strokeWidth
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
  height: number,
  color: string,
  strokeColor?: string,
  strokeWidth?: number
): void {
  scene.objects.push({
    id,
    type: 'rectangle',
    properties: {
      width,
      height,
      color,
      strokeColor,
      strokeWidth
    },
    initialPosition: position,
    initialRotation: 0,
    initialScale: { x: 1, y: 1 },
    initialOpacity: 1
  });
}