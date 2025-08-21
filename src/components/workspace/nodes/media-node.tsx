"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { getNodeDefinition } from "@/shared/registry/registry-utils";
import type { MediaNodeData } from "@/shared/types/nodes";
import { Image, Settings } from "lucide-react";

export function MediaNode({
  data,
  selected,
  onOpenMedia,
}: NodeProps<MediaNodeData> & { onOpenMedia?: () => void }) {
  const nodeDefinition = getNodeDefinition("media");

  const handleDoubleClick = () => {
    if (onOpenMedia) {
      onOpenMedia();
    } else {
      // Dispatch custom event to open media editor
      window.dispatchEvent(
        new CustomEvent("open-media-editor", {
          detail: { nodeId: data.identifier.id },
        }),
      );
    }
  };

  const currentAsset = data.imageAssetId ? "Selected" : "No asset";
  const cropInfo =
    data.cropWidth > 0 ? `${data.cropWidth}×${data.cropHeight}` : "Full size";

  return (
    <Card
      selected={selected}
      className="min-w-[var(--node-min-width)] cursor-pointer p-[var(--card-padding)] transition-all hover:bg-[var(--surface-interactive)]"
      onDoubleClick={handleDoubleClick}
    >
      <CardHeader className="p-0 pb-[var(--space-3)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-[var(--node-animation)] text-[var(--text-primary)]">
            <Image size={12} aria-label="Media node icon" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold text-[var(--text-primary)]">
              {data.identifier.displayName}
            </div>
          </div>
          <Settings size={12} className="text-[var(--text-tertiary)]" />
        </div>
      </CardHeader>

      <CardContent className="space-y-1 p-0 text-xs text-[var(--text-secondary)]">
        <div className="truncate">Asset: {currentAsset}</div>
        <div>Crop: {cropInfo}</div>
        <div>
          Display:{" "}
          {data.displayWidth > 0
            ? `${data.displayWidth}×${data.displayHeight}`
            : "Auto"}
        </div>
        <div className="pt-1 text-[10px] text-[var(--text-tertiary)]">
          Double-click to edit in Media tab
        </div>
      </CardContent>

      {nodeDefinition?.ports.inputs.map((port) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          className="h-3 w-3 !border-2 !border-[var(--text-primary)] bg-[var(--node-animation)]"
          style={{ top: "50%" }}
        />
      ))}

      {nodeDefinition?.ports.outputs.map((port) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          className="h-3 w-3 !border-2 !border-[var(--text-primary)] bg-[var(--node-animation)]"
          style={{ top: "50%" }}
        />
      ))}
    </Card>
  );
}
