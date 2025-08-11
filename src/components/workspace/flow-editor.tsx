// src/components/workspace/flow-editor.tsx - Updated to use graceful validation
"use client";

import { useCallback, useMemo } from "react";
import type { NodeTypes } from "reactflow";
import "reactflow/dist/style.css";

import { NodePalette } from "./node-palette";
// Removed modal in favor of dedicated page
import { ResultLogModal } from "./result-log-modal";
import type { NodeData } from "@/shared/types";
import { createNodeTypes } from "./flow/node-types";
import { useFlowGraph } from "./flow/hooks/use-flow-graph";
import { useConnections } from "./flow/hooks/use-connections";
import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/trpc/react";
import { useResultLogViewer } from "./flow/hooks/use-result-log-viewer";
import { useSceneGeneration } from "./flow/hooks/use-scene-generation";
import { useDebugExecution } from "./flow/hooks/use-debug-execution";
import { DebugProvider } from "./flow/debug-context";
import { FlowCanvas } from "./flow/components/flow-canvas";
import { ActionsToolbar } from "./flow/components/actions-toolbar";
import { RightSidebar } from "./flow/components/right-sidebar";
import { VideoPreview } from "./flow/components/video-preview";
import type { Node, Edge } from "reactflow";
// Removed unused RouterOutputs import and WorkspaceData alias

export function FlowEditor() {
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

  const search = useSearchParams();
  const workspaceId = search.get('workspace');
  const { data: workspace } = api.workspace.get.useQuery(
    { id: workspaceId! },
    { enabled: Boolean(workspaceId), staleTime: 30000, refetchOnWindowFocus: false }
  );
  // Removed auto-create; workspace is selected via workspace-selector page
  const lastSavedSnapshotRef = useRef<string>("");
  const lastQueuedSnapshotRef = useRef<string>("");
  const saveWorkspace = api.workspace.save.useMutation({
    onSuccess: () => {
      // Mark the last successfully saved snapshot
      lastSavedSnapshotRef.current = lastQueuedSnapshotRef.current;
    },
  });
  const currentVersionRef = useRef<number | null>(null);
  // No auto-create
  const hydratedOnceRef = useRef<boolean>(false);
  // Stable snapshot of the current flow to avoid saving when nothing changed
  const flowSnapshot = useMemo(() => {
    try {
      const normNodes = [...nodes]
        .map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data }))
        .sort((a, b) => a.id.localeCompare(b.id));
      const normEdges = [...edges]
        .map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle }))
        .sort((a, b) => a.id.localeCompare(b.id));
      return JSON.stringify({ n: normNodes, e: normEdges });
    } catch {
      return Math.random().toString();
    }
  }, [nodes, edges]);


  const {
    resultLogModalState,
    handleOpenResultLogViewer,
    handleCloseResultLogViewer,
    getResultNodeData,
  } = useResultLogViewer(nodes);

  const { runToNode, getDebugResult, getAllDebugResults, isDebugging } = useDebugExecution(nodes, edges);

  const nodeTypes: NodeTypes = useMemo(
    () => createNodeTypes((nodeId: string) => {
      // Navigate to timeline editor page
      const params = new URLSearchParams(window.location.search);
      const wsId = params.get('workspace');
      const target = `/workspace/timeline/${nodeId}${wsId ? `?workspace=${wsId}` : ''}`;
      window.location.href = target;
    }, handleOpenResultLogViewer),
    [handleOpenResultLogViewer]
  );

  const { onConnect } = useConnections(nodes, edges, setEdges, flowTracker);

  // Hydrate from workspace on load
  useEffect(() => {
    if (!workspaceId) return;
    if (workspace && Array.isArray(workspace.flow_data?.nodes) && Array.isArray(workspace.flow_data?.edges)) {
      // Initial hydration: only if we haven't hydrated and the canvas is empty
      if (!hydratedOnceRef.current && nodes.length === 0 && edges.length === 0) {
        if (workspace?.flow_data) {
          const flowData = workspace.flow_data as { nodes: unknown[]; edges: unknown[] };
          if (Array.isArray(flowData.nodes) && Array.isArray(flowData.edges)) {
            setNodes(flowData.nodes as Node<NodeData>[]);
            setEdges(flowData.edges as Edge[]);
          }
        }
        currentVersionRef.current = workspace.version;
        hydratedOnceRef.current = true;
        return;
      }
      // Subsequent hydration only when server version is newer than our local
      if (currentVersionRef.current !== null && workspace.version > currentVersionRef.current) {
        if (workspace?.flow_data) {
          const flowData = workspace.flow_data as { nodes: unknown[]; edges: unknown[] };
          if (Array.isArray(flowData.nodes) && Array.isArray(flowData.edges)) {
            setNodes(flowData.nodes as Node<NodeData>[]);
            setEdges(flowData.edges as Edge[]);
          }
        }
        currentVersionRef.current = workspace.version;
        return;
      }
      // If we skipped initial hydration due to local edits, still record version for saves
      currentVersionRef.current ??= workspace.version;
    }
  }, [workspaceId, workspace, nodes.length, edges.length, setNodes, setEdges]);

  // Debounced autosave when nodes/edges change
  useEffect(() => {
    if (!workspaceId) return;
    // If nothing changed since last successful save (or last queued), don't schedule a new save
    if (flowSnapshot === lastSavedSnapshotRef.current || flowSnapshot === lastQueuedSnapshotRef.current) {
      return;
    }
    const version = currentVersionRef.current ?? (workspace?.version ?? 0);
    const timer = setTimeout(() => {
      if (saveWorkspace.isPending) return;
      lastQueuedSnapshotRef.current = flowSnapshot;
      const flowData = { nodes, edges };
      saveWorkspace.mutate({ id: workspaceId, flowData, version });
      // optimistic increment
      currentVersionRef.current = version + 1;
    }, 1200);
    return () => clearTimeout(timer);
  }, [flowSnapshot, nodes, edges, workspaceId, saveWorkspace, workspace?.version]);

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

  // Timeline editor moved to dedicated page; no modal save handler

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

      {/* TimelineEditorModal removed in favor of dedicated page */}

    </div>
  );
}