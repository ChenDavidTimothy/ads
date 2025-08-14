// src/components/workspace/nodes/result-node.tsx - Production-ready debug node with modal viewer
"use client";

import { useState } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getNodeDefinition } from "@/shared/registry/registry-utils";
import type { ResultNodeData } from "@/shared/types/nodes";
import { useDebugContext } from "../flow/debug-context";
import { logger } from "@/lib/logger";
import { Target } from "lucide-react";

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

  const handleClass = "bg-[var(--node-output)]";

  return (
    <Card 
      selected={selected} 
      className="p-[var(--card-padding)] min-w-[var(--node-min-width)] cursor-pointer transition-all hover:bg-[var(--surface-interactive)]" 
      onDoubleClick={handleDoubleClick}
    >
      {/* Single input port */}
      {nodeDefinition?.ports.inputs.map((port) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          className={`w-3 h-3 ${handleClass} !border-2 !border-[var(--text-primary)]`}
          style={{ top: `50%` }}
        />
      ))}

      <CardHeader className="p-0 pb-[var(--space-3)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <div className="w-6 h-6 bg-[var(--node-output)] flex items-center justify-center rounded text-[var(--text-primary)]">
            <Target size={12} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[var(--text-primary)] truncate">
              {data.identifier.displayName}
            </div>
            <div className="text-xs text-[var(--text-tertiary)]">
              {data.label}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-[var(--space-3)]">
        <Button
          onClick={handleRunToHere}
          disabled={isRunning || !onRunToHere}
          variant="primary"
          size="sm"
          className="w-full"
        >
          {isRunning ? 'Running...' : 'Run to Here'}
        </Button>

        <div className="bg-[var(--surface-2)] p-[var(--space-3)] rounded-[var(--radius-sm)] border border-[var(--border-primary)] text-center">
          <div className="text-xs text-[var(--text-secondary)]">Debug</div>
        </div>
      </CardContent>
    </Card>
  );
}
