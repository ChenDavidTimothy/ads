// src/components/workspace/flow-editor.tsx - Updated to use manual save and local backups
"use client";

import { useCallback, useMemo, useRef, useEffect, useState } from "react";
import type { NodeTypes } from "reactflow";
import "reactflow/dist/style.css";

import { NodePalette } from "./node-palette";
import { ResultLogModal } from "./result-log-modal";
import type { NodeData } from "@/shared/types";
import { createNodeTypes } from "./flow/node-types";
import { useFlowGraph } from "./flow/hooks/use-flow-graph";
import { useConnections } from "./flow/hooks/use-connections";
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
import { useWorkspaceSave } from "@/hooks/use-workspace-save";
import { SaveStatus } from "./save-status";
import { SaveButton } from "./save-button";
import { useNavigationGuard } from "@/hooks/use-navigation-guard";
import { useCrashBackup } from "@/hooks/use-crash-backup";
import { useMultiTabDetection } from "@/hooks/use-multi-tab-detection";
import { useOnlineStatus } from "@/hooks/use-online-status";
import type { WorkspaceState } from "@/types/workspace-state";
import { getTimelineDataFromNodes } from "@/utils/workspace-state";
import { SaveConflictModal } from "./save-conflict-modal";

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
    { 
      enabled: Boolean(workspaceId),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      staleTime: 10 * 60 * 1000,
      gcTime: 15 * 60 * 1000,
    }
  );

  const hydratedOnceRef = useRef<boolean>(false);
  const currentVersionRef = useRef<number>(0);

  // Hydrate from workspace on load
  useEffect(() => {
    if (!workspaceId) return;
    if (workspace && Array.isArray(workspace.flow_data?.nodes) && Array.isArray(workspace.flow_data?.edges)) {
      if (!hydratedOnceRef.current && nodes.length === 0 && edges.length === 0) {
        const flowData = workspace.flow_data as { nodes: unknown[]; edges: unknown[] };
        setNodes(flowData.nodes as Node<NodeData>[]);
        setEdges(flowData.edges as Edge[]);
        currentVersionRef.current = workspace.version;
        hydratedOnceRef.current = true;
      } else if (workspace.version > currentVersionRef.current) {
        const flowData = workspace.flow_data as { nodes: unknown[]; edges: unknown[] };
        setNodes(flowData.nodes as Node<NodeData>[]);
        setEdges(flowData.edges as Edge[]);
        currentVersionRef.current = workspace.version;
      }
    }
  }, [workspaceId, workspace, nodes.length, edges.length, setNodes, setEdges]);

  // Build a WorkspaceState shape from local editor state
  const buildWorkspaceState = useCallback((): WorkspaceState | null => {
    if (!workspaceId) return null;
    const timeline = getTimelineDataFromNodes(nodes as unknown as Node<NodeData>[]);
    return {
      flow: { nodes: nodes as unknown as Node<NodeData>[], edges },
      editors: { timeline },
      ui: { activeTab: 'flow' },
      meta: {
        version: currentVersionRef.current,
        lastModified: new Date(workspace?.updated_at ?? Date.now()),
        workspaceId,
        name: workspace?.name ?? 'Untitled',
      },
    };
  }, [workspaceId, nodes, edges, workspace]);

  // Manual save hook
  const { saveNow, isSaving, hasUnsavedChanges, initializeFromWorkspace, lastSaved, currentVersion } = useWorkspaceSave({
    workspaceId: workspaceId ?? '',
    initialVersion: workspace?.version ?? 0,
    onSaveSuccess: () => {},
    onSaveError: () => {},
  });
  const [conflictOpen, setConflictOpen] = useState(false);

  // Initialize save hook from server data
  useEffect(() => {
    if (workspace) {
      initializeFromWorkspace(workspace);
      currentVersionRef.current = workspace.version;
    }
  }, [workspace, initializeFromWorkspace]);

  // Crash backup & nav guard
  const stateGetter = useCallback(() => buildWorkspaceState(), [buildWorkspaceState]);
  useCrashBackup(workspaceId ?? '', stateGetter, { intervalMs: 15000 });
  useNavigationGuard(Boolean(buildWorkspaceState() && hasUnsavedChanges(buildWorkspaceState()!)), stateGetter);

  // Keyboard shortcut for save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const saveCombo = (isMac && e.metaKey && e.key.toLowerCase() === 's') || (!isMac && e.ctrlKey && e.key.toLowerCase() === 's');
      if (saveCombo) {
        e.preventDefault();
        const st = buildWorkspaceState();
        if (st) void saveNow(st);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [buildWorkspaceState, saveNow]);

  // Multi-tab and online status
  const { hasMultipleTabs } = useMultiTabDetection(workspaceId ?? '');
  const isOnline = useOnlineStatus();

  // Create stable nodeTypes to prevent React Flow warnings
  const {
    resultLogModalState,
    handleOpenResultLogViewer,
    handleCloseResultLogViewer,
    getResultNodeData,
  } = useResultLogViewer(nodes);

  const { runToNode, getDebugResult, getAllDebugResults, isDebugging } = useDebugExecution(nodes, edges);

  const nodeTypes: NodeTypes = useMemo(() => {
    const handleOpenTimelineEditor = (nodeId: string) => {
      const params = new URLSearchParams(window.location.search);
      const wsId = params.get('workspace');
      const target = `/workspace/timeline/${nodeId}${wsId ? `?workspace=${wsId}` : ''}`;
      window.location.href = target;
    };
    return createNodeTypes(handleOpenTimelineEditor, handleOpenResultLogViewer);
  }, [handleOpenResultLogViewer]);

  const { onConnect } = useConnections(nodes, edges, setEdges, flowTracker);

  // Remove debounced server autosave: manual save only

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

  const st = buildWorkspaceState();
  const dirty = Boolean(st && hasUnsavedChanges(st));

  return (
    <div className="flex h-full">
      <NodePalette onAddNode={handleAddNode} />

      <div className="flex-1 relative">
        <div className="h-12 px-4 border-b border-gray-700 flex items-center justify-between bg-gray-900/60">
          <SaveStatus
            lastSaved={lastSaved}
            hasUnsavedChanges={dirty}
            isSaving={isSaving}
            isOnline={isOnline}
            hasBackup={false}
            hasMultipleTabs={hasMultipleTabs}
          />
          <SaveButton
            onSave={() => { const s = buildWorkspaceState(); if (s) void saveNow(s).catch(() => { setConflictOpen(true); }); }}
            isSaving={isSaving}
            hasUnsavedChanges={dirty}
            disabled={!isOnline || !workspaceId}
          />
        </div>

        <SaveConflictModal isOpen={conflictOpen} onReload={() => { window.location.reload(); }} onDismiss={() => setConflictOpen(false)} />

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
    </div>
  );
}