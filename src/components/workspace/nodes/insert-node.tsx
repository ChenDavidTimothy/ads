'use client';

import { useMemo, useState } from 'react';
import type { NodeProps } from 'reactflow';
import { Clock3 } from 'lucide-react';
import { NodeLayout, type PortConfig } from './components/node-layout';
import { InsertModal } from './InsertModal';
import type { InsertNodeData } from '@/shared/types/nodes';

export function InsertNode({ data, selected }: NodeProps<InsertNodeData>) {
  const [open, setOpen] = useState(false);

  const inputs = useMemo<PortConfig[]>(
    () => [
      {
        id: 'input',
        label: 'Object to schedule',
        tooltip: 'Receives the object stream that should be timed',
        handleClassName: 'bg-[var(--node-data)]',
      },
    ],
    []
  );

  const outputs = useMemo<PortConfig[]>(
    () => [
      {
        id: 'output',
        label: 'Timed object stream',
        tooltip: 'Emits objects with the configured appearance time',
        handleClassName: 'bg-[var(--node-data)]',
      },
    ],
    []
  );

  const customAssignments = Object.keys(data.appearanceTimeByObject ?? {}).length;

  return (
    <>
      <NodeLayout
        selected={selected}
        title={data.identifier.displayName}
        subtitle={`Starts at ${data.appearanceTime}s`}
        icon={<Clock3 size={14} />}
        iconClassName="bg-[var(--node-data)]"
        inputs={inputs}
        outputs={outputs}
        onDoubleClick={() => setOpen(true)}
        footer="Double-click to edit individual timings"
        className="cursor-pointer"
      >
        {customAssignments > 0 ? (
          <div className="flex items-center justify-between">
            <span>Custom overrides</span>
            <span className="font-medium text-[var(--text-primary)]">{customAssignments}</span>
          </div>
        ) : (
          <div className="text-[var(--text-secondary)]">Uses the default time for all objects</div>
        )}
      </NodeLayout>

      {open ? (
        <InsertModal isOpen={open} onClose={() => setOpen(false)} nodeId={data.identifier.id} />
      ) : null}
    </>
  );
}
