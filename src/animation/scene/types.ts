// src/animation/scene/types.ts
import type { Point2D } from '../types';

// Scene-specific animation track types (with objectId for execution)
export interface BaseSceneAnimationTrack {
  objectId: string;
  startTime: number;
  duration: number;
  easing: 'linear' | 'easeInOut' | 'easeIn' | 'easeOut';
}

export interface SceneMoveTrack extends BaseSceneAnimationTrack {
  type: 'move';
  properties: {
    from: Point2D;
    to: Point2D;
  };
}

export interface SceneRotateTrack extends BaseSceneAnimationTrack {
  type: 'rotate';
  properties: {
    from: number;
    to: number;
    rotations?: number;
  };
}

export interface SceneScaleTrack extends BaseSceneAnimationTrack {
  type: 'scale';
  properties: {
    from: number | Point2D;
    to: number | Point2D;
  };
}

export interface SceneFadeTrack extends BaseSceneAnimationTrack {
  type: 'fade';
  properties: {
    from: number;
    to: number;
  };
}

export interface SceneColorTrack extends BaseSceneAnimationTrack {
  type: 'color';
  properties: {
    from: string;
    to: string;
    property: 'fill' | 'stroke';
  };
}

export type SceneAnimationTrack = 
  | SceneMoveTrack 
  | SceneRotateTrack 
  | SceneScaleTrack 
  | SceneFadeTrack 
  | SceneColorTrack;