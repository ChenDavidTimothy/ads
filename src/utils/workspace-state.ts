import type { Node, Edge } from 'reactflow';
import type { WorkspaceState, TimelineEditorData } from '@/types/workspace-state';
import type { AnimationTrack, NodeData } from '@/shared/types/nodes';
import { generateTransformIdentifier } from '@/lib/defaults/transforms';

// Convert backend workspace data to unified state
export function extractWorkspaceState(workspaceData: unknown): WorkspaceState {
	// The server returns: { id, name, flow_data, version, updated_at }
	const ws = workspaceData as {
		id: string;
		name: string;
		version: number;
		updated_at: string;
		flow_data: { nodes?: unknown[]; edges?: unknown[] } | null;
	};

	const flowData = normalizeFlowData(ws?.flow_data);

	return {
		flow: {
			nodes: flowData.nodes,
			edges: flowData.edges,
		},
		editors: {
			timeline: getTimelineDataFromNodes(flowData.nodes),
		},
		ui: {
			activeTab: 'flow',
			selectedNodeId: undefined,
			selectedNodeType: undefined,
			leftSidebarCollapsed: false,
			rightSidebarCollapsed: false,
		},
		meta: {
			version: Number(ws?.version ?? 0),
			lastModified: new Date(ws?.updated_at ?? Date.now()),
			workspaceId: String(ws?.id ?? ''),
			name: String(ws?.name ?? 'Untitled'),
		},
	};
}

function normalizeFlowData(flowData: { nodes?: unknown[]; edges?: unknown[] } | null | undefined): { nodes: Node<NodeData>[]; edges: Edge[] } {
	if (!flowData || typeof flowData !== 'object') {
		return { nodes: [], edges: [] };
	}
	const nodes = Array.isArray(flowData.nodes) ? flowData.nodes as Node<NodeData>[] : [];
	const edges = Array.isArray(flowData.edges) ? flowData.edges as Edge[] : [];
	return { nodes, edges };
}

// Extract timeline data from animation nodes
export function getTimelineDataFromNodes(nodes: Node<NodeData>[]): Record<string, TimelineEditorData> {
	const timelines: Record<string, TimelineEditorData> = {};

	nodes
		.filter((node) => node?.type === 'animation')
		.forEach((node) => {
			const nodeId = node?.data?.identifier?.id;
			if (!nodeId) return;

			const duration = (node?.data as unknown as { duration?: number })?.duration ?? 3;
			const rawTracks = (node?.data as unknown as { tracks?: AnimationTrack[] })?.tracks ?? [];
			const tracks = ensureTrackIdentifiers(rawTracks);

			timelines[nodeId] = { duration, tracks };
		});

	return timelines;
}

function ensureTrackIdentifiers(tracks: AnimationTrack[]): AnimationTrack[] {
	return tracks.map((t, idx, arr) => {
		const maybe = t as unknown as { identifier?: unknown; type?: string };
		if (maybe && maybe.identifier) return t;
		const identifier = generateTransformIdentifier(t.type, arr);
		const { ...rest } = t as Omit<AnimationTrack, 'identifier'> & { id?: string };
		return { ...(rest as object), identifier } as AnimationTrack;
	});
}

// Merge editor data back into flow nodes for backend storage
export function mergeEditorsIntoFlow(state: WorkspaceState): { nodes: Node<NodeData>[]; edges: Edge[] } {
	const nodes = state.flow.nodes.map((node) => {
		if (node.type === 'animation') {
			const nodeId = node?.data?.identifier?.id;
			if (nodeId) {
				const timelineData = state.editors.timeline[nodeId];
				if (timelineData) {
					return {
						...node,
						data: {
							...(node.data as NodeData),
							duration: timelineData.duration,
							tracks: timelineData.tracks,
						} as NodeData,
					} as Node<NodeData>;
				}
			}
		}
		return node as Node<NodeData>;
	});

	return { nodes, edges: state.flow.edges };
}