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
import { useOnlineStatus } from "@/hooks/use-online-status";
import { generateTransformIdentifier } from "@/lib/defaults/transforms";
import { debounce } from "@/lib/utils";
import { FlowTracker } from "@/lib/flow/flow-tracking";
import { reconcileLayerOrder } from "./layer-management/layer-management-utils";

export function FlowEditorTab() {
  const {
    state,
    updateFlow,
    updateUI,
    updateTimeline,
    saveNow,
    isSaving,
    hasUnsavedChanges,
  } = useWorkspace();
  const isOnline = useOnlineStatus();
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

  // Temporary suspension flag to avoid context sync reverting external updates (like layer order)
  const suspendContextSyncRef = useRef(false);

  // Initialize local state from context on mount (load saved nodes) with edge sanitization
  useEffect(() => {
    if (ctxNodes.length > 0 && nodes.length === 0) {
      const nodeIdSet = new Set(ctxNodes.map((n) => n.id));
      const initialEdges = (ctxEdges ?? []).filter(
        (e) => nodeIdSet.has(e.source) && nodeIdSet.has(e.target),
      );
      setNodes(ctxNodes);
      if (initialEdges.length > 0) setEdges(initialEdges);
    }
  }, [ctxNodes, ctxEdges, nodes.length, edges.length, setNodes, setEdges]);

  // SURGICAL FIX: Drag-aware context sync with equality guard
  const debouncedContextSync = useMemo(() => {
    const areNodesEqual = (a: Node<NodeData>[], b: Node<NodeData>[]) => {
      if (a === b) return true;
      if (!a || !b) return false;
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        const na = a[i];
        const nb = b[i];
        if (!na || !nb) return false;
        if (na.id !== nb.id) return false;
        if (na.type !== nb.type) return false;
        const pa = na.position ?? { x: 0, y: 0 };
        const pb = nb.position ?? { x: 0, y: 0 };
        if (pa.x !== pb.x || pa.y !== pb.y) return false;
        // Shallow data identity check (avoid deep compare)
        if (na.data !== nb.data) return false;
      }
      return true;
    };

    const areEdgesEqual = (a: Edge[], b: Edge[]) => {
      if (a === (b as unknown)) return true;
      if (!a || !b) return false;
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        const ea = a[i];
        const eb = b[i];
        if (!ea || !eb) return false;
        if (ea.source !== eb.source || ea.target !== eb.target) return false;
      }
      return true;
    };

    return debounce((newNodes: Node<NodeData>[], newEdges: Edge[]) => {
      if (isDragging) return;
      if (suspendContextSyncRef.current) return;
      const ctxNodesNow = ctxNodes;
      const ctxEdgesNow = ctxEdges;
      if (
        areNodesEqual(newNodes, ctxNodesNow) &&
        areEdgesEqual(newEdges, ctxEdgesNow)
      ) {
        return; // No-op
      }
      updateFlow({ nodes: newNodes, edges: newEdges });
    }, 50);
  }, [updateFlow, isDragging, ctxNodes, ctxEdges]);

  // Context sync with drag awareness
  useEffect(() => {
    if (!isDragging) {
      debouncedContextSync(nodes, edges);
    }
  }, [nodes, edges, debouncedContextSync, isDragging]); // ← ADD: isDragging guard

  // CRITICAL: Force sync when drag ends
  useEffect(() => {
    if (!isDragging) {
      debouncedContextSync(nodes, edges);
    }
  }, [isDragging, nodes, edges, debouncedContextSync]);

  // Listen for layer order updates from the Layers modal to update local nodes and avoid snap-back
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handler = (e: Event) => {
      const detail = (
        e as CustomEvent<{ nodeIdentifierId: string; order: string[] }>
      ).detail;
      if (!detail) return;

      // Suspend context sync briefly to prevent overwriting the external change
      suspendContextSyncRef.current = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        suspendContextSyncRef.current = false;
        timer = null;
      }, 150);

      setNodes((prev) => {
        return prev.map((n) => {
          const nid = n.data.identifier?.id;
          if (nid !== detail.nodeIdentifierId) return n;
          return {
            ...n,
            data: { ...n.data, layerOrder: [...detail.order] },
          };
        });
      });
    };

    window.addEventListener("layer-order-updated", handler as EventListener);
    return () => {
      window.removeEventListener(
        "layer-order-updated",
        handler as EventListener,
      );
      if (timer) clearTimeout(timer);
    };
  }, [setNodes]);

  // Listen for batch-keys updates to sync local nodes and avoid snap-back overwrite
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handler = (e: Event) => {
      const detail = (
        e as CustomEvent<{ nodeIdentifierId: string; keys: string[] }>
      ).detail;
      if (!detail) return;

      // Suspend context sync briefly to prevent overwriting the external change
      suspendContextSyncRef.current = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        suspendContextSyncRef.current = false;
        timer = null;
      }, 150);

      setNodes((prev) => {
        return prev.map((n) => {
          const nid = n.data.identifier?.id;
          if (nid !== detail.nodeIdentifierId) return n;
          return {
            ...n,
            data: { ...n.data, keys: [...detail.keys] },
          };
        });
      });
    };

    window.addEventListener("batch-keys-updated", handler as EventListener);
    return () => {
      window.removeEventListener(
        "batch-keys-updated",
        handler as EventListener,
      );
      if (timer) clearTimeout(timer);
    };
  }, [setNodes]);

  // Listen for insert appearance-time updates to sync local nodes and avoid snap-back overwrite
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handler = (e: Event) => {
      const detail = (
        e as CustomEvent<{
          nodeIdentifierId: string;
          defaultTime?: number;
          objectId?: string;
          time?: number;
          clear?: boolean;
        }>
      ).detail;
      if (!detail) return;

      // Suspend context sync briefly to prevent overwriting the external change
      suspendContextSyncRef.current = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        suspendContextSyncRef.current = false;
        timer = null;
      }, 150);

      setNodes((prev) => {
        return prev.map((n) => {
          const nid = n.data.identifier?.id;
          if (nid !== detail.nodeIdentifierId) return n;
          if (n.type !== "insert") return n;

          // Default time update
          if (typeof detail.defaultTime === "number") {
            return {
              ...n,
              data: { ...n.data, appearanceTime: detail.defaultTime },
            } as typeof n;
          }

          // Per-object updates
          const currentMap: Record<string, number> =
            (
              n.data as unknown as {
                appearanceTimeByObject?: Record<string, number>;
              }
            ).appearanceTimeByObject ?? {};

          if (detail.objectId) {
            if (detail.clear) {
              const next = { ...currentMap };
              delete next[detail.objectId];
              const nextData = { ...n.data } as unknown as {
                appearanceTimeByObject?: Record<string, number>;
              };
              if (Object.keys(next).length > 0) {
                nextData.appearanceTimeByObject = next;
              } else {
                delete nextData.appearanceTimeByObject;
              }
              return { ...n, data: nextData } as typeof n;
            }

            if (typeof detail.time === "number") {
              const next = { ...currentMap, [detail.objectId]: detail.time };
              return {
                ...n,
                data: { ...n.data, appearanceTimeByObject: next },
              } as typeof n;
            }
          }

          return n;
        });
      });
    };

    window.addEventListener(
      "insert-appearance-time-updated",
      handler as EventListener,
    );
    return () => {
      window.removeEventListener(
        "insert-appearance-time-updated",
        handler as EventListener,
      );
      if (timer) clearTimeout(timer);
    };
  }, [setNodes]);

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
    // NEW: Selective generation
    handleGenerateSelected,
  } = useSceneGeneration(nodes, edges);

  // Legacy manual deletion removed: deletion must use React Flow API via useReactFlow in the button

  const validationSummary = getValidationSummary();

  const { leftSidebarCollapsed, rightSidebarCollapsed } = state.ui as {
    leftSidebarCollapsed?: boolean;
    rightSidebarCollapsed?: boolean;
  };

  // Ensure scenes/frames always have a layerOrder that appends new objects to the front
  useEffect(() => {
    // Build updates for any scene/frame whose upstream object set changed
    const tracker = new FlowTracker();
    let didChange = false;
    const nextNodes = nodes.map((n) => {
      if (n.type !== "scene" && n.type !== "frame") return n;
      const identifierId = n.data.identifier?.id;
      if (!identifierId) return n;
      const objects = tracker.getUpstreamObjects(identifierId, nodes, edges);
      const ids = objects.map((o) => o.id);
      const saved = (n.data as { layerOrder?: string[] }).layerOrder;
      const effective = reconcileLayerOrder(ids, saved);
      const arraysEqual = (a: string[] | undefined, b: string[]) =>
        Array.isArray(a) &&
        a.length === b.length &&
        a.every((v, i) => v === b[i]);
      if (!arraysEqual(saved, effective)) {
        didChange = true;
        const data = (n.data as unknown as Record<string, unknown>) || {};
        return {
          ...n,
          data: { ...data, layerOrder: [...effective] } as unknown,
        } as typeof n;
      }
      return n;
    });

    if (didChange) {
      // Update local nodes; debouncedContextSync will persist to workspace context
      setNodes(nextNodes as unknown as Node<NodeData>[]);
    }
  }, [nodes, edges, setNodes]);

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
            // NEW: Save-related props
            onSave={() => void saveNow()}
            isSaving={isSaving}
            hasUnsavedChanges={hasUnsavedChanges}
            isOnline={isOnline}
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
          imageUrl={imageUrl}
          images={images}
        />
      )}
    </div>
  );
}
