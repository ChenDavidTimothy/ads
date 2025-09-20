// src/components/workspace/nodes/result-node.tsx - Result/debug node UI
'use client';

import { useState } from 'react';
import type { NodeProps } from 'reactflow';
import { Target } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { ResultNodeData } from '@/shared/types/nodes';
import { logger } from '@/lib/logger';

import {
  NodeCard,
  NodeHeader,
  NodePortIndicator,
  getNodeCategoryLabel,
  getNodeCategoryVisuals,
} from './components/node-chrome';
import { useDebugContext } from '../flow/debug-context';

interface ResultNodeProps extends NodeProps<ResultNodeData> {
  onOpenLogViewer?: (nodeId: string) => void;
}

export function ResultNode({ data, selected, onOpenLogViewer }: ResultNodeProps) {
  const nodeDefinition = getNodeDefinition('result');
  const category = nodeDefinition?.execution.category;
  const visuals = getNodeCategoryVisuals(category);
  const categoryLabel = getNodeCategoryLabel(category);
  const [isRunning, setIsRunning] = useState(false);

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

  return (
    <NodeCard selected={selected} className="cursor-pointer" onDoubleClick={handleDoubleClick}>
      {nodeDefinition?.ports.inputs.map((port) => (
        <NodePortIndicator
          key={port.id}
          id={port.id}
          side="left"
          type="target"
          top="35%"
          label="Data to inspect"
          description="Connect the flow you want to pause and observe."
          handleClassName={visuals.handle}
          accent={category}
        />
      ))}

      <NodeHeader
        icon={<Target size={14} />}
        title={data.identifier.displayName}
        accentClassName={visuals.iconBg}
        subtitle={categoryLabel}
        meta={<span className="text-xs text-[var(--text-secondary)]">Debug</span>}
      />

      <div className="space-y-[var(--space-2)] text-xs text-[var(--text-secondary)]">
        <Button
          onClick={handleRunToHere}
          disabled={isRunning || !onRunToHere}
          variant="primary"
          size="sm"
          className="w-full"
        >
          {isRunning ? 'Running…' : 'Run to Here'}
        </Button>
        <div className="rounded border border-dashed border-[var(--border-primary)] px-[var(--space-3)] py-[var(--space-2)] text-[11px]">
          Double-click to review the latest logs for this node.
        </div>
      </div>

      {nodeDefinition?.ports.outputs.map((port) => (
        <NodePortIndicator
          key={port.id}
          id={port.id}
          side="right"
          type="source"
          top="35%"
          label="Forwarded data"
          description="Continues the flow after inspection."
          handleClassName={visuals.handle}
          accent={category}
        />
      ))}
    </NodeCard>
  );
}
