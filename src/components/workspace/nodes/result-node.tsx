// src/components/workspace/nodes/result-node.tsx - Production-ready debug node with modal viewer
'use client';

import { useState } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { ResultNodeData } from '@/shared/types/nodes';
import { useDebugContext } from '../flow/debug-context';
import { logger } from '@/lib/logger';
import { Target } from 'lucide-react';

interface ResultNodeProps extends NodeProps<ResultNodeData> {
  onOpenLogViewer?: (nodeId: string) => void;
}

export function ResultNode({ data, selected, onOpenLogViewer }: ResultNodeProps) {
  const nodeDefinition = getNodeDefinition('result');
  const [isRunning, setIsRunning] = useState(false);

  // Use debug context if available
  const debugContext = useDebugContext();
  const onRunToHere = debugContext?.runToNode;

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

  const handleClass = 'bg-[var(--node-output)]';

  return (
    <Card
      selected={selected}
      className="min-w-[var(--node-min-width)] cursor-pointer p-[var(--card-padding)] transition-all hover:bg-[var(--surface-interactive)]"
      onDoubleClick={handleDoubleClick}
    >
      {/* Single input port */}
      {nodeDefinition?.ports.inputs.map((port) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          className={`h-3 w-3 ${handleClass} !border-2 !border-[var(--text-primary)]`}
          style={{ top: `35%` }}
        />
      ))}
      {/* New output port to expose variable value */}
      {nodeDefinition?.ports.outputs.map((port) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          className={`h-3 w-3 ${handleClass} !border-2 !border-[var(--text-primary)]`}
          style={{ top: `35%` }}
        />
      ))}

      <CardHeader className="p-0 pb-[var(--space-3)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-[var(--node-output)] text-[var(--text-primary)]">
            <Target size={12} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold text-[var(--text-primary)]">
              {data.identifier.displayName}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-[var(--space-3)] p-0">
        <Button
          onClick={handleRunToHere}
          disabled={isRunning || !onRunToHere}
          variant="primary"
          size="sm"
          className="w-full"
        >
          {isRunning ? 'Running...' : 'Run to Here'}
        </Button>
      </CardContent>
    </Card>
  );
}
