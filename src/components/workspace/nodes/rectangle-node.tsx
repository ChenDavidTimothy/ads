// src/components/workspace/nodes/rectangle-node.tsx - Geometry rectangle node with structured layout
'use client';

import type { NodeProps } from 'reactflow';

import { NodeLayout } from './node-layout';
import { buildPortDisplays } from './port-utils';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { RectangleNodeData } from '@/shared/types/nodes';
import { Square as SquareIcon } from 'lucide-react';

export function RectangleNode({ data, selected }: NodeProps<RectangleNodeData>) {
  const nodeDefinition = getNodeDefinition('rectangle');
  const outputs = buildPortDisplays(nodeDefinition?.ports.outputs, 'output', {
    output: {
      label: 'Rectangle shape for layout',
      description: 'Supplies a rectangle geometry to feed into canvas or animation nodes.',
    },
  });

  const width = data.width ?? 100;
  const height = data.height ?? 60;
  const subtitle = `${width}px × ${height}px`;

  return (
    <NodeLayout
      selected={selected}
      title={data.identifier.displayName}
      subtitle={subtitle}
      icon={<SquareIcon className="h-3 w-3" />}
      iconBackgroundClass="bg-[var(--node-geometry)] text-[var(--text-primary)]"
      inputs={[]}
      outputs={outputs}
      accentHandleClass="!bg-[var(--node-geometry)]"
    >
      <div className="flex items-center justify-between text-xs">
        <span>Rounded corners</span>
        <span className="font-medium text-[var(--text-primary)]">Use canvas styles</span>
      </div>
    </NodeLayout>
  );
}
