"use client";

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { applyNodeChanges, applyEdgeChanges, type NodeTypes, type NodeChange, type EdgeChange } from 'reactflow';
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
import type { NodeData, AnimationTrack } from '@/shared/types/nodes';
import type { Node, Edge } from 'reactflow';
import { useWorkspace } from './workspace-context';
import { generateTransformIdentifier } from '@/lib/defaults/transforms';

export function FlowEditorTab() {
  const { state, updateFlow, updateUI, updateTimeline } = useWorkspace();
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

  // Keep a mutable ref to the latest local nodes to avoid spamming context during drag
  const latestLocalNodesRef = useRef<Node<NodeData>[]>([]);
  useEffect(() => {
    latestLocalNodesRef.current = nodes as unknown as Node<NodeData>[];
  }, [nodes]);

  useEffect(() => {
    setNodes(ctxNodes as unknown as Node<NodeData>[]);
    setEdges(ctxEdges as Edge[]);
  }, [ctxNodes, ctxEdges, setNodes, setEdges]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const updatedNodes = applyNodeChanges(changes, nodes);
      setNodes(updatedNodes as unknown as Node<NodeData>[]);
      // Do NOT push to context here to avoid heavy snapshotting during drag
      onNodesChange(changes);
    },
    [nodes, setNodes, onNodesChange]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const updatedEdges = applyEdgeChanges(changes, edges);
      setEdges(updatedEdges);
      // Edges can affect validity; keep context in sync immediately
      updateFlow({ edges: updatedEdges });
      onEdgesChange(changes);
    },
    [edges, setEdges, updateFlow, onEdgesChange]
  );

  const {
    resultLogModalState,
    handleOpenResultLogViewer,
    handleCloseResultLogViewer,
    getResultNodeData,
  } = useResultLogViewer(nodes);

  const ensureTimelineForNode = useCallback((nodeId: string) => {
    if (state.editors.timeline[nodeId]) return;
    const node = state.flow.nodes.find((n) => (n as any).id === nodeId || (n as any)?.data?.identifier?.id === nodeId) as any;
    if (!node || node?.type !== 'animation') return;
    const duration: number = typeof node?.data?.duration === 'number' ? node.data.duration : 3;
    const rawTracks: AnimationTrack[] = Array.isArray(node?.data?.tracks) ? node.data.tracks : [];
    const tracks: AnimationTrack[] = rawTracks.map((t, _, arr) => {
      const anyT = t as any;
      if (anyT.identifier) return t;
      const identifier = generateTransformIdentifier(t.type, arr as AnimationTrack[]);
      const { ...rest } = anyT as Omit<AnimationTrack, 'identifier'>;
      return { ...(rest as object), identifier } as AnimationTrack;
    });
    updateTimeline(nodeId, { duration, tracks });
  }, [state.editors.timeline, state.flow.nodes, updateTimeline]);

  // Stable handler refs to avoid recreating nodeTypes
  const openTimelineRef = useRef<(nodeId: string) => void>(() => {});
  const openLogViewerRef = useRef<(nodeId: string) => void>(() => {});

  useEffect(() => {
    openTimelineRef.current = (nodeId: string) => {
      ensureTimelineForNode(nodeId);
      updateUI({ activeTab: 'timeline', selectedNodeId: nodeId, selectedNodeType: 'animation' });
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'timeline');
      url.searchParams.set('node', nodeId);
      window.history.pushState({}, '', url.toString());
    };
  }, [ensureTimelineForNode, updateUI]);

  useEffect(() => {
    openLogViewerRef.current = (nodeId: string) => {
      handleOpenResultLogViewer(nodeId);
    };
  }, [handleOpenResultLogViewer]);

  const nodeTypes: NodeTypes = useMemo(() => {
    return createNodeTypes(
      (id) => openTimelineRef.current(id),
      (id) => openLogViewerRef.current(id)
    );
  }, []);

  const { onConnect } = useConnections(
    nodes,
    edges,
    setEdges,
    flowTracker,
    (newEdges: Edge[]) => updateFlow({ edges: newEdges })
  );
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
            onNodeDragStop={() => {
              // Sync nodes to context once at the end of a drag gesture
              updateFlow({ nodes: latestLocalNodesRef.current as unknown as Node<NodeData>[] });
            }}
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