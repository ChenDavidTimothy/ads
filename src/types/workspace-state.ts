import type { Node, Edge } from 'reactflow';
import type { AnimationTrack, NodeData } from '@/shared/types/nodes';

export interface WorkspaceState {
	// Core flow data persisted to backend
	flow: {
		nodes: Node<NodeData>[];
		edges: Edge[];
	};

	editors: {
		timeline: Record<string, TimelineEditorData>;
		// Future editors can be added here
		// image?: Record<string, ImageEditorData>;
		// audio?: Record<string, AudioEditorData>;
	};

	// UI state (not persisted to backend)
	ui: {
		activeTab: 'flow' | 'timeline' | 'canvas' | 'image' | 'audio' | 'typography' | 'media';
		selectedNodeId?: string;
		selectedNodeType?: string;
		leftSidebarCollapsed?: boolean;
		rightSidebarCollapsed?: boolean;
	};

	// Metadata about the workspace
	meta: {
		version: number;
		lastModified: Date; // derived from server updated_at
		workspaceId: string;
		name: string;
	};
}

export interface TimelineEditorData {
	duration: number;
	tracks: AnimationTrack[];
}

// Future editor data types - using object type instead of empty interface
export type ImageEditorData = Record<string, never>;

export type AudioEditorData = Record<string, never>;