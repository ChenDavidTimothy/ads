"use client";

import { TimelineEditorCore } from "@/components/workspace/timeline-editor-core";
import { api } from "@/trpc/react";
import type { AnimationTrack } from "@/shared/types/nodes";
import { generateTransformIdentifier } from "@/lib/defaults/transforms";

interface WorkspaceNode {
  data?: {
    identifier?: {
      id?: string;
    };
    duration?: number;
    tracks?: AnimationTrack[];
  };
  type?: string;
}

type FlowData = { nodes: WorkspaceNode[]; edges: unknown[] };

function isFlowData(value: unknown): value is FlowData {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { nodes?: unknown; edges?: unknown };
  return Array.isArray(v.nodes) && Array.isArray(v.edges);
}

export function TimelinePageClient({ workspaceId, nodeId }: { workspaceId: string; nodeId: string }) {
  const utils = api.useUtils();
  const { data: ws, isLoading } = api.workspace.get.useQuery({ id: workspaceId });
  const saveMutation = api.workspace.save.useMutation({
    onSuccess: async () => {
      // Removed cache invalidation to prevent refetch cascade
      // The workspace data will be updated on next manual refresh
    },
  });

  if (isLoading) {
    return <div className="h-screen w-full bg-gray-900 text-gray-300 p-6">Loading timeline…</div>;
  }
  if (!ws) {
    return <div className="h-screen w-full bg-gray-900 text-gray-300 p-6">Workspace not found</div>;
  }

  // Type-safe access to workspace data
  const rawFlow = ws.flow_data;
  if (!isFlowData(rawFlow)) {
    return <div className="h-screen w-full bg-gray-900 text-gray-300 p-6">Invalid workspace data</div>;
  }
  const flowData: FlowData = rawFlow;

  const node = flowData.nodes.find((n: WorkspaceNode) => 
    n?.data?.identifier?.id === nodeId && n?.type === "animation"
  );
  if (!node) {
    return <div className="h-screen w-full bg-gray-900 text-gray-300 p-6">Animation node not found</div>;
  }

  const duration: number = typeof node.data?.duration === "number" ? node.data.duration : 3;
  const rawTracks: AnimationTrack[] = Array.isArray(node.data?.tracks) ? node.data.tracks : [];
  // Client-side migration: attach identifier if missing
  const tracks: AnimationTrack[] = rawTracks.map((t, idx, arr) => {
    if ((t as unknown as { identifier?: unknown }).identifier) return t as AnimationTrack;
    const identifier = generateTransformIdentifier(t.type, arr as AnimationTrack[]);
    const { /* id, */ ...rest } = t as unknown as Omit<AnimationTrack, 'identifier'> & { id?: string };
    return { ...rest, identifier } as AnimationTrack;
  });

  const handleSave = async (newDuration: number, newTracks: AnimationTrack[]) => {
    const nextNodes = flowData.nodes.slice();
    const idx = nextNodes.findIndex((n: WorkspaceNode) => n?.data?.identifier?.id === nodeId);
    if (idx >= 0) {
      const currentNode = nextNodes[idx];
      if (currentNode?.data) {
        const updatedNode = {
          ...currentNode,
          data: {
            ...currentNode.data,
            duration: newDuration,
            tracks: newTracks,
          },
        };
        nextNodes[idx] = updatedNode;
      }
    }
    await saveMutation.mutateAsync({ 
      id: ws.id, 
      flowData: {
        nodes: nextNodes,
        edges: flowData.edges.slice(),
      },
      version: ws.version 
    });
    window.location.href = `/workspace?workspace=${workspaceId}`;
  };

  const handleCancel = () => {
    window.location.href = `/workspace?workspace=${workspaceId}`;
  };

  return (
    <div className="h-screen w-full bg-gray-900">
      <TimelineEditorCore 
        animationNodeId={nodeId}
        initialDuration={duration} 
        initialTracks={tracks} 
        onSave={handleSave} 
        onCancel={handleCancel} 
      />
    </div>
  );
}


