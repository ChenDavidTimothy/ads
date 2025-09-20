'use client';

import { useMemo } from 'react';
import type { NodeProps } from 'reactflow';
import { Copy } from 'lucide-react';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import { NodeLayout, type PortConfig } from './components/node-layout';
import type { DuplicateNodeData } from '@/shared/types/nodes';

export function DuplicateNode({ data, selected }: NodeProps<DuplicateNodeData>) {
  const nodeDefinition = getNodeDefinition('duplicate');

  const inputs = useMemo<PortConfig[]>(() => {
    const definitions = nodeDefinition?.ports.inputs ?? [];
    if (definitions.length === 0) {
      return [
        {
          id: 'input',
          label: 'Item to duplicate',
          tooltip: 'Incoming data that should be cloned',
          handleClassName: 'bg-[var(--node-logic)]',
        },
      ];
    }

    return definitions.map((port) => ({
      id: port.id,
      label: 'Item to duplicate',
      tooltip: 'Incoming data that should be cloned',
      handleClassName: 'bg-[var(--node-logic)]',
    }));
  }, [nodeDefinition]);

  const outputs = useMemo<PortConfig[]>(() => {
    const definitions = nodeDefinition?.ports.outputs ?? [];
    if (definitions.length === 0) {
      return [
        {
          id: 'output',
          label: 'Duplicated stream',
          tooltip: 'Emits the original plus duplicates',
          handleClassName: 'bg-[var(--node-logic)]',
        },
      ];
    }

    return definitions.map((port) => ({
      id: port.id,
      label: 'Duplicated stream',
      tooltip: 'Emits the original plus duplicates',
      handleClassName: 'bg-[var(--node-logic)]',
    }));
  }, [nodeDefinition]);

  const duplicates = Math.max(1, data.count ?? 1);
  const additional = Math.max(0, duplicates - 1);

  return (
    <NodeLayout
      selected={selected}
      title={data.identifier.displayName}
      subtitle={`Create ${duplicates} copy${duplicates === 1 ? '' : 'ies'}`}
      icon={<Copy size={14} />}
      iconClassName="bg-[var(--node-logic)]"
      inputs={inputs}
      outputs={outputs}
    >
      {additional === 0 ? (
        <div className="text-xs text-[var(--text-secondary)]">
          Pass-through when count equals 1.
        </div>
      ) : (
        <div className="text-xs text-[var(--text-secondary)]">
          Produces <span className="font-medium text-[var(--text-primary)]">{additional}</span>{' '}
          duplicate
          {additional === 1 ? '' : 's'} for each input item.
        </div>
      )}
    </NodeLayout>
  );
}
