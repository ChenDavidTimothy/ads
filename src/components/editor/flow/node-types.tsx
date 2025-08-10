// src/components/editor/flow/node-types.tsx - Build-time generated component mapping
import type { NodeTypes, NodeProps } from 'reactflow';
import { getNodeComponentMapping } from '@/shared/registry/registry-utils';
import { AnimationNode, ResultNode } from "../nodes";

export function createNodeTypes(
  handleOpenTimelineEditor: (nodeId: string) => void,
  handleOpenResultLogViewer: (nodeId: string) => void
): NodeTypes {
  const componentMapping = getNodeComponentMapping();
  const nodeTypes: NodeTypes = {};
  
  // Create mapping from build-time generated components
  for (const [nodeType, Component] of Object.entries(componentMapping)) {
    if (nodeType === 'animation') {
      // Special handling for animation node with timeline editor callback
      nodeTypes[nodeType] = (props: Parameters<typeof AnimationNode>[0]) => (
        <AnimationNode {...props} onOpenEditor={() => handleOpenTimelineEditor(props.data.identifier.id)} />
      );
    } else if (nodeType === 'result') {
      // Special handling for result node with log viewer callback
      nodeTypes[nodeType] = (props: Parameters<typeof ResultNode>[0]) => (
        <ResultNode {...props} onOpenLogViewer={() => handleOpenResultLogViewer(props.data.identifier.id)} />
      );

    } else {
      // Standard component mapping
      nodeTypes[nodeType] = Component as React.ComponentType<NodeProps>;
    }
  }
  
  return nodeTypes;
}


