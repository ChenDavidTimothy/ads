// src/components/workspace/flow-editor-tab.tsx - Updated to use collapsible right sidebar
"use client";

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { applyNodeChanges, applyEdgeChanges, type NodeTypes, type NodeChange, type EdgeChange } from 'reactflow';
import { FlowCanvas } from './flow/components/flow-canvas';
import { NodePalette } from './node-palette';
import { ActionsToolbar } from './flow/components/actions-toolbar';
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
import type { NodeType } from '@/shared/types/definitions';
import { useWorkspace } from './workspace-context';
import { generateTransformIdentifier } from '@/lib/defaults/transforms';
import { getDefaultNodeData } from '@/lib/defaults/nodes';

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

	// Sync workspace context with flow graph state
	useEffect(() => {
		setNodes(ctxNodes as unknown as Node<NodeData>[]);
	}, [ctxNodes, setNodes]);

	useEffect(() => {
		setEdges(ctxEdges);
	}, [ctxEdges, setEdges]);

	// Keep refs in sync for property panel updates
	const latestLocalNodesRef = useRef<Node<NodeData>[]>(nodes);
	const latestLocalEdgesRef = useRef<Edge[]>(edges);
	const pendingPropertySyncRef = useRef(false);

	// Update refs when local state changes
	useEffect(() => {
		latestLocalNodesRef.current = nodes;
		latestLocalEdgesRef.current = edges;
	}, [nodes, edges]);



	// After property-panel updates mutate local nodes/edges, push the latest to context once
	useEffect(() => {
		if (!pendingPropertySyncRef.current) return;
		updateFlow({
			nodes: latestLocalNodesRef.current as unknown as Node<NodeData>[],
			edges: latestLocalEdgesRef.current as Edge[],
		});
		pendingPropertySyncRef.current = false;
	}, [nodes, edges, updateFlow]);

	// Flush any pending property-panel sync on unmount or tab switch
	useEffect(() => {
		return () => {
			if (pendingPropertySyncRef.current) {
				updateFlow({
					nodes: latestLocalNodesRef.current as unknown as Node<NodeData>[],
					edges: latestLocalEdgesRef.current as Edge[],
				});
				pendingPropertySyncRef.current = false;
			}
		};
	}, [updateFlow]);

	const {
		resultLogModalState,
		handleOpenResultLogViewer,
		handleCloseResultLogViewer,
		getResultNodeData,
	} = useResultLogViewer(nodes);

	// Track current selection
	const selectedNodesRef = useRef<Node<NodeData>[]>([]);
	const selectedEdgesRef = useRef<Edge[]>([]);

	const handleSelectionChange = useCallback((params: { nodes: Node[]; edges: Edge[] }) => {
		selectedNodesRef.current = (params.nodes as unknown as Node<NodeData>[]) ?? [];
		selectedEdgesRef.current = (params.edges as Edge[]) ?? [];
	}, []);

	// Use the robust deletion handlers from useFlowGraph - no custom keyboard handling needed

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
	const openCanvasRef = useRef<(nodeId: string) => void>(() => {});
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
		openCanvasRef.current = (nodeId: string) => {
			updateUI({ activeTab: 'canvas', selectedNodeId: nodeId, selectedNodeType: 'canvas' });
			const url = new URL(window.location.href);
			url.searchParams.set('tab', 'canvas');
			url.searchParams.set('node', nodeId);
			window.history.pushState({}, '', url.toString());
		};

		const handler = (e: Event) => {
			const detail = (e as CustomEvent<{ nodeId: string }>).detail;
			if (detail?.nodeId) openCanvasRef.current(detail.nodeId);
		};
		window.addEventListener('open-canvas-editor', handler as EventListener);
		return () => window.removeEventListener('open-canvas-editor', handler as EventListener);
	}, [updateUI]);

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
		// image
		imageUrl,
		hasImage,
		canGenerateImage,
		handleGenerateImage,
		isGeneratingImage,
		images,
		handleDownloadAllImages,
		handleDownloadImage,
	} = useSceneGeneration(nodes, edges);

	const validationSummary = getValidationSummary();

	const { leftSidebarCollapsed, rightSidebarCollapsed } = state.ui as { leftSidebarCollapsed?: boolean; rightSidebarCollapsed?: boolean };



	return (
		<div className="flex h-full">
			{!leftSidebarCollapsed && <NodePalette onAddNode={handleAddNode} />}
			<div className="flex-1 flex flex-col">
				<div className="h-12 flex items-center px-[var(--space-3)] border-b border-[var(--border-primary)] bg-[var(--surface-1)]/60">
					<ActionsToolbar
						onGenerate={handleGenerateScene}
						canGenerate={canGenerate}
						isGenerating={isGenerating}
						// Remove all download props - these move to sidebar
						// video
						onGenerateImage={handleGenerateImage}
						canGenerateImage={canGenerateImage}
						isGeneratingImage={isGeneratingImage}
						// shared
						lastError={lastError}
						onResetGeneration={resetGeneration}
						validationSummary={validationSummary}
					/>
				</div>
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
							onNodeDragStop={() => {
								// Sync nodes to context once at the end of a drag gesture
								updateFlow({ nodes: latestLocalNodesRef.current as unknown as Node<NodeData>[] });
							}}
							onSelectionChange={handleSelectionChange}
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
						const nextNodes = updateNodeData(selectedNode.data.identifier.id, newData);
						// Keep latest refs in sync and persist to context immediately to avoid reversion
						latestLocalNodesRef.current = nextNodes as unknown as Node<NodeData>[];
						pendingPropertySyncRef.current = false;
						updateFlow({
							nodes: nextNodes as unknown as Node<NodeData>[],
							edges: (latestLocalEdgesRef.current as Edge[]),
						});
					}}
					onDisplayNameChange={(nodeId: string, newDisplayName: string) => {
						const nextNodes = updateDisplayName(nodeId, newDisplayName);
						if (!nextNodes) return false;
						latestLocalNodesRef.current = nextNodes as unknown as Node<NodeData>[];
						pendingPropertySyncRef.current = false;
						updateFlow({
							nodes: nextNodes as unknown as Node<NodeData>[],
							edges: (latestLocalEdgesRef.current as Edge[]),
						});
						return true;
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