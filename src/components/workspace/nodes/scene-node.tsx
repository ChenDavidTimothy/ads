'use client';

import { useMemo } from 'react';
import type { NodeProps } from 'reactflow';
import { MonitorPlay } from 'lucide-react';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import { NodeLayout, type PortConfig } from './components/node-layout';
import type { SceneNodeData } from '@/shared/types/nodes';

function formatResolution(width: number, height: number) {
  if (width === 1920 && height === 1080) return 'FHD';
  if (width === 1280 && height === 720) return 'HD';
  if (width === 3840 && height === 2160) return '4K';
  if (width === 1080 && height === 1080) return 'Square';
  return 'Custom';
}

export function SceneNode({ data, selected }: NodeProps<SceneNodeData>) {
  const nodeDefinition = getNodeDefinition('scene');

  const inputs = useMemo<PortConfig[]>(() => {
    const definitions = nodeDefinition?.ports.inputs ?? [];
    if (definitions.length === 0) {
      return [
        {
          id: 'input',
          label: 'Scene assets',
          tooltip: 'Objects and tracks entering the scene',
          handleClassName: 'bg-[var(--node-output)]',
        },
      ];
    }

    return definitions.map((port) => ({
      id: port.id,
      label: 'Scene assets',
      tooltip: 'Objects and tracks entering the scene',
      handleClassName: 'bg-[var(--node-output)]',
    }));
  }, [nodeDefinition]);

  const outputs = useMemo<PortConfig[]>(() => {
    const definitions = nodeDefinition?.ports.outputs ?? [];
    if (definitions.length === 0) {
      return [
        {
          id: 'output',
          label: 'Scene timeline',
          tooltip: 'Emits the configured scene for downstream nodes',
          handleClassName: 'bg-[var(--node-output)]',
        },
      ];
    }

    return definitions.map((port) => ({
      id: port.id,
      label: 'Scene timeline',
      tooltip: 'Emits the configured scene for downstream nodes',
      handleClassName: 'bg-[var(--node-output)]',
    }));
  }, [nodeDefinition]);

  const fpsSummary = `${data.fps} fps`;

  return (
    <NodeLayout
      selected={selected}
      title={data.identifier.displayName}
      subtitle={`${formatResolution(data.width, data.height)} • ${fpsSummary}`}
      icon={<MonitorPlay size={14} />}
      iconClassName="bg-[var(--node-output)]"
      inputs={inputs}
      outputs={outputs}
      measureDeps={[data.width, data.height, data.fps, data.duration, data.backgroundColor]}
    >
      <div className="flex items-center justify-between text-xs">
        <span>Duration</span>
        <span className="font-medium text-[var(--text-primary)]">{data.duration}s</span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span>Background</span>
        <span className="flex items-center gap-[var(--space-1)]">
          <span
            className="h-3 w-3 rounded border border-[var(--border-primary)]"
            style={{ backgroundColor: data.backgroundColor }}
          />
          <span className="font-mono text-[var(--text-primary)]">{data.backgroundColor.toUpperCase()}</span>
        </span>
      </div>
      <div className="text-xs text-[var(--text-secondary)]">
        Quality preset: <span className="font-medium text-[var(--text-primary)]">{data.videoPreset}</span>
      </div>
    </NodeLayout>
  );
}
