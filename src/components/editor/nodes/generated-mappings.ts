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
import { PrintNode } from './print-node';
import { AnimationNode } from './animation-node';
import { SceneNode } from './scene-node';
import { CompareNode } from './compare-node';
import { IfElseNode } from './if-else-node';
import { BooleanOpNode } from './boolean-op-node';
import { MathOpNode } from './math-op-node';

export const COMPONENT_MAPPING = {
  'triangle': TriangleNode,
  'circle': CircleNode,
  'rectangle': RectangleNode,
  'insert': InsertNode,
  'filter': FilterNode,
  'merge': MergeNode,
  'constants': ConstantsNode,
  'print': PrintNode,
  'animation': AnimationNode,
  'scene': SceneNode,
  'compare': CompareNode,
  'if_else': IfElseNode,
  'boolean_op': BooleanOpNode,
  'math_op': MathOpNode,
} as const;

export type ComponentMapping = typeof COMPONENT_MAPPING;
export type ValidNodeType = keyof ComponentMapping;

// Runtime validation helper
export function validateNodeType(nodeType: string): nodeType is ValidNodeType {
  return nodeType in COMPONENT_MAPPING;
}
