// src/components/workspace/result-log-modal.tsx - Production-ready debug output viewer
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-[var(--space-3)]">
          <div className="w-5 h-5 bg-[var(--node-output)] flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-primary)]">
            <Target size={10} />
          </div>
          <div>
            <div className="text-[13px] font-medium text-[var(--text-primary)] text-refined-medium">
              {nodeName}
            </div>
            <div className="text-[10px] text-[var(--text-tertiary)]">
              {nodeLabel} • {logs.length} entries
            </div>
          </div>
        </div>
      }
      size="md"
      variant="glass"
    >
      {/* Toolbar */}
      <div className="flex items-center justify-end py-[var(--space-2)] px-[var(--space-3)] border-b border-[var(--border-primary)] bg-[var(--surface-1)] flex-shrink-0">
        
        <div className="flex items-center gap-[var(--space-1)]">
          <Button
            onClick={() => debugContext?.clearDebugResults(nodeId)}
            variant="minimal"
            size="xs"
            disabled={logs.length === 0}
            className="text-[10px] h-6"
          >
            <Trash2 size={10} className="mr-1" />
            Clear
          </Button>
          <Button
            onClick={exportLogs}
            variant="minimal"
            size="xs"
            disabled={logs.length === 0}
            className="text-[10px] h-6"
          >
            <Download size={10} className="mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Logs Content */}
      <div className="flex-1 p-[var(--space-3)]">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-10 h-10 bg-[var(--surface-2)] rounded-full flex items-center justify-center mb-[var(--space-3)]">
              <Target size={16} className="text-[var(--text-tertiary)]" />
            </div>
            <h3 className="text-[13px] font-medium text-[var(--text-primary)] mb-[var(--space-2)] text-refined-medium">
              No Debug Output
            </h3>
            <p className="text-[11px] text-[var(--text-tertiary)] mb-[var(--space-3)] max-w-[18rem] text-refined">
              Run your flow to capture values at this node. Results will appear here in real-time.
            </p>
            <div className="text-[10px] text-[var(--text-muted)] space-y-[var(--space-1)] text-refined">
              <p>• Values are captured when data flows through</p>
              <p>• Perfect for debugging complex logic</p>
            </div>
          </div>
        ) : (
          <div className="space-y-[var(--space-2)]">
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

          </div>
        )}
      </div>
    </Modal>
  );
}
