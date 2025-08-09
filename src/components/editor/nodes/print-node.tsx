// src/components/editor/nodes/print-node.tsx - Production-ready debug node with modal viewer
"use client";

import { useState, useEffect } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getNodeDefinition } from "@/shared/registry/registry-utils";
import type { PrintNodeData } from "@/shared/types/nodes";
import { useDebugContext } from "../flow/debug-context";
import { logger } from "@/lib/logger";

interface PrintNodeProps extends NodeProps<PrintNodeData> {
  onOpenLogViewer?: (nodeId: string) => void;
}

export function PrintNode({ data, selected, onOpenLogViewer }: PrintNodeProps) {
  const nodeDefinition = getNodeDefinition('print');
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
      logger.errorWithStack('Print node run to here failed', error);
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
    <Card 
      selected={selected} 
      className="p-4 min-w-[220px] cursor-pointer transition-all hover:bg-gray-750" 
      onDoubleClick={handleDoubleClick}
    >
      {/* Single input port */}
      {nodeDefinition?.ports.inputs.map((port) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          className={`w-3 h-3 ${nodeDefinition?.rendering.colors.handle ?? 'bg-gray-500'} !border-2 !border-white`}
          style={{ top: `50%` }}
        />
      ))}

      <CardHeader className="p-0 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-yellow-600 flex items-center justify-center rounded text-white font-bold text-sm">
            🖨️
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-white truncate">
              {data.identifier.displayName}
            </div>
            <div className="text-xs text-gray-400">
              Debug: {data.label}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-3">
        {/* Run to Here Button */}
        <Button
          onClick={handleRunToHere}
          disabled={isRunning || !onRunToHere}
          variant="primary"
          size="sm"
          className="w-full"
        >
          {isRunning ? 'Running...' : 'Run to Here'}
        </Button>

        {/* Simple info display */}
        <div className="bg-gray-700 p-3 rounded border text-center">
          <div className="text-xs text-gray-400">Debug Output Node</div>
          <div className="text-xs text-blue-400 mt-1">
            Double-click to view all captured outputs
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-gray-700">
          <div className="text-xs text-gray-400 text-center">
            Customer Debug Output
          </div>
          <div className="text-xs text-blue-400 text-center mt-1">
            Double-click to view debug logs
          </div>
          <div className="text-xs text-green-500 text-center mt-1">
            Production Ready
          </div>
        </div>
      </CardContent>
    </Card>
  );
}