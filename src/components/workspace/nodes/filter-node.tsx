'use client';

import { useMemo } from 'react';
import type { NodeProps } from 'reactflow';
import { Filter } from 'lucide-react';
import { NodeLayout, type PortConfig } from './components/node-layout';
import type { FilterNodeData } from '@/shared/types/nodes';

export function FilterNode({ data, selected }: NodeProps<FilterNodeData>) {
  const selectedCount = data.selectedObjectIds?.length ?? 0;

  const inputs = useMemo<PortConfig[]>(
    () => [
      {
        id: 'input',
        label: 'Objects to filter',
        tooltip: 'Incoming object stream before filtering',
        handleClassName: 'bg-[var(--node-logic)]',
      },
    ],
    []
  );

  const outputs = useMemo<PortConfig[]>(
    () => [
      {
        id: 'output',
        label: 'Filtered objects',
        tooltip: 'Only the selected objects continue downstream',
        handleClassName: 'bg-[var(--node-logic)]',
      },
    ],
    []
  );

  return (
    <NodeLayout
      selected={selected}
      title={data.identifier.displayName}
      subtitle="Pass through selected objects"
      icon={<Filter size={14} />}
      iconClassName="bg-[var(--node-logic)]"
      inputs={inputs}
      outputs={outputs}
    >
      {selectedCount > 0 ? (
        <div className="flex items-center justify-between text-xs">
          <span>Selected objects</span>
          <span className="font-medium text-[var(--text-primary)]">{selectedCount}</span>
        </div>
      ) : (
        <div className="text-xs text-[var(--text-secondary)]">No filters applied</div>
      )}
    </NodeLayout>
  );
}
