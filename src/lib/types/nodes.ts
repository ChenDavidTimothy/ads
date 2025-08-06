// src/lib/types/nodes.ts - Updated to match API schema
import type { Point2D } from "@/animation/types";

// Base node data interface
export interface BaseNodeData {
  id: string;
}

// Geometry node data types
export interface TriangleNodeData extends BaseNodeData {
  size: number;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  position: Point2D;
}

export interface CircleNodeData extends BaseNodeData {
  radius: number;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  position: Point2D;
}

export interface RectangleNodeData extends BaseNodeData {
  width: number;
  height: number;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  position: Point2D;
}

export type GeometryNodeData = TriangleNodeData | CircleNodeData | RectangleNodeData;

// Insert node data
export interface InsertNodeData extends BaseNodeData {
  appearanceTime: number;
}

// Animation track properties - aligned with API schema
export interface MoveTrackProperties {
  from: Point2D;
  to: Point2D;
}

export interface RotateTrackProperties {
  rotations: number;
}

export interface ScaleTrackProperties {
  from: number;
  to: number;
}

export interface FadeTrackProperties {
  from: number;
  to: number;
}

export interface ColorTrackProperties {
  from: string;
  to: string;
  property: 'fill' | 'stroke';
}

// Animation track types - aligned with API schema
export interface BaseAnimationTrack {
  id: string;
  startTime: number;
  duration: number;
  easing: 'linear' | 'easeInOut' | 'easeIn' | 'easeOut';
}

export interface MoveTrack extends BaseAnimationTrack {
  type: 'move';
  properties: MoveTrackProperties;
}

export interface RotateTrack extends BaseAnimationTrack {
  type: 'rotate';
  properties: RotateTrackProperties;
}

export interface ScaleTrack extends BaseAnimationTrack {
  type: 'scale';
  properties: ScaleTrackProperties;
}

export interface FadeTrack extends BaseAnimationTrack {
  type: 'fade';
  properties: FadeTrackProperties;
}

export interface ColorTrack extends BaseAnimationTrack {
  type: 'color';
  properties: ColorTrackProperties;
}

export type AnimationTrack = MoveTrack | RotateTrack | ScaleTrack | FadeTrack | ColorTrack;

// Animation node data
export interface AnimationNodeData extends BaseNodeData {
  duration: number;
  tracks: AnimationTrack[];
}

// Scene node data
export interface SceneNodeData extends BaseNodeData {
  width: number;
  height: number;
  fps: number;
  duration: number;
  backgroundColor: string;
  videoPreset: string;
  videoCrf: number;
}

// Union type for all node data
export type NodeData = GeometryNodeData | InsertNodeData | AnimationNodeData | SceneNodeData;

// Node type literal types
export type GeometryNodeType = 'triangle' | 'circle' | 'rectangle';
export type NodeType = GeometryNodeType | 'insert' | 'animation' | 'scene';