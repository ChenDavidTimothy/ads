import React, { createContext, useContext, type ReactNode } from "react";

interface DebugResult {
  value: unknown;
  type: string;
  timestamp: number;
  executionId?: string;
  flowState?: string;
  hasConnections?: boolean;
  inputCount?: number;
}

interface DebugContextValue {
  runToNode: (nodeId: string) => Promise<void>;
  getDebugResult: (nodeId: string) => DebugResult | null;
  getAllDebugResults: (nodeId: string) => DebugResult[];
  clearDebugResults: (nodeId: string) => void;
  isDebugging: boolean;
}

const DebugContext = createContext<DebugContextValue | null>(null);

export function useDebugContext() {
  const context = useContext(DebugContext);
  return context; // Return null if no debug context is provided
}

interface DebugProviderProps {
  children: ReactNode;
  value: DebugContextValue;
}

export function DebugProvider({ children, value }: DebugProviderProps) {
  return (
    <DebugContext.Provider value={value}>{children}</DebugContext.Provider>
  );
}
