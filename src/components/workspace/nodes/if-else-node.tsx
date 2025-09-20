'use client';

import { useMemo } from 'react';
import type { NodeProps } from 'reactflow';
import { GitBranch } from 'lucide-react';
import { NodeLayout, type PortConfig } from './components/node-layout';
import type { IfElseNodeData } from '@/shared/types/nodes';

export function IfElseNode({ data, selected }: NodeProps<IfElseNodeData>) {
  const inputs = useMemo<PortConfig[]>(
    () => [
      {
        id: 'condition',
        label: 'Condition flag',
        tooltip: 'Boolean value that decides the route',
        handleClassName: 'bg-[var(--node-logic)]',
      },
      {
        id: 'data',
        label: 'Data to route',
        tooltip: 'Payload that will be sent to the true or false path',
        handleClassName: 'bg-[var(--node-logic)]',
      },
    ],
    []
  );

  const outputs = useMemo<PortConfig[]>(
    () => [
      {
        id: 'true_path',
        label: 'When true',
        tooltip: 'Data forwarded when the condition is true',
        handleClassName: 'bg-[var(--success-500)]',
        badge: 'T',
      },
      {
        id: 'false_path',
        label: 'When false',
        tooltip: 'Data forwarded when the condition is false',
        handleClassName: 'bg-[var(--danger-500)]',
        badge: 'F',
      },
    ],
    []
  );

  return (
    <NodeLayout
      selected={selected}
      title={data.identifier.displayName}
      subtitle="Route data based on the condition"
      icon={<GitBranch size={14} />}
      iconClassName="bg-[var(--node-logic)]"
      inputs={inputs}
      outputs={outputs}
    >
      <div className="rounded border border-[var(--border-primary)] bg-[var(--surface-2)] p-[var(--space-2)] text-center text-xs text-[var(--text-secondary)]">
        Sends the payload to the matching path without modifying it.
      </div>
    </NodeLayout>
  );
}
