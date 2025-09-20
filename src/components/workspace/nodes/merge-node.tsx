'use client';

import { useMemo } from 'react';
import type { NodeProps } from 'reactflow';
import { GitMerge } from 'lucide-react';
import { NodeLayout, type PortConfig } from './components/node-layout';
import type { MergeNodeData } from '@/shared/types/nodes';

export function MergeNode({ data, selected }: NodeProps<MergeNodeData>) {
  const portCount = Math.max(2, data.inputPortCount ?? 2);

  const inputs = useMemo<PortConfig[]>(
    () =>
      Array.from({ length: portCount }, (_, index) => ({
        id: `input${index + 1}`,
        label: index === 0 ? 'Priority stream' : `Stream ${index + 1}`,
        tooltip:
          index === 0
            ? 'First stream wins when objects share an ID'
            : 'Additional stream merged into the priority result',
        handleClassName: 'bg-[var(--node-logic)]',
        badge: String(index + 1),
      })),
    [portCount]
  );

  const outputs = useMemo<PortConfig[]>(
    () => [
      {
        id: 'output',
        label: 'Merged stream',
        tooltip: 'Combined objects with priority conflicts resolved',
        handleClassName: 'bg-[var(--node-logic)]',
      },
    ],
    []
  );

  return (
    <NodeLayout
      selected={selected}
      title={data.identifier.displayName}
      subtitle={`Merge ${portCount} input${portCount === 1 ? '' : 's'}`}
      icon={<GitMerge size={14} />}
      iconClassName="bg-[var(--node-logic)]"
      inputs={inputs}
      outputs={outputs}
    >
      <div className="flex items-center justify-between text-xs">
        <span>Priority</span>
        <span className="font-medium text-[var(--text-primary)]">First connected stream</span>
      </div>
      <div className="text-xs text-[var(--text-secondary)]">
        Later streams fill gaps without overriding existing IDs.
      </div>
    </NodeLayout>
  );
}
