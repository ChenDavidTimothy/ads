'use client';

import { useMemo, useState } from 'react';
import type { NodeProps } from 'reactflow';
import { Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NodeLayout, type PortConfig } from './components/node-layout';
import type { ResultNodeData } from '@/shared/types/nodes';
import { useDebugContext } from '../flow/debug-context';
import { logger } from '@/lib/logger';

interface ResultNodeProps extends NodeProps<ResultNodeData> {
  onOpenLogViewer?: (nodeId: string) => void;
}

export function ResultNode({ data, selected, onOpenLogViewer }: ResultNodeProps) {
  const [isRunning, setIsRunning] = useState(false);
  const debugContext = useDebugContext();
  const onRunToHere = debugContext?.runToNode;

  const inputs = useMemo<PortConfig[]>(
    () => [
      {
        id: 'input',
        label: 'Flow to inspect',
        tooltip: 'Data stream being observed by this result node',
        handleClassName: 'bg-[var(--node-output)]',
      },
    ],
    []
  );

  const outputs = useMemo<PortConfig[]>(
    () => [
      {
        id: 'output',
        label: 'Last value',
        tooltip: 'Outputs the most recent value captured here',
        handleClassName: 'bg-[var(--node-output)]',
      },
    ],
    []
  );

  const handleRunToHere = async () => {
    if (!onRunToHere) return;

    setIsRunning(true);
    try {
      await onRunToHere(data.identifier.id);
    } catch (error) {
      logger.errorWithStack('Result node run to here failed', error);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <NodeLayout
      selected={selected}
      title={data.identifier.displayName}
      subtitle={data.label || 'Inspect downstream results'}
      icon={<Target size={14} />}
      iconClassName="bg-[var(--node-output)]"
      inputs={inputs}
      outputs={outputs}
      onDoubleClick={() => onOpenLogViewer?.(data.identifier.id)}
      className="cursor-pointer"
    >
      <Button
        onClick={handleRunToHere}
        disabled={isRunning || !onRunToHere}
        variant="primary"
        size="sm"
        className="w-full"
      >
        {isRunning ? 'Running…' : 'Run to here'}
      </Button>
      {data.lastValueType ? (
        <div className="text-xs text-[var(--text-secondary)]">
          Last value type:{' '}
          <span className="font-medium text-[var(--text-primary)]">{data.lastValueType}</span>
        </div>
      ) : null}
    </NodeLayout>
  );
}
