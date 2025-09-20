'use client';

import { useMemo } from 'react';
import type { NodeProps } from 'reactflow';
import { Clapperboard } from 'lucide-react';
import { transformFactory } from '@/shared/registry/transforms';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import { NodeLayout, type PortConfig } from './components/node-layout';
import type { AnimationNodeData } from '@/shared/types/nodes';

interface AnimationNodeProps extends NodeProps<AnimationNodeData> {
  onOpenTimeline?: () => void;
}

export function AnimationNode({ data, selected, onOpenTimeline }: AnimationNodeProps) {
  const nodeDefinition = getNodeDefinition('animation');

  const inputs = useMemo<PortConfig[]>(() => {
    const definitions = nodeDefinition?.ports.inputs ?? [];
    if (definitions.length === 0) {
      return [
        {
          id: 'input',
          label: 'Objects to animate',
          tooltip: 'Incoming objects that will be animated over time',
          handleClassName: 'bg-[var(--node-animation)]',
        },
      ];
    }

    return definitions.map((port, index) => ({
      id: port.id,
      label: index === 0 ? 'Objects to animate' : port.label,
      tooltip: 'Incoming objects that will be animated over time',
      handleClassName: 'bg-[var(--node-animation)]',
    }));
  }, [nodeDefinition]);

  const outputs = useMemo<PortConfig[]>(() => {
    const definitions = nodeDefinition?.ports.outputs ?? [];
    if (definitions.length === 0) {
      return [
        {
          id: 'output',
          label: 'Animated objects',
          tooltip: 'Emits objects with keyframed animations applied',
          handleClassName: 'bg-[var(--node-animation)]',
        },
      ];
    }

    return definitions.map((port) => ({
      id: port.id,
      label: 'Animated objects',
      tooltip: 'Emits objects with keyframed animations applied',
      handleClassName: 'bg-[var(--node-animation)]',
    }));
  }, [nodeDefinition]);

  const trackCount = data.tracks?.length ?? 0;
  const uniqueTypes = useMemo(
    () => Array.from(new Set((data.tracks ?? []).map((track) => track.type))),
    [data.tracks],
  );

  const trackColors = transformFactory.getTrackColors();
  const trackIcons = transformFactory.getTrackIcons();

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

  return (
    <NodeLayout
      selected={selected}
      title={data.identifier.displayName}
      subtitle={`Duration ${data.duration}s`}
      icon={<Clapperboard size={14} />}
      iconClassName="bg-[var(--node-animation)]"
      inputs={inputs}
      outputs={outputs}
      onDoubleClick={handleDoubleClick}
      measureDeps={[trackCount, uniqueTypes.join(','), data.duration]}
      className="cursor-pointer"
    >
      <div className="flex items-center justify-between text-xs">
        <span>Tracks</span>
        <span className="font-medium text-[var(--text-primary)]">{trackCount}</span>
      </div>
      {trackCount > 0 ? (
        <div className="flex flex-wrap gap-[var(--space-1)] text-[10px] text-[var(--text-primary)]">
          {uniqueTypes.map((type) => (
            <span
              key={type}
              className={`rounded-[var(--radius-sm)] px-[var(--space-2)] py-[2px] ${
                trackColors[type] ?? 'bg-[var(--surface-2)]'
              }`}
            >
              {trackIcons[type] ?? '●'} {type}
            </span>
          ))}
        </div>
      ) : (
        <div className="text-xs text-[var(--text-secondary)]">No tracks configured yet</div>
      )}
    </NodeLayout>
  );
}
