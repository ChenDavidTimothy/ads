// src/components/editor/flow/node-types.tsx - Dynamic registry-driven component mapping
import type { NodeTypes } from 'reactflow';
import { getNodeComponentMapping } from '@/shared/registry/registry-utils';
import { AnimationNode, PrintNode } from "../nodes";

export function createNodeTypes(
  handleOpenTimelineEditor: (nodeId: string) => void,
  handleOpenPrintLogViewer: (nodeId: string) => void
): NodeTypes {
  const componentMapping = getNodeComponentMapping();
  const nodeTypes: NodeTypes = {};
  
  // Create dynamic mapping from registry
  for (const [nodeType, Component] of Object.entries(componentMapping)) {
    if (nodeType === 'animation') {
      // Special handling for animation node with timeline editor callback
      nodeTypes[nodeType] = (props: Parameters<typeof AnimationNode>[0]) => (
        <AnimationNode {...props} onOpenEditor={() => handleOpenTimelineEditor(props.data.identifier.id)} />
      );
    } else if (nodeType === 'print') {
      // Special handling for print node with log viewer callback
      nodeTypes[nodeType] = (props: Parameters<typeof PrintNode>[0]) => (
        <PrintNode {...props} onOpenLogViewer={() => handleOpenPrintLogViewer(props.data.identifier.id)} />
      );
    } else {
      // Standard component mapping
      nodeTypes[nodeType] = Component;
    }
  }
  
  return nodeTypes;
}


