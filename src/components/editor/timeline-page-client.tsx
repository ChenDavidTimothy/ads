"use client";

import { TimelineEditorCore } from "@/components/editor/timeline-editor-core";
import { api } from "@/trpc/react";

export function TimelinePageClient({ workspaceId, nodeId }: { workspaceId: string; nodeId: string }) {
  const utils = api.useUtils();
  const { data: ws, isLoading } = api.workspace.get.useQuery({ id: workspaceId });
  const saveMutation = api.workspace.save.useMutation({
    onSuccess: async () => {
      await utils.workspace.get.invalidate({ id: workspaceId });
    },
  });

  if (isLoading) {
    return <div className="h-screen w-full bg-gray-900 text-gray-300 p-6">Loading timeline…</div>;
  }
  if (!ws) {
    return <div className="h-screen w-full bg-gray-900 text-gray-300 p-6">Workspace not found</div>;
  }

  const nodes = (ws.flow_data as any).nodes as any[];
  const node = nodes.find((n) => n?.data?.identifier?.id === nodeId && n?.type === "animation");
  if (!node) {
    return <div className="h-screen w-full bg-gray-900 text-gray-300 p-6">Animation node not found</div>;
  }

  const duration: number = typeof node.data?.duration === "number" ? node.data.duration : 3;
  const tracks: any[] = Array.isArray(node.data?.tracks) ? node.data.tracks : [];

  const handleSave = async (newDuration: number, newTracks: any[]) => {
    const next = structuredClone(ws.flow_data) as any;
    const idx = next.nodes.findIndex((n: any) => n?.data?.identifier?.id === nodeId);
    if (idx >= 0) {
      next.nodes[idx] = { ...next.nodes[idx], data: { ...next.nodes[idx].data, duration: newDuration, tracks: newTracks } };
    }
    await saveMutation.mutateAsync({ id: ws.id, flowData: next, version: ws.version });
    window.location.href = `/editor?workspace=${workspaceId}`;
  };

  const handleCancel = () => {
    window.location.href = `/editor?workspace=${workspaceId}`;
  };

  return (
    <div className="h-screen w-full bg-gray-900">
      <TimelineEditorCore initialDuration={duration} initialTracks={tracks as any} onSave={handleSave} onCancel={handleCancel} />
    </div>
  );
}


