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
		activeTab: 'flow' | 'timeline' | 'canvas' | 'image' | 'audio';
		selectedNodeId?: string;
		selectedNodeType?: string;
		leftSidebarCollapsed?: boolean;
		rightSidebarCollapsed?: boolean;

		// Preview panel state
		previewVisible?: boolean;
		previewDock?: 'bottom' | 'overlay';
		previewActiveTab?: 'video' | 'image';
		previewVideoUrl?: string | null;
		previewImageUrl?: string | null;
		previewVideos?: UIPreviewVideoJob[];
		previewImages?: UIPreviewImageJob[];
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

// Lightweight UI types for persisting preview job state in memory/local backup
export interface UIPreviewVideoJob {
	jobId: string;
	sceneName: string;
	sceneId: string;
	status: 'pending' | 'processing' | 'completed' | 'failed';
	videoUrl?: string;
	error?: string;
}

export interface UIPreviewImageJob {
	jobId: string;
	frameName: string;
	frameId: string;
	status: 'pending' | 'processing' | 'completed' | 'failed';
	imageUrl?: string;
	error?: string;
}

// Future editor data types
export interface ImageEditorData {
	// Define when image editor is implemented
}

export interface AudioEditorData {
	// Define when audio editor is implemented
}