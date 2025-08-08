// src/components/editor/flow-editor.tsx - Refactored to modular hooks/components
"use client";

import { useCallback, useMemo } from "react";
import type { NodeTypes } from "reactflow";
import "reactflow/dist/style.css";

import { NodePalette } from "./node-palette";
import { TimelineEditorModal } from "./timeline-editor-modal";
import type { NodeData, AnimationTrack } from "@/shared/types";
import { createNodeTypes } from "./flow/node-types";
import { useFlowGraph } from "./flow/hooks/use-flow-graph";
import { useConnections } from "./flow/hooks/use-connections";
import { useTimelineEditor } from "./flow/hooks/use-timeline-editor";
import { useSceneGeneration } from "./flow/hooks/use-scene-generation";
import { FlowCanvas } from "./flow/components/flow-canvas";
import { ActionsToolbar } from "./flow/components/actions-toolbar";
import { RightSidebar } from "./flow/components/right-sidebar";
import { VideoPreview } from "./flow/components/video-preview";


export function FlowEditor() {
  const {
    nodes,
    edges,
    setEdges,
    onNodesChange,
    onEdgesChange,
    selectedNode,
    updateNodeData,
    updateDisplayName,
    validateDisplayName,
    onNodeClick,
    onPaneClick,
    onNodesDelete,
    onEdgesDelete,
    handleAddNode,
    flowTracker,
  } = useFlowGraph();

  const {
    timelineModalState,
    handleOpenTimelineEditor,
    handleCloseTimelineEditor,
    getTimelineNodeData,
  } = useTimelineEditor(nodes);

  const nodeTypes: NodeTypes = useMemo(
    () => createNodeTypes(handleOpenTimelineEditor),
    [handleOpenTimelineEditor]
  );

  const { onConnect } = useConnections(nodes, edges, setEdges, flowTracker);

  const { videoUrl, canGenerate, generateScene, handleGenerateScene, handleDownload } = useSceneGeneration(nodes, edges);

  const handleSaveTimeline = useCallback((duration: number, tracks: AnimationTrack[]) => {
    if (timelineModalState.nodeId) {
      updateNodeData(timelineModalState.nodeId, { duration, tracks });
    }
    handleCloseTimelineEditor();
  }, [timelineModalState.nodeId, updateNodeData, handleCloseTimelineEditor]);

  const timelineNodeData = getTimelineNodeData();

  return (
    <div className="flex h-full">
      <NodePalette onAddNode={handleAddNode} />

      <div className="flex-1 relative">
        <FlowCanvas
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          disableDeletion={timelineModalState.isOpen}
        />

        <ActionsToolbar
          onGenerate={handleGenerateScene}
          canGenerate={canGenerate}
          isGenerating={generateScene.isPending}
          hint={!nodes.some((n) => n.type === 'scene') ? 'Add Scene node to generate video' : 'Connect animation to Scene node'}
          onDownload={videoUrl ? handleDownload : undefined}
          hasVideo={Boolean(videoUrl)}
        />

        <VideoPreview videoUrl={videoUrl} />
      </div>

      <RightSidebar
        node={selectedNode}
        allNodes={nodes}
        allEdges={edges}
        onChange={(newData: Partial<NodeData>) => selectedNode && updateNodeData(selectedNode.data.identifier.id, newData)}
        onDisplayNameChange={updateDisplayName}
        validateDisplayName={validateDisplayName}
        flowTracker={flowTracker}
      />

      <TimelineEditorModal
        isOpen={timelineModalState.isOpen}
        onClose={handleCloseTimelineEditor}
        duration={timelineNodeData.duration}
        tracks={timelineNodeData.tracks}
        onSave={handleSaveTimeline}
      />
    </div>
  );
}