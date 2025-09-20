'use client';

import { useMemo } from 'react';
import type { NodeProps } from 'reactflow';
import { Triangle as TriangleIcon } from 'lucide-react';
import { NodeLayout, type PortConfig } from './components/node-layout';
import type { TriangleNodeData } from '@/shared/types/nodes';

export function TriangleNode({ data, selected }: NodeProps<TriangleNodeData>) {
  const outputs = useMemo<PortConfig[]>(
    () => [
      {
        id: 'output',
        label: 'Triangle object',
        tooltip: 'Provides the generated triangle geometry',
        handleClassName: 'bg-[var(--node-geometry)]',
      },
    ],
    []
  );

  return (
    <NodeLayout
      selected={selected}
      title={data.identifier.displayName}
      subtitle="Basic triangle geometry"
      icon={<TriangleIcon size={14} />}
      iconClassName="bg-[var(--node-geometry)]"
      inputs={[]}
      outputs={outputs}
    >
      <div className="flex items-center justify-between">
        <span>Edge length</span>
        <span className="font-medium text-[var(--text-primary)]">{data.size}px</span>
      </div>
    </NodeLayout>
  );
}
