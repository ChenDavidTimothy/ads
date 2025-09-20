// src/components/workspace/nodes/result-node.tsx - Debug result node with structured layout
'use client';

import { useState } from 'react';
import type { NodeProps } from 'reactflow';

import { NodeLayout } from './node-layout';
import { buildPortDisplays } from './port-utils';
import { Button } from '@/components/ui/button';
import { useDebugContext } from '../flow/debug-context';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { ResultNodeData } from '@/shared/types/nodes';
import { logger } from '@/lib/logger';
import { Target } from 'lucide-react';

interface ResultNodeProps extends NodeProps<ResultNodeData> {
  onOpenLogViewer?: (nodeId: string) => void;
}

export function ResultNode({ data, selected, onOpenLogViewer }: ResultNodeProps) {
  const nodeDefinition = getNodeDefinition('result');
  const [isRunning, setIsRunning] = useState(false);
  const debugContext = useDebugContext();
  const onRunToHere = debugContext?.runToNode;

  const inputs = buildPortDisplays(nodeDefinition?.ports.inputs, 'input', {
    input: {
      label: 'Value to inspect',
      description: 'Attach any data stream you want to preview or debug.',
    },
  });

  const outputs = buildPortDisplays(nodeDefinition?.ports.outputs, 'output', {
    output: {
      label: 'Forwarded debug value',
      description: 'Outputs the same value so the flow continues after inspection.',
    },
  });

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

  const handleDoubleClick = () => {
    if (onOpenLogViewer) {
      onOpenLogViewer(data.identifier.id);
    }
  };

  return (
    <NodeLayout
      selected={selected}
      className="cursor-pointer transition-colors hover:bg-[var(--surface-interactive)]"
      title={data.identifier.displayName}
      subtitle="Inspect values while keeping the flow running"
      icon={<Target className="h-3 w-3" />}
      iconBackgroundClass="bg-[var(--node-output)] text-[var(--text-primary)]"
      inputs={inputs}
      outputs={outputs}
      accentHandleClass="!bg-[var(--node-output)]"
      onDoubleClick={handleDoubleClick}
      footer="Double-click to open the debug log viewer"
    >
      <Button
        onClick={handleRunToHere}
        disabled={isRunning || !onRunToHere}
        variant="primary"
        size="sm"
        className="w-full"
      >
        {isRunning ? 'Running…' : 'Run to Here'}
      </Button>
    </NodeLayout>
  );
}
