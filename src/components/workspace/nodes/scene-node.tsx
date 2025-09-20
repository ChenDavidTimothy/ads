// src/components/workspace/nodes/scene-node.tsx - Scene output configuration with structured layout
'use client';

import type { NodeProps } from 'reactflow';

import { NodeLayout } from './node-layout';
import { buildPortDisplays } from './port-utils';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { SceneNodeData } from '@/shared/types/nodes';
import { MonitorPlay } from 'lucide-react';

export function SceneNode({ data, selected }: NodeProps<SceneNodeData>) {
  const nodeDefinition = getNodeDefinition('scene');

  const inputs = buildPortDisplays(nodeDefinition?.ports.inputs, 'input', {
    input: {
      label: 'Final scene stream',
      description: 'Connect your composed scene or animation before rendering.',
    },
  });

  const getResolutionLabel = (width: number, height: number) => {
    if (width === 1920 && height === 1080) return 'FHD';
    if (width === 1280 && height === 720) return 'HD';
    if (width === 3840 && height === 2160) return '4K';
    if (width === 1080 && height === 1080) return 'Square';
    return 'Custom';
  };

  const width = data.width;
  const height = data.height;
  const fps = data.fps;
  const duration = data.duration;
  const subtitle = `${width}×${height} • ${fps} FPS • ${duration}s`;

  const qualityLabel = (crf: number) => {
    if (crf <= 18) return 'High';
    if (crf <= 28) return 'Medium';
    return 'Low';
  };

  return (
    <NodeLayout
      selected={selected}
      title={data.identifier.displayName}
      subtitle={subtitle}
      icon={<MonitorPlay className="h-3 w-3" />}
      iconBackgroundClass="bg-[var(--node-output)] text-[var(--text-primary)]"
      inputs={inputs}
      outputs={[]}
      accentHandleClass="!bg-[var(--node-output)]"
      footer="Defines the final video output"
    >
      <div className="flex items-center justify-between text-xs">
        <span>Resolution</span>
        <span className="font-medium text-[var(--text-primary)]">
          {getResolutionLabel(width, height)} ({width}×{height})
        </span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span>Background</span>
        <div className="flex items-center gap-[var(--space-2)]">
          <div
            className="h-4 w-4 rounded border border-[var(--border-primary)]"
            style={{ backgroundColor: data.backgroundColor }}
          />
          <span className="font-medium text-[var(--text-primary)]">{data.backgroundColor.toUpperCase()}</span>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span>Encoding</span>
        <span className="font-medium text-[var(--text-primary)]">
          {qualityLabel(data.videoCrf)} • {data.videoPreset}
        </span>
      </div>
    </NodeLayout>
  );
}
