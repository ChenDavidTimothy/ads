// src/components/workspace/flow-editor-tab.tsx - Updated to use collapsible right sidebar
"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { type NodeTypes } from "reactflow";
import { FlowCanvas } from "./flow/components/flow-canvas";
import { NodePalette } from "./node-palette";
import { ActionsToolbar } from "./flow/components/actions-toolbar";
import { RightSidebar } from "./flow/components/right-sidebar";
import { ResultLogModal } from "./result-log-modal";
import { createNodeTypes } from "./flow/node-types";
import { useFlowGraph } from "./flow/hooks/use-flow-graph";
import { useConnections } from "./flow/hooks/use-connections";
import { useResultLogViewer } from "./flow/hooks/use-result-log-viewer";
import { useSceneGeneration } from "./flow/hooks/use-scene-generation";
import { useDebugExecution } from "./flow/hooks/use-debug-execution";
import { DebugProvider } from "./flow/debug-context";
import type { NodeData, AnimationTrack } from "@/shared/types/nodes";
import type { Node, Edge } from "reactflow";
import { useWorkspace } from "./workspace-context";
import { generateTransformIdentifier } from "@/lib/defaults/transforms";
import { debounce } from "@/lib/utils";
import { DeleteProvider } from "./flow/context/delete-context";

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
    isDragging, // ← ADD: Get drag state
  } = useFlowGraph();

  // Initialize local state from context on mount (load saved nodes)
  useEffect(() => {
    if (ctxNodes.length > 0 && nodes.length === 0) {
      setNodes(ctxNodes as unknown as Node<NodeData>[]);
    }
    if (ctxEdges.length > 0 && edges.length === 0) {
      setEdges(ctxEdges);
    }
  }, [ctxNodes, ctxEdges, nodes.length, edges.length, setNodes, setEdges]);

  // SURGICAL FIX: Drag-aware context sync - completely bypassed during drag
  const debouncedContextSync = useMemo(
    () =>
      debounce((newNodes: Node<NodeData>[], newEdges: Edge[]) => {
        // CRITICAL: Only sync when not dragging
        if (!isDragging) {
          updateFlow({ nodes: newNodes, edges: newEdges });
        }
      }, 50),
    [updateFlow, isDragging], // ← ADD: isDragging dependency
  );

  // Context sync with drag awareness
  useEffect(() => {
    if (!isDragging) {
      debouncedContextSync(nodes as unknown as Node<NodeData>[], edges);
    }
  }, [nodes, edges, debouncedContextSync, isDragging]); // ← ADD: isDragging guard

  // CRITICAL: Force sync when drag ends
  useEffect(() => {
    if (!isDragging) {
      // Immediate sync after drag completes
      updateFlow({
        nodes: nodes as unknown as Node<NodeData>[],
        edges,
      });
    }
  }, [isDragging, nodes, edges, updateFlow]);

  const {
    resultLogModalState,
    handleOpenResultLogViewer,
    handleCloseResultLogViewer,
    getResultNodeData,
  } = useResultLogViewer(nodes);

  // Track current selection
  const selectedNodesRef = useRef<Node<NodeData>[]>([]);
  const selectedEdgesRef = useRef<Edge[]>([]);

  const handleSelectionChange = useCallback(
    (params: { nodes: Node[]; edges: Edge[] }) => {
      selectedNodesRef.current = (params.nodes as Node<NodeData>[]) ?? [];
      selectedEdgesRef.current = params.edges ?? [];
    },
    [],
  );

  // Use the robust deletion handlers from useFlowGraph - no custom keyboard handling needed

  const ensureTimelineForNode = useCallback(
    (nodeId: string) => {
      if (state.editors.timeline[nodeId]) return;

      // Find node by ID or by identifier.id
      const node = state.flow.nodes.find((n) => {
        const flowNode = n as {
          id: string;
          type?: string;
          data?: {
            identifier?: { id: string };
            duration?: number;
            tracks?: AnimationTrack[];
          };
        };
        return (
          flowNode.id === nodeId || flowNode.data?.identifier?.id === nodeId
        );
      });

      if (!node || !("type" in node) || node.type !== "animation") return;

      const animationNode = node as {
        data: { duration?: number; tracks?: AnimationTrack[] };
      };
      const duration: number =
        typeof animationNode.data?.duration === "number"
          ? animationNode.data.duration
          : 3;
      const rawTracks: AnimationTrack[] = Array.isArray(
        animationNode.data?.tracks,
      )
        ? animationNode.data.tracks
        : [];

      const tracks: AnimationTrack[] = rawTracks.map((track) => {
        if ("identifier" in track && track.identifier) {
          return track;
        }
        const identifier = generateTransformIdentifier(track.type, rawTracks);
        return { ...track, identifier };
      });

      updateTimeline(nodeId, { duration, tracks });
    },
    [state.editors.timeline, state.flow.nodes, updateTimeline],
  );

  // Stable handler refs to avoid recreating nodeTypes
  const openTimelineRef = useRef<(nodeId: string) => void>((nodeId: string) => {
    console.warn("Timeline handler not initialized yet for node:", nodeId);
  });
  const openCanvasRef = useRef<(nodeId: string) => void>((nodeId: string) => {
    console.warn("Canvas handler not initialized yet for node:", nodeId);
  });
  const openTypographyRef = useRef<(nodeId: string) => void>(
    (nodeId: string) => {
      console.warn("Typography handler not initialized yet for node:", nodeId);
    },
  );
  const openMediaRef = useRef<(nodeId: string) => void>((nodeId: string) => {
    console.warn("Media handler not initialized yet for node:", nodeId);
  });
  const openLogViewerRef = useRef<(nodeId: string) => void>(
    (nodeId: string) => {
      console.warn("Log viewer handler not initialized yet for node:", nodeId);
    },
  );

  useEffect(() => {
    openTimelineRef.current = (nodeId: string) => {
      ensureTimelineForNode(nodeId);
      updateUI({
        activeTab: "timeline",
        selectedNodeId: nodeId,
        selectedNodeType: "animation",
      });
      const url = new URL(window.location.href);
      url.searchParams.set("tab", "timeline");
      url.searchParams.set("node", nodeId);
      window.history.pushState({}, "", url.toString());
    };
  }, [ensureTimelineForNode, updateUI]);

  useEffect(() => {
    openCanvasRef.current = (nodeId: string) => {
      updateUI({
        activeTab: "canvas",
        selectedNodeId: nodeId,
        selectedNodeType: "canvas",
      });
      const url = new URL(window.location.href);
      url.searchParams.set("tab", "canvas");
      url.searchParams.set("node", nodeId);
      window.history.pushState({}, "", url.toString());
    };

    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ nodeId: string }>).detail;
      if (detail?.nodeId) openCanvasRef.current(detail.nodeId);
    };
    window.addEventListener("open-canvas-editor", handler as EventListener);
    return () =>
      window.removeEventListener(
        "open-canvas-editor",
        handler as EventListener,
      );
  }, [updateUI]);

  useEffect(() => {
    openTypographyRef.current = (nodeId: string) => {
      updateUI({
        activeTab: "typography",
        selectedNodeId: nodeId,
        selectedNodeType: "typography",
      });
      const url = new URL(window.location.href);
      url.searchParams.set("tab", "typography");
      url.searchParams.set("node", nodeId);
      window.history.pushState({}, "", url.toString());
    };

    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ nodeId: string }>).detail;
      if (detail?.nodeId) openTypographyRef.current(detail.nodeId);
    };
    window.addEventListener("open-typography-editor", handler as EventListener);
    return () =>
      window.removeEventListener(
        "open-typography-editor",
        handler as EventListener,
      );
  }, [updateUI]);

  useEffect(() => {
    openMediaRef.current = (nodeId: string) => {
      updateUI({
        activeTab: "media",
        selectedNodeId: nodeId,
        selectedNodeType: "media",
      });
      const url = new URL(window.location.href);
      url.searchParams.set("tab", "media");
      url.searchParams.set("node", nodeId);
      window.history.pushState({}, "", url.toString());
    };

    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ nodeId: string }>).detail;
      if (detail?.nodeId) openMediaRef.current(detail.nodeId);
    };
    window.addEventListener("open-media-editor", handler as EventListener);
    return () =>
      window.removeEventListener("open-media-editor", handler as EventListener);
  }, [updateUI]);

  useEffect(() => {
    openLogViewerRef.current = (nodeId: string) => {
      handleOpenResultLogViewer(nodeId);
    };
  }, [handleOpenResultLogViewer]);

  const nodeTypes: NodeTypes = useMemo(() => {
    return createNodeTypes(
      (id) => openTimelineRef.current?.(id),
      (id) => openLogViewerRef.current?.(id),
    );
  }, []); // Empty deps array - create once

  const { onConnect } = useConnections(
    nodes,
    edges,
    setEdges,
    flowTracker,
    (newEdges: Edge[]) => updateFlow({ edges: newEdges }),
  );
  const {
    runToNode,
    getDebugResult,
    getAllDebugResults,
    clearDebugResults,
    isDebugging,
  } = useDebugExecution(nodes, edges);

  const {
    videoUrl,
    videos,
    canGenerate,
    handleGenerateScene,
    handleDownloadAll,
    handleDownloadVideo,
    lastError,
    resetGeneration,
    isGenerating,
    getValidationSummary,
    // image
    imageUrl,
    canGenerateImage,
    handleGenerateImage,
    isGeneratingImage,
    images,
    handleDownloadAllImages,
    handleDownloadImage,
    // NEW: Selective generation
    handleGenerateSelected,
  } = useSceneGeneration(nodes, edges);

  // Simple delete handler - no complex optimization needed
  const handleDeleteNodeById = useCallback(
    (nodeId: string) => {
      const nodeToDelete = nodes.find(
        (node) => node.data.identifier.id === nodeId,
      );
      if (nodeToDelete) {
        onNodesDelete([nodeToDelete]);
      }
    },
    [nodes, onNodesDelete],
  );

  const validationSummary = getValidationSummary();

  const { leftSidebarCollapsed, rightSidebarCollapsed } = state.ui as {
    leftSidebarCollapsed?: boolean;
    rightSidebarCollapsed?: boolean;
  };

  return (
    <div className="flex h-full">
      {!leftSidebarCollapsed && <NodePalette onAddNode={handleAddNode} />}
      <div className="flex flex-1 flex-col">
        <div className="flex h-12 items-center border-b border-[var(--border-primary)] bg-[var(--surface-1)]/60 px-[var(--space-3)]">
          <ActionsToolbar
            // NEW: Pass workspace nodes
            allNodes={nodes}
            // Existing props (unchanged)
            onGenerate={handleGenerateScene}
            canGenerate={canGenerate}
            isGenerating={isGenerating}
            onGenerateImage={handleGenerateImage}
            canGenerateImage={canGenerateImage}
            isGeneratingImage={isGeneratingImage}
            // NEW: Selective generation
            onGenerateSelected={handleGenerateSelected}
            // Shared props (unchanged)
            lastError={lastError}
            onResetGeneration={resetGeneration}
            validationSummary={validationSummary}
          />
        </div>
        <div className="relative flex-1">
          <DebugProvider
            value={{
              runToNode,
              getDebugResult,
              getAllDebugResults,
              clearDebugResults,
              isDebugging,
            }}
          >
            <DeleteProvider onDeleteNode={handleDeleteNodeById}>
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
                onNodeDragStop={() => {
                  // Context sync happens automatically via useEffect when nodes change
                }}
                onSelectionChange={handleSelectionChange}
                disableDeletion={resultLogModalState.isOpen}
              />
            </DeleteProvider>
            <ResultLogModal
              isOpen={resultLogModalState.isOpen}
              onClose={handleCloseResultLogViewer}
              nodeId={resultLogModalState.nodeId ?? ""}
              nodeName={getResultNodeData().name}
              nodeLabel={getResultNodeData().label}
            />
          </DebugProvider>
        </div>
      </div>
      {!rightSidebarCollapsed && (
        <RightSidebar
          // Property panel props (existing functionality preserved)
          node={selectedNode}
          allNodes={nodes}
          allEdges={edges}
          onChange={(newData: Partial<NodeData>) => {
            if (!selectedNode) return;
            // updateNodeData already updates local state, context sync happens automatically
            updateNodeData(selectedNode.data.identifier.id, newData);
          }}
          onDisplayNameChange={(nodeId: string, newDisplayName: string) => {
            // updateDisplayName already updates local state, context sync happens automatically
            return updateDisplayName(nodeId, newDisplayName) !== null;
          }}
          validateDisplayName={validateDisplayName}
          flowTracker={flowTracker}
          // Preview panel props (moved from floating preview)
          videoUrl={videoUrl}
          videos={videos}
          onDownloadVideo={handleDownloadVideo}
          onDownloadAll={handleDownloadAll}
          imageUrl={imageUrl}
          images={images}
          onDownloadImage={handleDownloadImage}
          onDownloadAllImages={handleDownloadAllImages}
        />
      )}
    </div>
  );
}
