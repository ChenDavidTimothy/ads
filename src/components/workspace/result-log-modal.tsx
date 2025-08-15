// src/components/workspace/result-log-modal.tsx - Production-ready debug output viewer
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { DraggableModal } from "@/components/ui/draggable-modal";
import { useDebugContext } from "./flow/debug-context";
import { cn } from "@/lib/utils";
import { 
  Trash2, 
  Download, 
  Target,
  Clock
} from "lucide-react";

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

  // Format value for display - more efficient
  const formatValue = useCallback((value: unknown): string => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (Array.isArray(value)) {
      if (value.length === 0) return '[]';
      if (value.length <= 2) return `[${value.map(formatValue).join(', ')}]`;
      return `[${value.slice(0, 2).map(formatValue).join(', ')}, ...] (${value.length} items)`;
    }
    if (typeof value === 'object') {
      const keys = Object.keys(value as Record<string, unknown>);
      if (keys.length === 0) return '{}';
      if (keys.length <= 2) {
        const entries = keys.slice(0, 2).map(k => `${k}: ${formatValue((value as Record<string, unknown>)[k])}`);
        return `{${entries.join(', ')}}`;
      }
      return `{${keys.slice(0, 2).join(', ')}, ...} (${keys.length} keys)`;
    }
    return '[Complex Type]';
  }, []);

  // Auto-scroll functionality
  useEffect(() => {
    if (isAutoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isAutoScroll]);

  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 5;
    setIsAutoScroll(isAtBottom);
  }, []);

  // Load and refresh logs
  useEffect(() => {
    if (!isOpen || !debugContext?.getAllDebugResults) return;

    const refreshLogs = () => {
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
    };

    refreshLogs();
    setIsAutoScroll(true);

    // Poll for updates
    const interval = setInterval(refreshLogs, 2000);
    return () => clearInterval(interval);
  }, [isOpen, nodeId, debugContext, formatValue]);

  // Value type colors
  const getValueTypeColor = (type: string): string => {
    switch (type) {
      case 'string': return 'text-[var(--success-500)]';
      case 'number': return 'text-[var(--accent-primary)]';
      case 'boolean': return 'text-[var(--warning-600)]';
      case 'array': return 'text-[var(--node-logic)]';
      case 'object': return 'text-[var(--node-geometry)]';
      case 'null':
      case 'undefined': return 'text-[var(--text-tertiary)]';
      default: return 'text-[var(--text-primary)]';
    }
  };

  // Export functionality
  const exportLogs = () => {
    const exportData = {
      nodeId,
      nodeName,
      nodeLabel,
      exportTimestamp: new Date().toISOString(),
      totalEntries: logs.length,
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
    <DraggableModal
      isOpen={isOpen}
      onClose={onClose}
      title={nodeName}
      width="w-[32rem]"
      height="h-[32rem]"
      collapsible={true}
      headerIcon={
        <div className="w-6 h-6 bg-[var(--node-output)] flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-primary)]">
          <Target size={12} />
        </div>
      }
      headerActions={
        <div className="text-[11px] text-[var(--text-tertiary)]">
          {nodeLabel} • {logs.length} entries
        </div>
      }
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between p-[var(--space-3)] border-b border-[var(--border-primary)] bg-[var(--surface-2)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <div className={cn(
            "w-2 h-2 rounded-full",
            isAutoScroll ? "bg-[var(--success-500)]" : "bg-[var(--warning-500)]"
          )} />
          <span className="text-[11px] text-[var(--text-tertiary)]">
            {isAutoScroll ? "Auto-scroll" : "Manual scroll"}
          </span>
        </div>
        
        <div className="flex items-center gap-[var(--space-1)]">
          <Button
            onClick={() => setLogs([])}
            variant="minimal"
            size="xs"
            disabled={logs.length === 0}
            className="text-[10px]"
          >
            <Trash2 size={10} className="mr-1" />
            Clear
          </Button>
          <Button
            onClick={exportLogs}
            variant="minimal"
            size="xs"
            disabled={logs.length === 0}
            className="text-[10px]"
          >
            <Download size={10} className="mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Logs Content */}
      <div className="flex-1 overflow-hidden">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-[var(--space-6)] text-center">
            <div className="w-12 h-12 bg-[var(--surface-2)] rounded-full flex items-center justify-center mb-[var(--space-3)]">
              <Target size={20} className="text-[var(--text-tertiary)]" />
            </div>
            <h3 className="text-[13px] font-medium text-[var(--text-primary)] mb-[var(--space-2)]">
              No Debug Output
            </h3>
            <p className="text-[11px] text-[var(--text-tertiary)] mb-[var(--space-3)] max-w-[20rem]">
              Run your flow to capture values at this node. Results will appear here in real-time.
            </p>
            <div className="text-[10px] text-[var(--text-tertiary)] space-y-[var(--space-1)]">
              <p>• Values are captured when data flows through</p>
              <p>• Perfect for debugging complex logic</p>
            </div>
          </div>
        ) : (
          <div 
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="h-full overflow-y-auto scrollbar-elegant p-[var(--space-3)] space-y-[var(--space-2)]"
          >
            {logs.map((log, index) => (
              <div 
                key={index} 
                className="bg-[var(--surface-1)] rounded-[var(--radius-sm)] p-[var(--space-3)] border border-[var(--border-primary)]"
              >
                {/* Compact Header */}
                <div className="flex items-center justify-between mb-[var(--space-2)]">
                  <div className="flex items-center gap-[var(--space-2)]">
                    <span className={cn(
                      "px-[var(--space-2)] py-[var(--space-half)] rounded-[var(--radius-sm)] text-[10px] font-mono font-medium",
                      "bg-[var(--surface-2)] border border-[var(--border-primary)]",
                      getValueTypeColor(log.type)
                    )}>
                      {log.type}
                    </span>
                    <span className="text-[10px] text-[var(--text-tertiary)] font-mono">
                      #{index + 1}
                    </span>
                  </div>
                  <div className="flex items-center gap-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                    <Clock size={10} />
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </div>
                </div>

                {/* Value Display */}
                <div className="bg-[var(--surface-0)] p-[var(--space-2)] rounded-[var(--radius-sm)] border border-[var(--border-primary)]">
                  <div className="font-mono text-[11px] text-[var(--text-primary)] break-all">
                    {log.formattedValue}
                  </div>
                </div>

                {/* Execution Info */}
                {(log.flowState || log.hasConnections !== undefined) && (
                  <div className="mt-[var(--space-2)] pt-[var(--space-2)] border-t border-[var(--border-secondary)] flex items-center gap-[var(--space-4)] text-[10px]">
                    {log.flowState && (
                      <div>
                        <span className="text-[var(--text-tertiary)]">State:</span>
                        <span className="ml-[var(--space-1)] text-[var(--text-primary)]">
                          {log.flowState}
                        </span>
                      </div>
                    )}
                    {log.hasConnections !== undefined && (
                      <div>
                        <span className="text-[var(--text-tertiary)]">Connected:</span>
                        <span className={cn(
                          "ml-[var(--space-1)]",
                          log.hasConnections ? "text-[var(--success-500)]" : "text-[var(--warning-600)]"
                        )}>
                          {log.hasConnections ? 'Yes' : 'No'}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </DraggableModal>
  );
}
