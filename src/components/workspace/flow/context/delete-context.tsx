"use client";

import { createContext, useContext, useState, useEffect } from "react";

interface DeleteContextType {
  onDeleteNode: (nodeId: string) => void;
  isDragging: boolean;
}

const DeleteContext = createContext<DeleteContextType | null>(null);

export function DeleteProvider({
  children,
  onDeleteNode
}: {
  children: React.ReactNode;
  onDeleteNode: (nodeId: string) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    // Simple drag state management - only for preventing accidental clicks
    const handleDragStart = () => setIsDragging(true);
    const handleDragEnd = () => setIsDragging(false);

    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('dragend', handleDragEnd);

    return () => {
      document.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('dragend', handleDragEnd);
    };
  }, []);

  return (
    <DeleteContext.Provider value={{ onDeleteNode, isDragging }}>
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
