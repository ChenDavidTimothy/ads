// src/components/editor/flow/node-types.tsx
import type { NodeTypes } from 'reactflow';
import { TriangleNode, CircleNode, RectangleNode, InsertNode, FilterNode, AnimationNode, SceneNode } from "../nodes";

export function createNodeTypes(handleOpenTimelineEditor: (nodeId: string) => void): NodeTypes {
  return {
    triangle: TriangleNode,
    circle: CircleNode,
    rectangle: RectangleNode,
    insert: InsertNode,
    filter: FilterNode,
    animation: (props: Parameters<typeof AnimationNode>[0]) => (
      <AnimationNode {...props} onOpenEditor={() => handleOpenTimelineEditor(props.data.identifier.id)} />
    ),
    scene: SceneNode,
  };
}


