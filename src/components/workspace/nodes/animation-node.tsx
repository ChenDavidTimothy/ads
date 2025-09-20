// src/components/workspace/nodes/animation-node.tsx - Simplified single input/output ports
'use client';

import { Handle, Position, type NodeProps } from 'reactflow';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { transformFactory } from '@/shared/registry/transforms';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { AnimationNodeData } from '@/shared/types/nodes';
import { Clapperboard } from 'lucide-react';

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
  const trackTypes = data.tracks?.map((t) => t.type) || [];
  const uniqueTypes = [...new Set(trackTypes)];

  const handleClass = 'bg-[var(--node-animation)]';

  return (
    <Card
      selected={selected}
      className="min-w-[var(--node-min-width)] cursor-pointer p-[var(--card-padding)] transition-all hover:bg-[var(--surface-interactive)]"
      onDoubleClick={handleDoubleClick}
    >
      {/* Single input port */}
      {nodeDefinition?.ports.inputs.map((port) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          className={`h-3 w-3 ${handleClass} !border-2 !border-[var(--text-primary)]`}
          style={{ top: `50%` }}
        />
      ))}

      <CardHeader className="p-0 pb-[var(--space-3)]">
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-[var(--space-2)]">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-[var(--node-animation)] text-[var(--text-primary)]">
              <Clapperboard size={12} />
            </div>
            <span className="font-semibold text-[var(--text-primary)]">
              {data.identifier.displayName}
            </span>
          </div>
          <div className="text-xs text-[var(--text-tertiary)]">{data.duration}s</div>
        </div>
      </CardHeader>

      <CardContent className="space-y-[var(--space-2)] p-0">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-secondary)]">Tracks:</span>
          <span className="text-xs font-medium text-[var(--text-primary)]">{trackCount}</span>
        </div>

        {trackCount > 0 && (
          <div className="flex flex-wrap gap-1">
            {uniqueTypes.map((type) => (
              <span
                key={type}
                className={`rounded-[var(--radius-sharp)] px-[var(--space-2)] py-[var(--space-1)] text-xs ${transformFactory.getTrackColors()[type] ?? 'bg-[var(--surface-2)]'} text-[var(--text-primary)]`}
              >
                {transformFactory.getTrackIcons()[type] ?? '●'} {type}
              </span>
            ))}
          </div>
        )}

        {trackCount === 0 && (
          <div className="py-2 text-center text-xs text-[var(--text-tertiary)]">No tracks</div>
        )}

        <div className="pt-1 text-[10px] text-[var(--text-tertiary)]">
          Variables can be bound in the timeline editor
        </div>
      </CardContent>

      {/* Single output port */}
      {nodeDefinition?.ports.outputs.map((port) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          className={`h-3 w-3 ${handleClass} !border-2 !border-[var(--text-primary)]`}
          style={{ top: `50%` }}
        />
      ))}
    </Card>
  );
}
