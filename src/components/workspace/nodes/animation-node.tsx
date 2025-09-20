// src/components/workspace/nodes/animation-node.tsx - Animation node UI
'use client';

import type { NodeProps } from 'reactflow';
import { Clapperboard } from 'lucide-react';

import { getNodeDefinition } from '@/shared/registry/registry-utils';
import { transformFactory } from '@/shared/registry/transforms';
import type { AnimationNodeData } from '@/shared/types/nodes';

import {
  NodeCard,
  NodeHeader,
  NodePortIndicator,
  getNodeCategoryLabel,
  getNodeCategoryVisuals,
} from './components/node-chrome';

interface AnimationNodeProps extends NodeProps<AnimationNodeData> {
  onOpenTimeline?: () => void;
}

export function AnimationNode({ data, selected, onOpenTimeline }: AnimationNodeProps) {
  const nodeDefinition = getNodeDefinition('animation');
  const category = nodeDefinition?.execution.category;
  const visuals = getNodeCategoryVisuals(category);
  const categoryLabel = getNodeCategoryLabel(category);

  const trackCount = data.tracks?.length ?? 0;
  const uniqueTypes = [...new Set(data.tracks?.map((track) => track.type) ?? [])];

  const handleDoubleClick = () => {
    if (onOpenTimeline) {
      onOpenTimeline();
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const ws = params.get('workspace');
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'timeline');
    url.searchParams.set('node', data.identifier.id);
    if (ws) url.searchParams.set('workspace', ws);
    window.history.pushState({}, '', url.toString());
  };

  const trackColors = transformFactory.getTrackColors?.() ?? {};
  const trackIcons = transformFactory.getTrackIcons?.() ?? {};

  return (
    <NodeCard selected={selected} className="cursor-pointer" onDoubleClick={handleDoubleClick}>
      {nodeDefinition?.ports.inputs.map((port) => (
        <NodePortIndicator
          key={port.id}
          id={port.id}
          side="left"
          type="target"
          top="50%"
          label="Objects to animate"
          description="Connect the elements you want to drive with keyframes."
          handleClassName={visuals.handle}
          accent={category}
        />
      ))}

      <NodeHeader
        icon={<Clapperboard size={14} />}
        title={data.identifier.displayName}
        accentClassName={visuals.iconBg}
        subtitle={categoryLabel}
        meta={<span className="text-xs text-[var(--text-secondary)]">{data.duration}s</span>}
      />

      <div className="space-y-[var(--space-2)] text-xs text-[var(--text-secondary)]">
        <div className="flex items-center justify-between">
          <span>Tracks</span>
          <span className="font-medium text-[var(--text-primary)]">{trackCount}</span>
        </div>
        {trackCount > 0 ? (
          <div className="flex flex-wrap gap-[var(--space-1)]">
            {uniqueTypes.map((type) => (
              <span
                key={type}
                className={`rounded-full px-[var(--space-2)] py-[var(--space-1)] text-[11px] ${trackColors[type] ?? 'bg-[var(--surface-2)]'} text-[var(--text-primary)]`}
              >
                {trackIcons[type] ?? '●'} {type}
              </span>
            ))}
          </div>
        ) : (
          <div className="rounded border border-dashed border-[var(--border-primary)] px-[var(--space-3)] py-[var(--space-2)] text-center text-[11px] text-[var(--text-tertiary)]">
            No keyframes yet—double-click to open the timeline.
          </div>
        )}
        <div className="text-xs text-[var(--text-muted)]">
          Timeline-based animation
        </div>
      </div>

      {nodeDefinition?.ports.outputs.map((port) => (
        <NodePortIndicator
          key={port.id}
          id={port.id}
          side="right"
          type="source"
          top="50%"
          label="Animated objects"
          description="Outputs the objects with their keyframes applied."
          handleClassName={visuals.handle}
          accent={category}
        />
      ))}
    </NodeCard>
  );
}
