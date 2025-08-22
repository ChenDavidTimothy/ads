"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

interface DeleteContextType {
  onDeleteNode: (nodeId: string) => void;
  onDeleteEdge: (edgeId: string) => void;
  isDragging: boolean;
}

const DeleteContext = createContext<DeleteContextType | null>(null);

// Global drag state to prevent individual node listeners
const dragStateListeners = new Set<(isDragging: boolean) => void>();

function notifyDragStateChange(isDragging: boolean) {
  dragStateListeners.forEach(listener => listener(isDragging));
}

export function DeleteProvider({
  children,
  onDeleteNode,
  onDeleteEdge
}: {
  children: React.ReactNode;
  onDeleteNode: (nodeId: string) => void;
  onDeleteEdge: (edgeId: string) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    // Single global drag listener for all nodes
    const handleDragStart = () => notifyDragStateChange(true);
    const handleDragEnd = () => notifyDragStateChange(false);

    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('dragend', handleDragEnd);

    // Subscribe to global drag state
    const handleGlobalDragChange = (newIsDragging: boolean) => {
      setIsDragging(newIsDragging);
    };

    dragStateListeners.add(handleGlobalDragChange);

    return () => {
      document.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('dragend', handleDragEnd);
      dragStateListeners.delete(handleGlobalDragChange);
    };
  }, []);

  const contextValue = useCallback(() => ({
    onDeleteNode,
    onDeleteEdge,
    isDragging
  }), [onDeleteNode, onDeleteEdge, isDragging]);

  return (
    <DeleteContext.Provider value={contextValue()}>
      {children}
    </DeleteContext.Provider>
  );
}

export function useDeleteActions() {
  const context = useContext(DeleteContext);
  if (!context) {
    throw new Error("useDeleteActions must be used within DeleteProvider");
  }
  return context;
}
