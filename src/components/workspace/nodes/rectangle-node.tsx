'use client';

import { useMemo } from 'react';
import type { NodeProps } from 'reactflow';
import { Square as SquareIcon } from 'lucide-react';
import { NodeLayout, type PortConfig } from './components/node-layout';
import type { RectangleNodeData } from '@/shared/types/nodes';

export function RectangleNode({ data, selected }: NodeProps<RectangleNodeData>) {
  const outputs = useMemo<PortConfig[]>(
    () => [
      {
        id: 'output',
        label: 'Rectangle object',
        tooltip: 'Provides the generated rectangle geometry',
        handleClassName: 'bg-[var(--node-geometry)]',
      },
    ],
    []
  );

  return (
    <NodeLayout
      selected={selected}
      title={data.identifier.displayName}
      subtitle="Rectangle geometry"
      icon={<SquareIcon size={14} />}
      iconClassName="bg-[var(--node-geometry)]"
      inputs={[]}
      outputs={outputs}
    >
      <div className="flex items-center justify-between">
        <span>Size</span>
        <span className="font-medium text-[var(--text-primary)]">
          {data.width} × {data.height}px
        </span>
      </div>
    </NodeLayout>
  );
}
