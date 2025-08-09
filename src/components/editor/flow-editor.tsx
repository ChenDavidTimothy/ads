// src/components/editor/flow-editor.tsx - Updated to use graceful validation
"use client";

import { useCallback, useMemo } from "react";
import type { NodeTypes } from "reactflow";
import "reactflow/dist/style.css";

import { NodePalette } from "./node-palette";
import { TimelineEditorModal } from "./timeline-editor-modal";
import { PrintLogModal } from "./print-log-modal";
import type { NodeData, AnimationTrack } from "@/shared/types";
import { createNodeTypes } from "./flow/node-types";
import { useFlowGraph } from "./flow/hooks/use-flow-graph";
import { useConnections } from "./flow/hooks/use-connections";
import { useTimelineEditor } from "./flow/hooks/use-timeline-editor";
import { usePrintLogViewer } from "./flow/hooks/use-print-log-viewer";
import { useSceneGeneration } from "./flow/hooks/use-scene-generation";
import { useDebugExecution } from "./flow/hooks/use-debug-execution";
import { DebugProvider } from "./flow/debug-context";
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

  const {
    printLogModalState,
    handleOpenPrintLogViewer,
    handleClosePrintLogViewer,
    getPrintNodeData,
  } = usePrintLogViewer(nodes);

  const { runToNode, getDebugResult, getAllDebugResults, isDebugging } = useDebugExecution(nodes, edges);

  const nodeTypes: NodeTypes = useMemo(
    () => createNodeTypes(handleOpenTimelineEditor, handleOpenPrintLogViewer),
    [handleOpenTimelineEditor, handleOpenPrintLogViewer]
  );

  const { onConnect } = useConnections(nodes, edges, setEdges, flowTracker);

  const { 
    videoUrl, 
    videos,
    completedVideos,
    canGenerate, 
    handleGenerateScene, 
    handleDownload,
    handleDownloadAll,
    handleDownloadVideo,
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
        <DebugProvider value={{ runToNode, getDebugResult, getAllDebugResults, isDebugging }}>
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
            disableDeletion={timelineModalState.isOpen || printLogModalState.isOpen}
          />

          <PrintLogModal
            isOpen={printLogModalState.isOpen}
            onClose={handleClosePrintLogViewer}
            nodeId={printLogModalState.nodeId ?? ''}
            nodeName={getPrintNodeData().name}
            nodeLabel={getPrintNodeData().label}
          />
        </DebugProvider>

        <ActionsToolbar
          onGenerate={handleGenerateScene}
          canGenerate={canGenerate}
          isGenerating={isGenerating}
          hint={getGenerationHint()}
          onDownload={videoUrl ? handleDownload : undefined}
          hasVideo={Boolean(videoUrl)}
          videos={videos}
          onDownloadAll={completedVideos.length > 1 ? handleDownloadAll : undefined}
          lastError={lastError}
          onResetGeneration={resetGeneration}
          validationSummary={validationSummary}
        />

        <VideoPreview 
          videoUrl={videoUrl} 
          videos={videos}
          onDownloadVideo={handleDownloadVideo}
          onDownloadAll={handleDownloadAll}
        />
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