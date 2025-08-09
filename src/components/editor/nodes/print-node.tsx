// src/components/editor/nodes/print-node.tsx - Debug terminal node with "Run to Here"
"use client";

import { useState, useEffect } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getNodeDefinition } from "@/shared/registry/registry-utils";
import type { PrintNodeData } from "@/shared/types/nodes";
import { useDebugContext } from "../flow/debug-context";

export function PrintNode({ data, selected }: NodeProps<PrintNodeData>) {
  const nodeDefinition = getNodeDefinition('print');
  const [isRunning, setIsRunning] = useState(false);
  const [lastValue, setLastValue] = useState<{ value: unknown; type: string; timestamp: number } | null>(null);
  
  // Use debug context if available
  const debugContext = useDebugContext();
  const onRunToHere = debugContext?.runToNode;
  const getDebugResult = debugContext?.getDebugResult;

  // Update lastValue when debug result changes
  useEffect(() => {
    if (getDebugResult) {
      const result = getDebugResult(data.identifier.id);
      if (result) {
        setLastValue(result);
      }
    }
  }, [getDebugResult, data.identifier.id]);

  // Poll for debug results periodically when debugging is active
  useEffect(() => {
    if (!getDebugResult || !debugContext?.isDebugging) return;

    const interval = setInterval(() => {
      const result = getDebugResult(data.identifier.id);
      if (result && (!lastValue || result.timestamp > lastValue.timestamp)) {
        setLastValue(result);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [getDebugResult, data.identifier.id, debugContext?.isDebugging, lastValue]);

  const handleRunToHere = async () => {
    if (!onRunToHere) return;
    
    setIsRunning(true);
    try {
      await onRunToHere(data.identifier.id);
    } catch (error) {
      console.error('[PRINT] Run to here failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const formatValue = (value: unknown): string => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value, null, 1);
      } catch {
        return String(value);
      }
    }
    return String(value);
  };

  const getValueType = (value: unknown): string => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return `array[${value.length}]`;
    return typeof value;
  };

  const truncateValue = (formatted: string, maxLength: number = 50): string => {
    if (formatted.length <= maxLength) return formatted;
    return formatted.substring(0, maxLength - 3) + '...';
  };

  return (
    <Card selected={selected} className="p-4 min-w-[220px]">
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

        {/* Last Value Display */}
        {lastValue ? (
          <div className="bg-gray-700 p-3 rounded border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Last Output:</span>
              <span className="text-xs text-blue-400">
                {lastValue.type}
              </span>
            </div>
            
            <div className="bg-gray-800 p-2 rounded">
              <div className="text-xs text-white font-mono break-all">
                {truncateValue(formatValue(lastValue.value))}
              </div>
            </div>

            <div className="text-xs text-gray-500">
              {new Date(lastValue.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ) : (
          <div className="bg-gray-700 p-3 rounded border text-center">
            <div className="text-xs text-gray-400">No output yet</div>
            <div className="text-xs text-gray-500 mt-1">
              Click "Run to Here" to debug
            </div>
          </div>
        )}

        <div className="mt-3 pt-2 border-t border-gray-700">
          <div className="text-xs text-gray-400 text-center">
            Terminal Debug Node
          </div>
          <div className="text-xs text-yellow-500 text-center mt-1">
            Logs to browser console
          </div>
        </div>
      </CardContent>
    </Card>
  );
}