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

import { withDeleteButton } from "../nodes/components/with-delete-button";

// Utility for dispatching editor events
const dispatchEditorEvent = (eventType: string, nodeId: string) => {
  window.dispatchEvent(new CustomEvent(eventType, { detail: { nodeId } }));
};

export function createNodeTypes(
  handleOpenTimelineEditor: (nodeId: string) => void,
  handleOpenResultLogViewer: (nodeId: string) => void,
): NodeTypes {
  const componentMapping = getNodeComponentMapping();
  const nodeTypes: NodeTypes = {};

  // Optimized node type creation with reduced repetition
  for (const [nodeType, Component] of Object.entries(componentMapping)) {
    switch (nodeType) {
      case "animation":
        nodeTypes[nodeType] = withDeleteButton(
          (props: Parameters<typeof AnimationNode>[0]) => (
            <AnimationNode
              {...props}
              onOpenTimeline={() =>
                handleOpenTimelineEditor(props.data.identifier.id)
              }
            />
          ),
        );
        break;

      case "canvas":
        nodeTypes[nodeType] = withDeleteButton(
          (props: Parameters<typeof CanvasNode>[0]) => (
            <CanvasNode
              {...props}
              onOpenCanvas={() =>
                dispatchEditorEvent(
                  "open-canvas-editor",
                  props.data.identifier.id,
                )
              }
            />
          ),
        );
        break;

      case "result":
        nodeTypes[nodeType] = withDeleteButton(
          (props: Parameters<typeof ResultNode>[0]) => (
            <ResultNode
              {...props}
              onOpenLogViewer={() =>
                handleOpenResultLogViewer(props.data.identifier.id)
              }
            />
          ),
        );
        break;

      case "typography":
        nodeTypes[nodeType] = withDeleteButton(
          (props: Parameters<typeof TypographyNode>[0]) => (
            <TypographyNode
              {...props}
              onOpenTypography={() =>
                dispatchEditorEvent(
                  "open-typography-editor",
                  props.data.identifier.id,
                )
              }
            />
          ),
        );
        break;

      case "media":
        nodeTypes[nodeType] = withDeleteButton(
          (props: Parameters<typeof MediaNode>[0]) => (
            <MediaNode
              {...props}
              onOpenMedia={() =>
                dispatchEditorEvent(
                  "open-media-editor",
                  props.data.identifier.id,
                )
              }
            />
          ),
        );
        break;

      default:
        // Standard component mapping with delete button
        nodeTypes[nodeType] = withDeleteButton(
          Component as React.ComponentType<NodeProps>,
        );
    }
  }

  return nodeTypes;
}
