'use client';

import { useMemo } from 'react';
import type { NodeProps } from 'reactflow';
import { Circle as CircleIcon } from 'lucide-react';
import { NodeLayout, type PortConfig } from './components/node-layout';
import type { CircleNodeData } from '@/shared/types/nodes';

export function CircleNode({ data, selected }: NodeProps<CircleNodeData>) {
  const outputs = useMemo<PortConfig[]>(
    () => [
      {
        id: 'output',
        label: 'Circle object',
        tooltip: 'Provides the generated circle geometry',
        handleClassName: 'bg-[var(--node-geometry)]',
      },
    ],
    [],
  );

  return (
    <NodeLayout
      selected={selected}
      title={data.identifier.displayName}
      subtitle="Perfect circle geometry"
      icon={<CircleIcon size={14} />}
      iconClassName="bg-[var(--node-geometry)]"
      inputs={[]}
      outputs={outputs}
      measureDeps={[data.radius]}
    >
      <div className="flex items-center justify-between">
        <span>Radius</span>
        <span className="font-medium text-[var(--text-primary)]">{data.radius}px</span>
      </div>
    </NodeLayout>
  );
}
