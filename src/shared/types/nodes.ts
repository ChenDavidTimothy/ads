// src/shared/types/nodes.ts
import type { Point2D } from './core';
import type { TransformIdentifier, TransformLineage } from './transforms';
import type { NodeType } from './definitions';
import type { PerObjectAssignments } from '@/shared/properties/assignments';

// Node identifier system
export interface NodeIdentifier {
  readonly id: string; // Immutable: "tri_2024_001_a1b2c3d4"
  readonly type: NodeType; // "triangle", "circle", etc.
  readonly createdAt: number; // Timestamp
  readonly sequence: number; // Auto-incrementing per type
  displayName: string; // User-editable: "Marketing Triangle"
}

// Flow tracking for nodes
export interface NodeLineage {
  parentNodes: string[]; // Which nodes created this
  childNodes: string[]; // Which nodes this creates
  flowPath: string[]; // Edge IDs this node flows through
}

// Base node data interface with tracking
export interface BaseNodeData {
  identifier: NodeIdentifier;
  lineage: NodeLineage;
}

// Geometry node data types
export interface TriangleNodeData extends BaseNodeData {
  size: number;
}

export interface CircleNodeData extends BaseNodeData {
  radius: number;
}

export interface RectangleNodeData extends BaseNodeData {
  width: number;
  height: number;
}

export type GeometryNodeData = TriangleNodeData | CircleNodeData | RectangleNodeData;

// Text node data types
export interface TextNodeData extends BaseNodeData {
  content: string;
  fontSize: number;
}

export interface TypographyNodeData extends BaseNodeData {
  content?: string;
  fontFamily: string;
  fontWeight: string;
  textAlign: string;
  lineHeight: number;
  letterSpacing: number;
  // Variable binding support (follows Canvas pattern)
  variableBindings?: Record<
    string,
    {
      target?: string;
      boundResultNodeId?: string;
    }
  >;
  variableBindingsByObject?: Record<
    string,
    Record<
      string,
      {
        target?: string;
        boundResultNodeId?: string;
      }
    >
  >;
  perObjectAssignments?: PerObjectAssignments;
  fontStyle: string; // 'normal' | 'italic' | 'oblique'
  textBaseline: string; // 'top' | 'hanging' | 'middle' | 'alphabetic' | 'bottom'
  direction: string; // 'ltr' | 'rtl'
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  shadowColor: string;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowBlur: number;
  textOpacity: number;
  // Batch overrides: field -> objectId -> batchKey -> value
  batchOverridesByField?: Record<string, Record<string, Record<string, unknown>>>;
}

// Insert node data
export interface InsertNodeData extends BaseNodeData {
  appearanceTime: number;
  // Optional per-object appearance times overriding the default
  appearanceTimeByObject?: Record<string, number>;
  // Variable binding support (bind appearanceTime from Result nodes)
  variableBindings?: Record<
    string,
    {
      target?: string;
      boundResultNodeId?: string;
    }
  >;
  variableBindingsByObject?: Record<
    string,
    Record<
      string,
      {
        target?: string;
        boundResultNodeId?: string;
      }
    >
  >;
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
  lastValue?: unknown;
  lastValueType?: string;
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
  from: Point2D;
  to: Point2D;
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

export interface SlideTrackProperties {
  orientationDeg: number;
  velocity: number; // px/s, negative reverses
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

export interface SlideTrack extends BaseAnimationTrack {
  type: 'slide';
  properties: SlideTrackProperties;
}

// Union type - now extensible through registry
export type AnimationTrack =
  | MoveTrack
  | RotateTrack
  | ScaleTrack
  | FadeTrack
  | ColorTrack
  | SlideTrack;

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
export const isSlideTrack = createTrackTypeGuard<SlideTrack>('slide');

// Animation node data
export interface AnimationNodeData extends BaseNodeData {
  duration: number;
  tracks: AnimationTrack[];
  perObjectAssignments?: PerObjectAssignments;
  // Batch overrides: field -> objectId -> batchKey -> value
  batchOverridesByField?: Record<string, Record<string, Record<string, unknown>>>;
  // Node-level variable bindings (defaults) for transform properties
  variableBindings?: Record<
    string,
    {
      // propertyKey e.g., "duration", "move.from.x", "color.property"
      target?: string;
      boundResultNodeId?: string; // selected Result node identifier.id
    }
  >;
  // Per-object variable bindings overriding defaults
  variableBindingsByObject?: Record<
    string,
    Record<
      string,
      {
        target?: string;
        boundResultNodeId?: string;
      }
    >
  >;
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
  // Node-level variable bindings for canvas defaults
  variableBindings?: Record<
    string,
    {
      target?: string;
      boundResultNodeId?: string;
    }
  >;
  // Per-object variable bindings overriding defaults
  variableBindingsByObject?: Record<
    string,
    Record<
      string,
      {
        target?: string;
        boundResultNodeId?: string;
      }
    >
  >;
  // Batch overrides: field -> objectId -> batchKey -> value
  batchOverridesByField?: Record<string, Record<string, Record<string, unknown>>>;
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
  operator:
    | 'add'
    | 'subtract'
    | 'multiply'
    | 'divide'
    | 'modulo'
    | 'power'
    | 'sqrt'
    | 'abs'
    | 'min'
    | 'max';
}

// Duplicate node data
export interface DuplicateNodeData extends BaseNodeData {
  count: number;
}

// Batch node data
export interface BatchNodeData extends BaseNodeData {
  keys?: string[];
  // Variable binding support (follows Canvas pattern)
  variableBindings?: Record<
    string,
    {
      boundResultNodeId?: string;
    }
  >;
}

// Image node data
export interface ImageNodeData extends BaseNodeData {
  // No additional properties - basic image object only
  _placeholder?: never; // Prevent empty interface warning
}

// Media node data
export interface MediaNodeData extends BaseNodeData {
  // Content
  imageAssetId: string;

  // Crop Properties
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;

  // Display Properties
  displayWidth: number;
  displayHeight: number;

  // Binding System Support
  variableBindings?: Record<string, { target?: string; boundResultNodeId?: string }>;
  variableBindingsByObject?: Record<
    string,
    Record<string, { target?: string; boundResultNodeId?: string }>
  >;
  perObjectAssignments?: PerObjectAssignments;
  // Batch overrides: field -> objectId -> batchKey -> value
  batchOverridesByField?: Record<string, Record<string, Record<string, unknown>>>;
}

// Union type for all node data
export type NodeData =
  | GeometryNodeData
  | TextNodeData
  | TypographyNodeData
  | InsertNodeData
  | FilterNodeData
  | MergeNodeData
  | ConstantsNodeData
  | ResultNodeData
  | AnimationNodeData
  | SceneNodeData
  | CanvasNodeData
  | FrameNodeData
  | CompareNodeData
  | IfElseNodeData
  | BooleanOpNodeData
  | MathOpNodeData
  | DuplicateNodeData
  | BatchNodeData
  | ImageNodeData
  | MediaNodeData;

// NodeType is derived from the registry (definitions)
