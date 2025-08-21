// src/components/workspace/result-log-modal.tsx - Production-ready debug output viewer
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useDebugContext } from "./flow/debug-context";
import { cn } from "@/lib/utils";
import { Trash2, Download, Target, Clock } from "lucide-react";

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
  nodeLabel,
}: ResultLogModalProps) {
  const [logs, setLogs] = useState<ResultLogEntry[]>([]);

  const debugContext = useDebugContext();

  // Format value for display - more efficient
  const formatValue = useCallback((value: unknown): string => {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (typeof value === "string") return `"${value}"`;
    if (typeof value === "number") return value.toString();
    if (typeof value === "boolean") return value ? "true" : "false";
    if (Array.isArray(value)) {
      if (value.length === 0) return "[]";
      if (value.length <= 2) return `[${value.map(formatValue).join(", ")}]`;
      return `[${value.slice(0, 2).map(formatValue).join(", ")}, ...] (${value.length} items)`;
    }
    if (typeof value === "object") {
      const keys = Object.keys(value as Record<string, unknown>);
      if (keys.length === 0) return "{}";
      if (keys.length <= 2) {
        const entries = keys
          .slice(0, 2)
          .map(
            (k) =>
              `${k}: ${formatValue((value as Record<string, unknown>)[k])}`,
          );
        return `{${entries.join(", ")}}`;
      }
      return `{${keys.slice(0, 2).join(", ")}, ...} (${keys.length} keys)`;
    }
    return "[Complex Type]";
  }, []);

  // Load and refresh logs
  useEffect(() => {
    if (!isOpen || !debugContext?.getAllDebugResults) return;

    const refreshLogs = () => {
      const allResults = debugContext.getAllDebugResults(nodeId);
      const formattedLogs = allResults.map((result) => ({
        value: result.value,
        type: result.type,
        timestamp: result.timestamp,
        formattedValue: formatValue(result.value),
        executionId: result.executionId ?? `exec-${result.timestamp}`,
        flowState: result.flowState,
        hasConnections: result.hasConnections,
        inputCount: result.inputCount,
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
      case "string":
        return "text-[var(--success-500)]";
      case "number":
        return "text-[var(--accent-primary)]";
      case "boolean":
        return "text-[var(--warning-600)]";
      case "array":
        return "text-[var(--node-logic)]";
      case "object":
        return "text-[var(--node-geometry)]";
      case "null":
      case "undefined":
        return "text-[var(--text-tertiary)]";
      default:
        return "text-[var(--text-primary)]";
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
      logs: logs.map((log) => ({
        ...log,
        timestamp: new Date(log.timestamp).toISOString(),
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
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
          <div className="flex h-5 w-5 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--node-output)] text-[var(--text-primary)]">
            <Target size={10} />
          </div>
          <div>
            <div className="text-refined-medium text-[13px] font-medium text-[var(--text-primary)]">
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
      <div className="flex flex-shrink-0 items-center justify-end border-b border-[var(--border-primary)] bg-[var(--surface-1)] px-[var(--space-3)] py-[var(--space-2)]">
        <div className="flex items-center gap-[var(--space-1)]">
          <Button
            onClick={() => debugContext?.clearDebugResults(nodeId)}
            variant="minimal"
            size="xs"
            disabled={logs.length === 0}
          >
            <Trash2 size={10} className="mr-1" />
            Clear
          </Button>
          <Button
            onClick={exportLogs}
            variant="minimal"
            size="xs"
            disabled={logs.length === 0}
          >
            <Download size={10} className="mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Logs Content */}
      <div className="flex-1 p-[var(--space-3)]">
        {logs.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-[var(--space-3)] flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-2)]">
              <Target size={16} className="text-[var(--text-tertiary)]" />
            </div>
            <h3 className="text-refined-medium mb-[var(--space-2)] text-[13px] font-medium text-[var(--text-primary)]">
              No Results Available
            </h3>
            <p className="text-refined mb-[var(--space-3)] max-w-[18rem] text-[11px] text-[var(--text-tertiary)]">
              Run your flow to capture values at this node. Results will appear
              here in real-time.
            </p>
            <div className="text-refined space-y-[var(--space-1)] text-[10px] text-[var(--text-muted)]">
              <p>• Values are captured when data flows through</p>
              <p>• Monitor data flow and node outputs</p>
            </div>
          </div>
        ) : (
          <div className="space-y-[var(--space-2)]">
            {logs.map((log, index) => (
              <div
                key={index}
                className="rounded-[var(--radius-sm)] border border-[var(--border-primary)] bg-[var(--surface-1)] p-[var(--space-3)]"
              >
                {/* Compact Header */}
                <div className="mb-[var(--space-2)] flex items-center justify-between">
                  <div className="flex items-center gap-[var(--space-2)]">
                    <span
                      className={cn(
                        "rounded-[var(--radius-sm)] px-[var(--space-2)] py-[var(--space-half)] font-mono text-[10px] font-medium",
                        "border border-[var(--border-primary)] bg-[var(--surface-2)]",
                        getValueTypeColor(log.type),
                      )}
                    >
                      {log.type}
                    </span>
                    <span className="font-mono text-[10px] text-[var(--text-tertiary)]">
                      #{index + 1}
                    </span>
                  </div>
                  <div className="flex items-center gap-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                    <Clock size={10} />
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </div>
                </div>

                {/* Value Display */}
                <div className="rounded-[var(--radius-sm)] border border-[var(--border-primary)] bg-[var(--surface-0)] p-[var(--space-2)]">
                  <div className="font-mono text-[11px] break-all text-[var(--text-primary)]">
                    {log.formattedValue}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
