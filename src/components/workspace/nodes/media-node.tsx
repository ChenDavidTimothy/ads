"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { getNodeDefinition } from "@/shared/registry/registry-utils";
import type { MediaNodeData } from "@/shared/types/nodes";
import { Image, Settings } from "lucide-react";

export function MediaNode({ data, selected, onOpenMedia }: NodeProps<MediaNodeData> & { onOpenMedia?: () => void }) {
  const nodeDefinition = getNodeDefinition('media');

  const handleDoubleClick = () => {
    if (onOpenMedia) {
      onOpenMedia();
    } else {
      // Dispatch custom event to open media editor
      window.dispatchEvent(new CustomEvent('open-media-editor', { 
        detail: { nodeId: data.identifier.id } 
      }));
    }
  };

  const currentAsset = data.imageAssetId ? 'Selected' : 'No asset';
  const cropInfo = data.cropWidth > 0 ? `${data.cropWidth}×${data.cropHeight}` : 'Full size';
  
  return (
    <Card 
      selected={selected} 
      className="p-[var(--card-padding)] min-w-[var(--node-min-width)] cursor-pointer transition-all hover:bg-[var(--surface-interactive)]"
      onDoubleClick={handleDoubleClick}
    >
      <CardHeader className="p-0 pb-[var(--space-3)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <div className="w-6 h-6 bg-[var(--node-animation)] flex items-center justify-center rounded text-[var(--text-primary)]">
            <Image size={12} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[var(--text-primary)] truncate">
              {data.identifier.displayName}
            </div>
          </div>
          <Settings size={12} className="text-[var(--text-tertiary)]" />
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-1 text-xs text-[var(--text-secondary)]">
        <div className="truncate">Asset: {currentAsset}</div>
        <div>Crop: {cropInfo}</div>
        <div>Display: {data.displayWidth > 0 ? `${data.displayWidth}×${data.displayHeight}` : 'Auto'}</div>
        <div className="text-[var(--text-tertiary)] text-[10px] pt-1">
          Double-click to edit in Media tab
        </div>
      </CardContent>

      {nodeDefinition?.ports.inputs.map((port) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          className="w-3 h-3 bg-[var(--node-animation)] !border-2 !border-[var(--text-primary)]"
          style={{ top: '50%' }}
        />
      ))}

      {nodeDefinition?.ports.outputs.map((port) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          className="w-3 h-3 bg-[var(--node-animation)] !border-2 !border-[var(--text-primary)]"
          style={{ top: '50%' }}
        />
      ))}
    </Card>
  );
}
