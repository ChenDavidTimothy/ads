import React, { createContext, useContext, ReactNode } from 'react';

interface DebugContextValue {
  runToNode: (nodeId: string) => Promise<void>;
  getDebugResult: (nodeId: string) => { value: unknown; type: string; timestamp: number } | null;
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
    <DebugContext.Provider value={value}>
      {children}
    </DebugContext.Provider>
  );
}
