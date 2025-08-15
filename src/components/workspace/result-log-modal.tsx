// src/components/workspace/result-log-modal.tsx - Production-ready debug output viewer
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDebugContext } from "./flow/debug-context";

interface ResultLogEntry {
  value: unknown;
  type: string;
  timestamp: number;
  formattedValue: string;
  executionId?: string;
  flowState?: string;
  hasConnections?: boolean;
  inputCount?: number;
}

interface ResultLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeId: string;
  nodeName: string;
  nodeLabel: string;
}

export function ResultLogModal({
  isOpen,
  onClose,
  nodeId,
  nodeName,
  nodeLabel
}: ResultLogModalProps) {
  const [logs, setLogs] = useState<ResultLogEntry[]>([]);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const debugContext = useDebugContext();

  // Format value for display
  const formatValue = useCallback((value: unknown): string => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'boolean') return value.toString();
    if (Array.isArray(value)) {
      if (value.length === 0) return '[]';
      if (value.length <= 3) return `[${value.map(formatValue).join(', ')}]`;
      return `[${value.slice(0, 3).map(formatValue).join(', ')}...] (${value.length} items)`;
    }
    if (typeof value === 'object') {
      const keys = Object.keys(value as Record<string, unknown>);
      if (keys.length === 0) return '{}';
      if (keys.length <= 3) return `{${keys.slice(0, 3).map(k => `${k}: ${formatValue((value as Record<string, unknown>)[k])}`).join(', ')}}`;
      return `{${keys.slice(0, 3).map(k => `${k}: ${formatValue((value as Record<string, unknown>)[k])}`).join(', ')}...} (${keys.length} keys)`;
    }
    if (typeof value === 'symbol') return value.toString();
    if (typeof value === 'function') return '[Function]';
    if (typeof value === 'bigint') return value.toString() + 'n';
    return '[Unknown Type]';
  }, []);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (isAutoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isAutoScroll]);

  // Handle scroll to detect when user manually scrolls up
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
    setIsAutoScroll(isAtBottom);
  };

  // Load all accumulated logs when modal opens or debug results change
  useEffect(() => {
    if (!isOpen || !debugContext?.getAllDebugResults) return;

    const allResults = debugContext.getAllDebugResults(nodeId);
    const formattedLogs = allResults.map(result => ({
      value: result.value,
      type: result.type,
      timestamp: result.timestamp,
      formattedValue: formatValue(result.value),
      executionId: result.executionId ?? `exec-${result.timestamp}`,
      flowState: result.flowState,
      hasConnections: result.hasConnections,
      inputCount: result.inputCount
    }));

    setLogs(formattedLogs);
    setIsAutoScroll(true);
  }, [isOpen, nodeId, debugContext, debugContext?.getAllDebugResults, formatValue]);

  // Poll for new logs while modal is open - always poll to catch new results
  useEffect(() => {
    if (!isOpen || !debugContext?.getAllDebugResults) return;

    const interval = setInterval(() => {
      const allResults = debugContext.getAllDebugResults(nodeId);
      if (allResults.length > logs.length) {
        const formattedLogs = allResults.map(result => ({
          value: result.value,
          type: result.type,
          timestamp: result.timestamp,
          formattedValue: formatValue(result.value),
          executionId: result.executionId ?? `exec-${result.timestamp}`,
          flowState: result.flowState,
          hasConnections: result.hasConnections,
          inputCount: result.inputCount
        }));

        setLogs(formattedLogs);
      }
    }, 3000); // Changed from 1000 to 3000 (3 seconds instead of 1)

    return () => clearInterval(interval);
  }, [isOpen, nodeId, debugContext, debugContext?.getAllDebugResults, logs.length, formatValue]);

  // Get color for value type
  const getValueTypeColor = (type: string): string => {
    switch (type) {
      case 'string': return 'text-[var(--success-500)]';
      case 'number': return 'text-[var(--accent-primary)]';
      case 'boolean': return 'text-[var(--warning-600)]';
      case 'array': return 'text-[var(--node-logic)]';
      case 'object': return 'text-[var(--text-primary)]';
      case 'null': return 'text-[var(--text-tertiary)]';
      case 'undefined': return 'text-[var(--text-tertiary)]';
      default: return 'text-[var(--text-primary)]';
    }
  };

  // Clear all logs
  const clearLogs = () => {
    setLogs([]);
  };

  // Refresh logs from debug context
  const refreshLogs = () => {
    if (!debugContext?.getAllDebugResults) return;

    const allResults = debugContext.getAllDebugResults(nodeId);
    const formattedLogs = allResults.map(result => ({
      value: result.value,
      type: result.type,
      timestamp: result.timestamp,
      formattedValue: formatValue(result.value),
      executionId: result.executionId ?? `exec-${result.timestamp}`,
      flowState: result.flowState,
      hasConnections: result.hasConnections,
      inputCount: result.inputCount
    }));

    setLogs(formattedLogs);
    setIsAutoScroll(true);
  };

  // Export logs as JSON
  const exportLogs = () => {
    const exportData = {
      nodeId,
      nodeName,
      nodeLabel,
      exportTimestamp: new Date().toISOString(),
      logs: logs.map(log => ({
        ...log,
        timestamp: new Date(log.timestamp).toISOString()
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `result-logs-${nodeName}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={`Debug Output: ${nodeName}`}
      size="xl"
    >
      <div className="flex flex-col h-full">
        {/* Header with node info and controls */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[var(--success-600)] flex items-center justify-center rounded text-[var(--text-primary)] font-bold">
              📊
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">{nodeName}</h3>
              <p className="text-sm text-[var(--text-tertiary)]">Label: {nodeLabel}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              onClick={refreshLogs}
              variant="secondary"
              size="sm"
            >
              🔄 Refresh
            </Button>
            <Button
              onClick={clearLogs}
              variant="secondary"
              size="sm"
              disabled={logs.length === 0}
            >
              Clear Logs
            </Button>
            <Button
              onClick={exportLogs}
              variant="secondary"
              size="sm"
              disabled={logs.length === 0}
            >
              Export JSON
            </Button>
            <Button onClick={onClose} variant="primary" size="sm">
              Close
            </Button>
          </div>
        </div>

        {/* Logs display */}
        <div className="flex-1 overflow-hidden">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <div className="w-16 h-16 bg-[var(--surface-2)] rounded-full flex items-center justify-center mb-4">
                <span className="text-2xl">📊</span>
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">No Debug Output Yet</h3>
              <p className="text-[var(--text-tertiary)] mb-4 max-w-md">
                Click &quot;Run to Here&quot; on the result node to execute your flow and see debug output here.
              </p>
              <div className="text-xs text-[var(--text-tertiary)] space-y-1">
                <p>• The result node captures all data flowing through it</p>
                <p>• Use it to inspect values at specific points in your flow</p>
                <p>• Perfect for debugging complex animation logic</p>
              </div>
            </div>
          ) : (
            <div 
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="h-full overflow-y-auto p-4 space-y-3"
            >
              {logs.map((log, index) => (
                <div key={index} className="bg-[var(--surface-1)] rounded-lg p-4 border border-[var(--border-primary)]">
                  {/* Log header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "px-2 py-1 rounded text-xs font-mono",
                        getValueTypeColor(log.type)
                      )}>
                        {log.type}
                      </span>
                      {log.executionId && (
                        <span className="text-xs text-[var(--text-tertiary)] font-mono">
                          {log.executionId}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--text-tertiary)]">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </div>
                  </div>

                  {/* Log value */}
                  <div className="mb-3">
                    <div className="text-sm text-[var(--text-secondary)] mb-1">Value:</div>
                    <div className="bg-[var(--surface-0)] p-3 rounded border border-[var(--border-primary)] font-mono text-sm text-[var(--text-primary)] break-all">
                      {log.formattedValue}
                    </div>
                  </div>

                  {/* Execution context */}
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-[var(--text-tertiary)]">Flow State:</span>
                      <span className="ml-2 text-[var(--text-primary)]">{log.flowState ?? 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[var(--text-tertiary)]">Connections:</span>
                      <span className="ml-2 text-[var(--text-primary)]">{log.hasConnections ? 'Yes' : 'No'}</span>
                    </div>
                    {log.inputCount !== undefined && (
                      <div>
                        <span className="text-[var(--text-tertiary)]">Input Count:</span>
                        <span className="ml-2 text-[var(--text-primary)]">{log.inputCount}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
