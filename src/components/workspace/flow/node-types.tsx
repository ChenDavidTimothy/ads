// src/components/workspace/flow/node-types.tsx - Build-time generated component mapping
import type { NodeTypes, NodeProps } from 'reactflow';
import { getNodeComponentMapping } from '@/shared/registry/registry-utils';
import { AnimationNode, ResultNode, CanvasNode } from "../nodes";

export function createNodeTypes(
  handleOpenTimelineEditor: (nodeId: string) => void,
  handleOpenResultLogViewer: (nodeId: string) => void
): NodeTypes {
  const componentMapping = getNodeComponentMapping();
  const nodeTypes: NodeTypes = {};
  
  // Create mapping from build-time generated components
  for (const [nodeType, Component] of Object.entries(componentMapping)) {
    if (nodeType === 'animation') {
      nodeTypes[nodeType] = (props: Parameters<typeof AnimationNode>[0]) => (
        <AnimationNode {...props} onOpenTimeline={() => handleOpenTimelineEditor(props.data.identifier.id)} />
      );
    } else if (nodeType === 'canvas') {
      nodeTypes[nodeType] = (props: Parameters<typeof CanvasNode>[0]) => (
        <CanvasNode {...(props as any)} onOpenCanvas={() => {
          const nodeId = (props as any).data.identifier.id as string;
          // Defer to FlowEditorTab wiring; URL push handled there
          const event = new CustomEvent('open-canvas-editor', { detail: { nodeId } });
          window.dispatchEvent(event);
        }} />
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


