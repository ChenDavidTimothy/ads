'use client';

import type { NodeProps } from 'reactflow';

import { NodeLayout } from './node-layout';
import { buildPortDisplays } from './port-utils';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { FrameNodeData } from '@/shared/types/nodes';
import { Image as ImageIcon } from 'lucide-react';

export function FrameNode({ data, selected }: NodeProps<FrameNodeData>) {
  const nodeDefinition = getNodeDefinition('frame');

  const inputs = buildPortDisplays(nodeDefinition?.ports.inputs, 'input', {
    input: {
      label: 'Scene to capture',
      description: 'Connect the scene or composition that should render as an image.',
    },
  });

  const getResolutionLabel = (width: number, height: number) => {
    if (width === 1920 && height === 1080) return 'FHD';
    if (width === 1280 && height === 720) return 'HD';
    if (width === 3840 && height === 2160) return '4K';
    if (width === 1080 && height === 1080) return 'Square';
    return 'Custom';
  };

  const width = data.width ?? 1920;
  const height = data.height ?? 1080;
  const format = data.format ?? 'png';
  const subtitle = `${width}×${height} • ${getResolutionLabel(width, height)}`;

  return (
    <NodeLayout
      selected={selected}
      title={data.identifier.displayName}
      subtitle={subtitle}
      icon={<ImageIcon className="h-3 w-3" />}
      iconBackgroundClass="bg-[var(--node-output)] text-[var(--text-primary)]"
      inputs={inputs}
      outputs={[]}
      accentHandleClass="!bg-[var(--node-output)]"
      footer="Outputs the final image file"
    >
      <div className="flex items-center justify-between text-xs">
        <span>Background</span>
        <div className="flex items-center gap-[var(--space-2)]">
          <div
            className="h-4 w-4 rounded border border-[var(--border-primary)]"
            style={{ backgroundColor: data.backgroundColor || '#000000' }}
          />
          <span className="font-medium text-[var(--text-primary)]">
            {(data.backgroundColor ?? '#000000').toUpperCase()}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span>Format</span>
        <span className="font-medium uppercase text-[var(--text-primary)]">{format}</span>
      </div>
      {format === 'jpeg' ? (
        <div className="flex items-center justify-between text-xs">
          <span>Quality</span>
          <span className="font-medium text-[var(--text-primary)]">{data.quality ?? 90}</span>
        </div>
      ) : null}
    </NodeLayout>
  );
}
