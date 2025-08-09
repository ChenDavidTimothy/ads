// src/components/editor/print-log-modal.tsx - Production-ready debug output viewer
"use client";

import { useState, useEffect, useRef } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDebugContext } from "./flow/debug-context";

interface PrintLogEntry {
  value: unknown;
  type: string;
  timestamp: number;
  formattedValue: string;
  executionId?: string;
  flowState?: string;
  hasConnections?: boolean;
  inputCount?: number;
}

interface PrintLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeId: string;
  nodeName: string;
  nodeLabel: string;
}

export function PrintLogModal({
  isOpen,
  onClose,
  nodeId,
  nodeName,
  nodeLabel
}: PrintLogModalProps) {
  const [logs, setLogs] = useState<PrintLogEntry[]>([]);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const debugContext = useDebugContext();

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
      executionId: result.executionId || `exec-${result.timestamp}`,
      flowState: result.flowState,
      hasConnections: result.hasConnections,
      inputCount: result.inputCount
    }));

    setLogs(formattedLogs);
    setIsAutoScroll(true);
  }, [isOpen, nodeId, debugContext, debugContext?.getAllDebugResults]);

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
          executionId: result.executionId || `exec-${result.timestamp}`,
          flowState: result.flowState,
          hasConnections: result.hasConnections,
          inputCount: result.inputCount
        }));

        setLogs(formattedLogs);
      }
    }, 1000); // Poll every second

    return () => clearInterval(interval);
  }, [isOpen, nodeId, debugContext, logs.length]);

  const formatValue = (value: unknown): string => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return String(value);
      }
    }
    return String(value);
  };

  const getValueTypeColor = (type: string): string => {
    switch (type) {
      case 'string': return 'text-green-400';
      case 'number': return 'text-blue-400';
      case 'boolean': return 'text-purple-400';
      case 'null': return 'text-gray-400';
      case 'undefined': return 'text-gray-500';
      case 'object': return 'text-yellow-400';
      default: return 'text-white';
    }
  };

  const clearLogs = () => {
    setLogs([]);
    // Also clear from the debug context if possible
    // Note: This only clears the local display, the debug context accumulates across sessions
  };

  const refreshLogs = () => {
    if (!debugContext?.getAllDebugResults) return;
    
    const allResults = debugContext.getAllDebugResults(nodeId);
    const formattedLogs = allResults.map(result => ({
      value: result.value,
      type: result.type,
      timestamp: result.timestamp,
      formattedValue: formatValue(result.value),
      executionId: result.executionId || `exec-${result.timestamp}`,
      flowState: result.flowState,
      hasConnections: result.hasConnections,
      inputCount: result.inputCount
    }));

    setLogs(formattedLogs);
    setIsAutoScroll(true);
  };

  const exportLogs = () => {
    const exportData = {
      nodeId,
      nodeName,
      nodeLabel,
      exportedAt: new Date().toISOString(),
      logs: logs.map(log => ({
        timestamp: new Date(log.timestamp).toISOString(),
        type: log.type,
        value: log.value,
        formattedValue: log.formattedValue
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `print-logs-${nodeName}-${Date.now()}.json`;
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
        <div className="flex items-center justify-between p-4 border-b border-gray-600">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-yellow-600 flex items-center justify-center rounded text-white font-bold">
              🖨️
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{nodeName}</h3>
              <p className="text-sm text-gray-400">Label: {nodeLabel}</p>
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

        {/* Stats bar */}
        <div className="flex items-center justify-between p-3 bg-gray-800 text-sm">
          <div className="flex items-center gap-4">
            <span className="text-gray-300">
              Total Outputs: <span className="text-white font-medium">{logs.length}</span>
            </span>
            {logs.length > 0 && (
              <span className="text-gray-300">
                Latest: <span className="text-white font-medium">
                  {new Date(logs[logs.length - 1].timestamp).toLocaleTimeString()}
                </span>
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-gray-300">
              <input
                type="checkbox"
                checked={isAutoScroll}
                onChange={(e) => setIsAutoScroll(e.target.checked)}
                className="rounded"
              />
              Auto-scroll
            </label>
          </div>
        </div>

        {/* Logs display */}
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto bg-gray-900 p-4"
        >
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mb-4">
                🖨️
              </div>
              <h3 className="text-lg font-medium mb-2">No Debug Output Yet</h3>
              <p className="text-sm text-center max-w-md">
                Click "Run to Here" on the print node to execute your flow and see debug output here.
                This is a production-ready debugging tool for your customers.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log, index) => (
                <div 
                  key={`${log.timestamp}-${index}`}
                  className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
                >
                  {/* Log header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded font-mono">
                        #{index + 1}
                      </span>
                      <span className={cn("text-sm font-medium", getValueTypeColor(log.type))}>
                        {log.type}
                      </span>
                      {log.executionId && (
                        <span className="text-xs text-blue-400 bg-blue-900/30 px-2 py-1 rounded">
                          {log.executionId}
                        </span>
                      )}
                      {log.flowState && (
                        <span className={cn(
                          "text-xs px-2 py-1 rounded",
                          log.flowState === 'executed_successfully' 
                            ? 'text-green-400 bg-green-900/30'
                            : log.flowState === 'no_input_connected'
                            ? 'text-yellow-400 bg-yellow-900/30'
                            : 'text-gray-400 bg-gray-900/30'
                        )}>
                          {log.flowState.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>

                  {/* Log content */}
                  <div className="bg-gray-900 border border-gray-600 rounded p-3">
                    <pre className="text-sm text-white font-mono whitespace-pre-wrap break-words overflow-x-auto">
                      {log.formattedValue}
                    </pre>
                  </div>

                  {/* Execution metadata */}
                  {(log.hasConnections !== undefined || log.inputCount !== undefined) && (
                    <div className="mt-2 pt-2 border-t border-gray-700">
                      <div className="text-xs text-gray-400 mb-1">Execution Info:</div>
                      <div className="flex flex-wrap gap-1">
                        {log.hasConnections !== undefined && (
                          <span className={cn(
                            "text-xs px-2 py-1 rounded",
                            log.hasConnections 
                              ? 'text-green-400 bg-green-900/30' 
                              : 'text-red-400 bg-red-900/30'
                          )}>
                            {log.hasConnections ? 'Connected' : 'No Connections'}
                          </span>
                        )}
                        {typeof log.inputCount === 'number' && (
                          <span className="text-xs bg-blue-900/30 text-blue-400 px-2 py-1 rounded">
                            {log.inputCount} input{log.inputCount !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Raw value preview for objects */}
                  {log.type === 'object' && typeof log.value === 'object' && log.value !== null && (
                    <div className="mt-2 pt-2 border-t border-gray-700">
                      <div className="text-xs text-gray-400 mb-1">Object Keys:</div>
                      <div className="flex flex-wrap gap-1">
                        {Object.keys(log.value).map(key => (
                          <span 
                            key={key}
                            className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded"
                          >
                            {key}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>

        {/* Footer with helpful info */}
        <div className="p-3 bg-gray-800 border-t border-gray-600">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <div>
              This debug output is captured in real-time during flow execution
            </div>
            <div className="flex items-center gap-4">
              <span>Production Ready</span>
              <span>•</span>
              <span>Customer Debugging Tool</span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
