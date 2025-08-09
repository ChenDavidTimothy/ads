// src/components/editor/flow/hooks/use-print-log-viewer.ts
import { useCallback, useMemo, useState } from 'react';
import type { Node } from 'reactflow';
import type { NodeData } from '@/shared/types';

export interface PrintLogModalState {
  isOpen: boolean;
  nodeId: string | null;
}

export function usePrintLogViewer(nodes: Node<NodeData>[]) {
  const [printLogModalState, setPrintLogModalState] = useState<PrintLogModalState>({ 
    isOpen: false, 
    nodeId: null 
  });

  const handleOpenPrintLogViewer = useCallback((nodeId: string) => {
    setPrintLogModalState({ isOpen: true, nodeId });
  }, []);

  const handleClosePrintLogViewer = useCallback(() => {
    setPrintLogModalState({ isOpen: false, nodeId: null });
  }, []);

  const printNode = useMemo(
    () => (printLogModalState.nodeId 
      ? nodes.find((n) => n.data.identifier.id === printLogModalState.nodeId) ?? null 
      : null),
    [nodes, printLogModalState.nodeId]
  );

  const getPrintNodeData = useCallback(() => {
    if (!printNode) return { 
      name: 'Unknown Print Node', 
      label: 'Debug Output' 
    };
    
    const data = printNode.data as unknown as Partial<{ 
      identifier: { displayName: string };
      label: string; 
    }>;
    
    return {
      name: data.identifier?.displayName || 'Print Node',
      label: (typeof data.label === 'string' ? data.label : 'Debug Output'),
    };
  }, [printNode]);

  return {
    printLogModalState,
    setPrintLogModalState,
    handleOpenPrintLogViewer,
    handleClosePrintLogViewer,
    printNode,
    getPrintNodeData,
  } as const;
}
