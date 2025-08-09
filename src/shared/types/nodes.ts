// src/shared/types/nodes.ts
import type { Point2D } from './core';
import type { NodeType } from './definitions';

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

// Print node data
export interface PrintNodeData extends BaseNodeData {
  label: string;
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

// Union type for all node data
export type NodeData = GeometryNodeData | InsertNodeData | FilterNodeData | MergeNodeData | ConstantsNodeData | PrintNodeData | AnimationNodeData | SceneNodeData | CompareNodeData | IfElseNodeData | BooleanOpNodeData;

// NodeType is derived from the registry (definitions)