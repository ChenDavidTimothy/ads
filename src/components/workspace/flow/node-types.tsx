// src/components/workspace/flow/node-types.tsx - Build-time generated component mapping
import type { NodeTypes, NodeProps } from "reactflow";
import { getNodeComponentMapping } from "@/shared/registry/registry-utils";
import {
  AnimationNode,
  ResultNode,
  CanvasNode,
  TypographyNode,
  MediaNode,
} from "../nodes";
import type { NodeData } from "@/shared/types/nodes";

export function createNodeTypes(
  handleOpenTimelineEditor: (nodeId: string) => void,
  handleOpenResultLogViewer: (nodeId: string) => void,
): NodeTypes {
  const componentMapping = getNodeComponentMapping();
  const nodeTypes: NodeTypes = {};

  // Create mapping from build-time generated components
  for (const [nodeType, Component] of Object.entries(componentMapping)) {
    if (nodeType === "animation") {
      nodeTypes[nodeType] = (props: Parameters<typeof AnimationNode>[0]) => (
        <AnimationNode
          {...props}
          onOpenTimeline={() =>
            handleOpenTimelineEditor(props.data.identifier.id)
          }
        />
      );
    } else if (nodeType === "canvas") {
      nodeTypes[nodeType] = (props: Parameters<typeof CanvasNode>[0]) => (
        <CanvasNode
          {...props}
          onOpenCanvas={() => {
            const nodeId = (props.data as NodeData).identifier.id;
            // Defer to FlowEditorTab wiring; URL push handled there
            const event = new CustomEvent("open-canvas-editor", {
              detail: { nodeId },
            });
            window.dispatchEvent(event);
          }}
        />
      );
    } else if (nodeType === "result") {
      // Special handling for result node with log viewer callback
      nodeTypes[nodeType] = (props: Parameters<typeof ResultNode>[0]) => (
        <ResultNode
          {...props}
          onOpenLogViewer={() =>
            handleOpenResultLogViewer(props.data.identifier.id)
          }
        />
      );
    } else if (nodeType === "typography") {
      // Special handling for typography node with Typography editor callback
      nodeTypes[nodeType] = (props: Parameters<typeof TypographyNode>[0]) => (
        <TypographyNode
          {...props}
          onOpenTypography={() => {
            const nodeId = (props.data as NodeData).identifier.id;
            // Defer to FlowEditorTab wiring; URL push handled there
            const event = new CustomEvent("open-typography-editor", {
              detail: { nodeId },
            });
            window.dispatchEvent(event);
          }}
        />
      );
    } else if (nodeType === "media") {
      // Special handling for media node with Media editor callback
      nodeTypes[nodeType] = (props: Parameters<typeof MediaNode>[0]) => (
        <MediaNode
          {...props}
          onOpenMedia={() => {
            const nodeId = (props.data as NodeData).identifier.id;
            // Defer to FlowEditorTab wiring; URL push handled there
            const event = new CustomEvent("open-media-editor", {
              detail: { nodeId },
            });
            window.dispatchEvent(event);
          }}
        />
      );
    } else {
      // Standard component mapping
      nodeTypes[nodeType] = Component as React.ComponentType<NodeProps>;
    }
  }

  return nodeTypes;
}
