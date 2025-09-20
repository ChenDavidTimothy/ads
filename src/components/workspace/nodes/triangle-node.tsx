// src/components/workspace/nodes/triangle-node.tsx - Geometry triangle node with visual port layout
'use client';

import type { NodeProps } from 'reactflow';

import { NodeLayout } from './node-layout';
import { buildPortDisplays } from './port-utils';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { TriangleNodeData } from '@/shared/types/nodes';
import { Triangle as TriangleIcon } from 'lucide-react';

export function TriangleNode({ data, selected }: NodeProps<TriangleNodeData>) {
  const nodeDefinition = getNodeDefinition('triangle');
  const outputs = buildPortDisplays(nodeDefinition?.ports.outputs, 'output', {
    output: {
      label: 'Triangle shape for downstream styling',
      description: 'Provides the triangle geometry to layer, animate, or style in canvas nodes.',
    },
  });

  const size = data.size ?? 80;
  const subtitle = `Edge length ${size}px`;

  return (
    <NodeLayout
      selected={selected}
      title={data.identifier.displayName}
      subtitle={subtitle}
      icon={<TriangleIcon className="h-3 w-3" />}
      iconBackgroundClass="bg-[var(--node-geometry)] text-[var(--text-primary)]"
      inputs={[]}
      outputs={outputs}
      accentHandleClass="!bg-[var(--node-geometry)]"
    >
      <div className="flex items-center justify-between text-xs">
        <span>Default fill</span>
        <span className="font-medium text-[var(--text-primary)]">Workspace accent</span>
      </div>
    </NodeLayout>
  );
}
