// AUTO-GENERATED - Do not edit manually
// Generated from NODE_DEFINITIONS at build time
// To regenerate: npm run generate

import { TriangleNode } from './triangle-node';
import { CircleNode } from './circle-node';
import { RectangleNode } from './rectangle-node';
import { InsertNode } from './insert-node';
import { FilterNode } from './filter-node';
import { MergeNode } from './merge-node';
import { ConstantsNode } from './constants-node';
import { ResultNode } from './result-node';
import { AnimationNode } from './animation-node';
import { SceneNode } from './scene-node';
import { CanvasNode } from './canvas-node';
import { FrameNode } from './frame-node';
import { CompareNode } from './compare-node';
import { IfElseNode } from './if-else-node';
import { BooleanOpNode } from './boolean-op-node';
import { MathOpNode } from './math-op-node';
import { DuplicateNode } from './duplicate-node';
import { BatchNode } from './batch-node';
import { ImageNode } from './image-node';
import { TextNode } from './text-node';
import { TypographyNode } from './typography-node';
import { MediaNode } from './media-node';

export const COMPONENT_MAPPING = {
  triangle: TriangleNode,
  circle: CircleNode,
  rectangle: RectangleNode,
  insert: InsertNode,
  filter: FilterNode,
  merge: MergeNode,
  constants: ConstantsNode,
  result: ResultNode,
  animation: AnimationNode,
  scene: SceneNode,
  canvas: CanvasNode,
  frame: FrameNode,
  compare: CompareNode,
  if_else: IfElseNode,
  boolean_op: BooleanOpNode,
  math_op: MathOpNode,
  duplicate: DuplicateNode,
  batch: BatchNode,
  image: ImageNode,
  text: TextNode,
  typography: TypographyNode,
  media: MediaNode,
} as const;

export type ComponentMapping = typeof COMPONENT_MAPPING;
export type ValidNodeType = keyof ComponentMapping;

// Runtime validation helper
export function validateNodeType(nodeType: string): nodeType is ValidNodeType {
  return nodeType in COMPONENT_MAPPING;
}
