// src/components/workspace/nodes/circle-node.tsx - Geometry circle node with structured layout
'use client';

import type { NodeProps } from 'reactflow';

import { NodeLayout } from './node-layout';
import { buildPortDisplays } from './port-utils';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { CircleNodeData } from '@/shared/types/nodes';
import { Circle as CircleIcon } from 'lucide-react';

export function CircleNode({ data, selected }: NodeProps<CircleNodeData>) {
  const nodeDefinition = getNodeDefinition('circle');
  const outputs = buildPortDisplays(nodeDefinition?.ports.outputs, 'output', {
    output: {
      label: 'Circle shape for composition',
      description: 'Emits a circle geometry you can animate, style, or merge with other shapes.',
    },
  });

  const radius = data.radius ?? 50;
  const subtitle = `Radius ${radius}px`;

  return (
    <NodeLayout
      selected={selected}
      title={data.identifier.displayName}
      subtitle={subtitle}
      icon={<CircleIcon className="h-3 w-3" />}
      iconBackgroundClass="bg-[var(--node-geometry)] text-[var(--text-primary)]"
      inputs={[]}
      outputs={outputs}
      accentHandleClass="!bg-[var(--node-geometry)]"
    >
      <div className="flex items-center justify-between text-xs">
        <span>Fill</span>
        <span className="font-medium text-[var(--text-primary)]">Workspace accent</span>
      </div>
    </NodeLayout>
  );
}
