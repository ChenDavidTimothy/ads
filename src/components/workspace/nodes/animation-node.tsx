// src/components/workspace/nodes/animation-node.tsx - Animation timeline node with structured layout
'use client';

import type { NodeProps } from 'reactflow';

import { NodeLayout } from './node-layout';
import { buildPortDisplays } from './port-utils';
import { transformFactory } from '@/shared/registry/transforms';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { AnimationNodeData } from '@/shared/types/nodes';
import { Clapperboard } from 'lucide-react';

interface AnimationNodeProps extends NodeProps<AnimationNodeData> {
  onOpenTimeline?: () => void;
}

export function AnimationNode({ data, selected, onOpenTimeline }: AnimationNodeProps) {
  const nodeDefinition = getNodeDefinition('animation');

  const inputs = buildPortDisplays(nodeDefinition?.ports.inputs, 'input', {
    input: {
      label: 'Objects to animate',
      description: 'Attach text, shapes, or media objects that need animation.',
    },
  });

  const outputs = buildPortDisplays(nodeDefinition?.ports.outputs, 'output', {
    output: {
      label: 'Animated object stream',
      description: 'Delivers animated objects downstream for further styling.',
    },
  });

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

  const trackCount = data.tracks?.length ?? 0;
  const trackTypes = data.tracks?.map((t) => t.type) ?? [];
  const uniqueTypes = [...new Set(trackTypes)];

  const durationLabel = `${data.duration ?? 3}s`;
  return (
    <NodeLayout
      selected={selected}
      className="cursor-pointer transition-colors hover:bg-[var(--surface-interactive)]"
      title={data.identifier.displayName}
      subtitle={trackCount > 0 ? `${trackCount} track${trackCount === 1 ? '' : 's'}` : 'No tracks yet'}
      icon={<Clapperboard className="h-3 w-3" />}
      iconBackgroundClass="bg-[var(--node-animation)] text-[var(--text-primary)]"
      headerAside={<span className="font-medium text-[var(--text-primary)]">{durationLabel}</span>}
      inputs={inputs}
      outputs={outputs}
      accentHandleClass="!bg-[var(--node-animation)]"
      onDoubleClick={handleDoubleClick}
      footer="Double-click to open the Timeline editor"
    >
      <div className="flex items-center justify-between text-xs">
        <span>Total tracks</span>
        <span className="font-medium text-[var(--text-primary)]">{trackCount}</span>
      </div>
      {trackCount > 0 ? (
        <div className="flex flex-wrap gap-1">
          {uniqueTypes.map((type) => (
            <span
              key={type}
              className={`rounded-[var(--radius-sm)] px-[var(--space-2)] py-[var(--space-half)] text-[10px] text-[var(--text-primary)] ${
                transformFactory.getTrackColors()[type] ?? 'bg-[var(--surface-2)]'
              }`}
            >
              {transformFactory.getTrackIcons()[type] ?? '●'} {type}
            </span>
          ))}
        </div>
      ) : (
        <div className="text-xs text-[var(--text-tertiary)]">Timeline is empty</div>
      )}
    </NodeLayout>
  );
}
