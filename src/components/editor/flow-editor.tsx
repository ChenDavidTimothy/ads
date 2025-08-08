// src/components/editor/flow-editor.tsx - Updated to use graceful validation
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

  const { 
    videoUrl, 
    canGenerate, 
    generateScene, 
    handleGenerateScene, 
    handleDownload,
    lastError,
    resetGeneration,
    isGenerating,
    getValidationSummary,
  } = useSceneGeneration(nodes, edges);

  const handleSaveTimeline = useCallback((duration: number, tracks: AnimationTrack[]) => {
    if (timelineModalState.nodeId) {
      updateNodeData(timelineModalState.nodeId, { duration, tracks });
    }
    handleCloseTimelineEditor();
  }, [timelineModalState.nodeId, updateNodeData, handleCloseTimelineEditor]);

  const timelineNodeData = getTimelineNodeData();

  // Generate user-friendly hints for different scenarios
  const getGenerationHint = useCallback(() => {
    const hasScene = nodes.some((n) => n.type === 'scene');
    const hasGeometry = nodes.some((n) => ['triangle', 'circle', 'rectangle'].includes(n.type!));
    
    if (!hasScene) {
      return 'Add a Scene node to generate video';
    }
    
    if (!hasGeometry) {
      return 'Add geometry nodes (Triangle, Circle, Rectangle) to create content';
    }
    
    const sceneNode = nodes.find((n) => n.type === 'scene');
    if (sceneNode) {
      const sceneTargetId = (sceneNode as unknown as { id: string }).id;
      const legacyId: string | undefined = (sceneNode.data?.identifier?.id as string | undefined);
      const isConnected = edges.some((edge) => edge.target === sceneTargetId || (legacyId ? edge.target === legacyId : false));
      
      if (!isConnected) {
        return 'Connect your nodes to the Scene node to generate video';
      }
    }
    
    return null;
  }, [nodes, edges]);

  // Get validation summary for enhanced error display
  const validationSummary = getValidationSummary();

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
          isGenerating={isGenerating}
          hint={getGenerationHint()}
          onDownload={videoUrl ? handleDownload : undefined}
          hasVideo={Boolean(videoUrl)}
          lastError={lastError}
          onResetGeneration={resetGeneration}
          validationSummary={validationSummary}
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