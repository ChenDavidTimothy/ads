'use client';

import { useMemo } from 'react';
import type { NodeProps } from 'reactflow';
import { Image as ImageIcon } from 'lucide-react';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import { NodeLayout, type PortConfig } from './components/node-layout';
import type { FrameNodeData } from '@/shared/types/nodes';

function formatResolution(width: number, height: number) {
  if (width === 1920 && height === 1080) return 'FHD';
  if (width === 1280 && height === 720) return 'HD';
  if (width === 3840 && height === 2160) return '4K';
  if (width === 1080 && height === 1080) return 'Square';
  return 'Custom';
}

export function FrameNode({ data, selected }: NodeProps<FrameNodeData>) {
  const nodeDefinition = getNodeDefinition('frame');

  const inputs = useMemo<PortConfig[]>(() => {
    const definitions = nodeDefinition?.ports.inputs ?? [];
    if (definitions.length === 0) {
      return [
        {
          id: 'input',
          label: 'Image source',
          tooltip: 'Incoming frame content to export',
          handleClassName: 'bg-[var(--node-output)]',
        },
      ];
    }

    return definitions.map((port) => ({
      id: port.id,
      label: 'Image source',
      tooltip: 'Incoming frame content to export',
      handleClassName: 'bg-[var(--node-output)]',
    }));
  }, [nodeDefinition]);

  const outputs = useMemo<PortConfig[]>(() => {
    const definitions = nodeDefinition?.ports.outputs ?? [];
    if (definitions.length === 0) {
      return [
        {
          id: 'output',
          label: 'Frame output',
          tooltip: 'Emits rendered frames for downstream nodes',
          handleClassName: 'bg-[var(--node-output)]',
        },
      ];
    }

    return definitions.map((port) => ({
      id: port.id,
      label: 'Frame output',
      tooltip: 'Emits rendered frames for downstream nodes',
      handleClassName: 'bg-[var(--node-output)]',
    }));
  }, [nodeDefinition]);

  const width = data.width ?? 1920;
  const height = data.height ?? 1080;
  const resolutionSummary = `${width}×${height}`;
  const backgroundColor = data.backgroundColor ?? '#000000';
  const format = (data.format ?? 'png').toUpperCase();

  return (
    <NodeLayout
      selected={selected}
      title={data.identifier.displayName}
      subtitle={`${formatResolution(width, height)} • ${resolutionSummary}`}
      icon={<ImageIcon size={14} />}
      iconClassName="bg-[var(--node-output)]"
      inputs={inputs}
      outputs={outputs}
      measureDeps={[width, height, backgroundColor, format, data.quality ?? '']}
    >
      <div className="flex items-center justify-between text-xs">
        <span>Background</span>
        <span className="flex items-center gap-[var(--space-1)]">
          <span className="h-3 w-3 rounded border border-[var(--border-primary)]" style={{ backgroundColor }} />
          <span className="font-mono text-[var(--text-primary)]">{backgroundColor.toUpperCase()}</span>
        </span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span>Format</span>
        <span className="font-medium text-[var(--text-primary)]">{format}</span>
      </div>
      {format === 'JPEG' ? (
        <div className="flex items-center justify-between text-xs">
          <span>Quality</span>
          <span className="font-medium text-[var(--text-primary)]">{data.quality ?? 90}</span>
        </div>
      ) : null}
    </NodeLayout>
  );
}
