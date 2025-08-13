// src/shared/types/nodes.ts
import type { Point2D } from './core';
import type { TransformIdentifier, TransformLineage } from './transforms';
import type { NodeType } from './definitions';
import type { PerObjectAssignments } from '@/shared/properties/assignments';

// Node identifier system
export interface NodeIdentifier {
  readonly id: string;           // Immutable: "tri_2024_001_a1b2c3d4"
  readonly type: NodeType;       // "triangle", "circle", etc.
  readonly createdAt: number;    // Timestamp
  readonly sequence: number;     // Auto-incrementing per type
  displayName: string;           // User-editable: "Marketing Triangle"
}

// Flow tracking for nodes
export interface NodeLineage {
  parentNodes: string[];         // Which nodes created this
  childNodes: string[];          // Which nodes this creates
  flowPath: string[];            // Edge IDs this node flows through
}

// Base node data interface with tracking
export interface BaseNodeData {
  identifier: NodeIdentifier;
  lineage: NodeLineage;
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

// Filter node data
export interface FilterNodeData extends BaseNodeData {
  selectedObjectIds: string[];
}

// Merge node data
export interface MergeNodeData extends BaseNodeData {
  inputPortCount: number;
}

// Constants node data
export interface ConstantsNodeData extends BaseNodeData {
  valueType: 'number' | 'string' | 'boolean' | 'color';
  numberValue: number;
  stringValue: string;
  booleanValue: string; // 'true' | 'false' as string from select
  colorValue: string;
}

// Result node data
export interface ResultNodeData extends BaseNodeData {
  label: string;
}

// Animation track properties - aligned with API schema
export interface MoveTrackProperties {
  from: Point2D;
  to: Point2D;
}

export interface RotateTrackProperties {
  from: number;
  to: number;
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

// Animation track types - now using the registry system
export interface BaseAnimationTrack {
  startTime: number;
  duration: number;
  easing: 'linear' | 'easeInOut' | 'easeIn' | 'easeOut';
  // Required identifier
  identifier: TransformIdentifier;
  lineage?: TransformLineage;
}

// Individual track types - now generated from registry
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

// Union type - now extensible through registry
export type AnimationTrack = MoveTrack | RotateTrack | ScaleTrack | FadeTrack | ColorTrack;

// Type guard factory - generates type guards dynamically
export function createTrackTypeGuard<T extends AnimationTrack>(type: T['type']) {
  return (track: AnimationTrack): track is T => track.type === type;
}

// Pre-generated type guards for existing types
export const isMoveTrack = createTrackTypeGuard<MoveTrack>('move');
export const isRotateTrack = createTrackTypeGuard<RotateTrack>('rotate');
export const isScaleTrack = createTrackTypeGuard<ScaleTrack>('scale');
export const isFadeTrack = createTrackTypeGuard<FadeTrack>('fade');
export const isColorTrack = createTrackTypeGuard<ColorTrack>('color');

// Animation node data
export interface AnimationNodeData extends BaseNodeData {
  duration: number;
  tracks: AnimationTrack[];
  perObjectAssignments?: PerObjectAssignments;
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

// Canvas node data (static styling/transform overrides for image export)
export interface CanvasNodeData extends BaseNodeData {
  position: Point2D;
  rotation: number;
  scale: Point2D;
  opacity: number;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  perObjectAssignments?: PerObjectAssignments;
}

// Frame node data (static image output configuration)
export interface FrameNodeData extends BaseNodeData {
  width: number;
  height: number;
  backgroundColor: string;
  format: 'png' | 'jpeg';
  quality: number; // 1-100 for JPEG; ignored for PNG
}

// Compare node data
export interface CompareNodeData extends BaseNodeData {
  operator: 'gt' | 'lt' | 'eq' | 'neq' | 'gte' | 'lte';
}

// If/Else node data
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface IfElseNodeData extends BaseNodeData {
  // This interface intentionally has no additional properties
  // It exists for type consistency and future extensibility
}

// Boolean Operation node data
export interface BooleanOpNodeData extends BaseNodeData {
  operator: 'and' | 'or' | 'not' | 'xor';
}

// Math Operation node data
export interface MathOpNodeData extends BaseNodeData {
  operator: 'add' | 'subtract' | 'multiply' | 'divide' | 'modulo' | 'power' | 'sqrt' | 'abs' | 'min' | 'max';
}

// Union type for all node data
export type NodeData = GeometryNodeData | InsertNodeData | FilterNodeData | MergeNodeData | ConstantsNodeData | ResultNodeData | AnimationNodeData | SceneNodeData | CanvasNodeData | FrameNodeData | CompareNodeData | IfElseNodeData | BooleanOpNodeData | MathOpNodeData;

// NodeType is derived from the registry (definitions)