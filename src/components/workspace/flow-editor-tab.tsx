"use client";

import { useCallback, useEffect, useMemo } from 'react';
import type { NodeTypes } from 'reactflow';
import { FlowCanvas } from './flow/components/flow-canvas';
import { NodePalette } from './node-palette';
import { ActionsToolbar } from './flow/components/actions-toolbar';
import { VideoPreview } from './flow/components/video-preview';
import { RightSidebar } from './flow/components/right-sidebar';
import { ResultLogModal } from './result-log-modal';
import { createNodeTypes } from './flow/node-types';
import { useFlowGraph } from './flow/hooks/use-flow-graph';
import { useConnections } from './flow/hooks/use-connections';
import { useResultLogViewer } from './flow/hooks/use-result-log-viewer';
import { useSceneGeneration } from './flow/hooks/use-scene-generation';
import { useDebugExecution } from './flow/hooks/use-debug-execution';
import { DebugProvider } from './flow/debug-context';
import type { NodeData } from '@/shared/types';
import type { Node, Edge } from 'reactflow';
import { useWorkspace } from './workspace-context';

export function FlowEditorTab() {
  const { state, updateFlow, updateUI } = useWorkspace();
  const { nodes: ctxNodes, edges: ctxEdges } = state.flow;

  const {
    nodes,
    edges,
    setNodes,
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

  // Hydrate hook state from context flow on mount and when context changes
  useEffect(() => {
    setNodes(ctxNodes as unknown as Node<NodeData>[]);
    setEdges(ctxEdges as Edge[]);
  }, [ctxNodes, ctxEdges, setNodes, setEdges]);

  // Sync context when local hook nodes/edges change via handlers
  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      onNodesChange(changes);
      // get latest nodes after apply is inside hook; schedule sync on next tick
      setTimeout(() => {
        updateFlow({ nodes });
      }, 0);
    },
    [onNodesChange, updateFlow, nodes]
  );

  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChange>[0]) => {
      onEdgesChange(changes);
      setTimeout(() => {
        updateFlow({ edges });
      }, 0);
    },
    [onEdgesChange, updateFlow, edges]
  );

  // Result log viewer (must be declared before useMemo that references its handlers)
  const {
    resultLogModalState,
    handleOpenResultLogViewer,
    handleCloseResultLogViewer,
    getResultNodeData,
  } = useResultLogViewer(nodes);

  // Double-click open timeline editor
  const nodeTypes: NodeTypes = useMemo(() => {
    const handleOpenTimelineEditor = (nodeId: string) => {
      updateUI({ activeTab: 'timeline', selectedNodeId: nodeId, selectedNodeType: 'animation' });
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'timeline');
      url.searchParams.set('node', nodeId);
      window.history.pushState({}, '', url.toString());
    };
    return createNodeTypes(handleOpenTimelineEditor, handleOpenResultLogViewer);
  }, [updateUI, handleOpenResultLogViewer]);

  const { onConnect } = useConnections(nodes, edges, setEdges, flowTracker);
  const { runToNode, getDebugResult, getAllDebugResults, isDebugging } = useDebugExecution(nodes, edges);

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

  const getGenerationHint = useCallback(() => {
    const hasScene = nodes.some((n) => n.type === 'scene');
    const hasGeometry = nodes.some((n) => ['triangle', 'circle', 'rectangle'].includes(n.type!));
    if (!hasScene) return 'Add a Scene node to generate video';
    if (!hasGeometry) return 'Add geometry nodes (Triangle, Circle, Rectangle) to create content';
    const sceneNode = nodes.find((n) => n.type === 'scene');
    if (sceneNode) {
      const sceneTargetId = (sceneNode as unknown as { id: string }).id;
      const isConnected = edges.some((edge) => edge.target === sceneTargetId);
      if (!isConnected) return 'Connect your nodes to the Scene node to generate video';
    }
    return null;
  }, [nodes, edges]);

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
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onNodesDelete={onNodesDelete}
            onEdgesDelete={onEdgesDelete}
            disableDeletion={resultLogModalState.isOpen}
          />

          <ResultLogModal
            isOpen={resultLogModalState.isOpen}
            onClose={handleCloseResultLogViewer}
            nodeId={resultLogModalState.nodeId ?? ''}
            nodeName={getResultNodeData().name}
            nodeLabel={getResultNodeData().label}
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
    </div>
  );
}