// src/components/workspace/nodes/animation-node.tsx - Simplified single input/output ports
"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { getTrackColors, TRACK_ICONS } from "@/shared/registry/registry-utils";
import { getNodeDefinition } from "@/shared/registry/registry-utils";
import type { AnimationNodeData } from "@/shared/types/nodes";
import { Clapperboard } from "lucide-react";

interface AnimationNodeProps extends NodeProps<AnimationNodeData> {
  onOpenTimeline?: () => void;
}

export function AnimationNode({ data, selected, onOpenTimeline }: AnimationNodeProps) {
  const nodeDefinition = getNodeDefinition('animation');
  
  const handleDoubleClick = () => {
    if (onOpenTimeline) return onOpenTimeline();
    // Fallback: navigate to dedicated timeline editor page preserving workspace
    const params = new URLSearchParams(window.location.search);
    const ws = params.get('workspace');
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'timeline');
    url.searchParams.set('node', data.identifier.id);
    if (ws) url.searchParams.set('workspace', ws);
    window.history.pushState({}, '', url.toString());
  };

  const trackCount = data.tracks?.length || 0;
  const trackTypes = data.tracks?.map(t => t.type) || [];
  const uniqueTypes = [...new Set(trackTypes)];

  const handleClass = "bg-[var(--node-animation)]";

  return (
    <Card selected={selected} className="p-[var(--card-padding)] min-w-[var(--node-min-width)] cursor-pointer transition-all hover:bg-[var(--surface-interactive)]" onDoubleClick={handleDoubleClick}>
      {/* Single input port */}
      {nodeDefinition?.ports.inputs.map((port) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          className={`w-3 h-3 ${handleClass} !border-2 !border-[var(--text-primary)]`}
          style={{ top: `50%` }}
        />
      ))}

      <CardHeader className="p-0 pb-[var(--space-3)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[var(--space-2)] flex-1 min-w-0">
            <div className="w-6 h-6 bg-[var(--node-animation)] flex items-center justify-center rounded text-[var(--text-primary)]">
              <Clapperboard size={12} />
            </div>
            <span className="font-semibold text-[var(--text-primary)]">
              {data.identifier.displayName}
            </span>
          </div>
          <div className="text-xs text-[var(--text-tertiary)]">{data.duration}s</div>
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-[var(--space-2)]">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-secondary)]">Tracks:</span>
          <span className="text-xs text-[var(--text-primary)] font-medium">{trackCount}</span>
        </div>
        
        {trackCount > 0 && (
          <div className="flex flex-wrap gap-1">
            {uniqueTypes.map((type) => (
              <span
                key={type}
                className={`text-xs px-[var(--space-2)] py-[var(--space-1)] rounded-[var(--radius-sharp)] ${getTrackColors()[type]} text-[var(--text-primary)]`}
              >
                {TRACK_ICONS[type]} {type}
              </span>
            ))}
          </div>
        )}

        {trackCount === 0 && (
          <div className="text-xs text-[var(--text-tertiary)] text-center py-2">
            No tracks
          </div>
        )}

        <div className="text-[var(--text-tertiary)] text-[10px] pt-1">Variables can be bound in the timeline editor</div>
      </CardContent>

      {/* Single output port */}
      {nodeDefinition?.ports.outputs.map((port) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          className={`w-3 h-3 ${handleClass} !border-2 !border-[var(--text-primary)]`}
          style={{ top: `50%` }}
        />
      ))}
    </Card>
  );
}