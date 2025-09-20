// src/components/workspace/nodes/if-else-node.tsx - If/Else logic node with structured layout
'use client';

import type { NodeProps } from 'reactflow';

import { NodeLayout, type NodePortDisplay } from './node-layout';
import type { IfElseNodeData } from '@/shared/types/nodes';
import { GitBranch } from 'lucide-react';

export function IfElseNode({ data, selected }: NodeProps<IfElseNodeData>) {
  const inputs: NodePortDisplay[] = [
    {
      id: 'condition',
      label: 'Condition to evaluate',
      description: 'Boolean input that decides the route.',
    },
    {
      id: 'data',
      label: 'Data to route',
      description: 'Payload passed to the true or false path.',
    },
  ];

  const outputs: NodePortDisplay[] = [
    {
      id: 'true_path',
      label: 'When condition is true',
      badge: 'True',
      badgeTone: 'success',
      handleClassName: '!bg-[var(--success-500)]',
    },
    {
      id: 'false_path',
      label: 'When condition is false',
      badge: 'False',
      badgeTone: 'danger',
      handleClassName: '!bg-[var(--danger-500)]',
    },
  ];

  return (
    <NodeLayout
      selected={selected}
      title={data.identifier.displayName}
      subtitle="Routes data based on a boolean condition"
      icon={<GitBranch className="h-3 w-3" />}
      iconBackgroundClass="bg-[var(--node-logic)] text-[var(--text-primary)]"
      inputs={inputs}
      outputs={outputs}
      accentHandleClass="!bg-[var(--node-logic)]"
    >
      <div className="rounded border border-[var(--border-primary)] bg-[var(--surface-2)] p-2 text-center text-xs text-[var(--text-secondary)]">
        Condition → True path, else → False path
      </div>
    </NodeLayout>
  );
}
