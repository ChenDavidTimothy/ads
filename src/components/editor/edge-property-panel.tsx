// src/components/editor/edge-property-panel.tsx
"use client";

import { useMemo } from "react";
import type { Edge, Node } from "reactflow";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NodeData } from "@/lib/types/nodes";
import type { FlowTracker } from "@/lib/flow/flow-tracking";

interface EdgePropertyPanelProps {
  edge: Edge;
  nodes: Node<NodeData>[];
  flowTracker: FlowTracker;
  onUpdateFiltering: (edgeId: string, selectedNodeIds: string[]) => void;
}

export function EdgePropertyPanel({ 
  edge, 
  nodes, 
  flowTracker, 
  onUpdateFiltering 
}: EdgePropertyPanelProps) {
  const { available, selected } = useMemo(() => {
    return flowTracker.getAvailableGeometryNodesForEdge(edge.id, nodes);
  }, [edge.id, nodes, flowTracker]);

  const selectedNodeIds = useMemo(() => {
    return flowTracker.getNodesFlowingThroughEdge(edge.id);
  }, [edge.id, flowTracker]);

  const sourceNode = nodes.find(n => n.data.identifier.id === edge.source);
  const targetNode = nodes.find(n => n.data.identifier.id === edge.target);

  const handleToggleNode = (nodeId: string) => {
    const currentSelected = new Set(selectedNodeIds);
    
    if (currentSelected.has(nodeId)) {
      currentSelected.delete(nodeId);
    } else {
      currentSelected.add(nodeId);
    }
    
    onUpdateFiltering(edge.id, Array.from(currentSelected));
  };

  const handleSelectAll = () => {
    onUpdateFiltering(edge.id, available.map(n => n.data.identifier.id));
  };

  const handleSelectNone = () => {
    onUpdateFiltering(edge.id, []);
  };

  const getNodeTypeIcon = (nodeType: string) => {
    switch (nodeType) {
      case 'triangle': return '▲';
      case 'circle': return '●';
      case 'rectangle': return '▬';
      default: return '?';
    }
  };

  const getNodeTypeColor = (nodeType: string) => {
    switch (nodeType) {
      case 'triangle': return 'text-red-400';
      case 'circle': return 'text-blue-400';
      case 'rectangle': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3 pb-4 border-b border-gray-600">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Connection Path
          </label>
          <div className="text-xs text-gray-400 space-y-1">
            <div>From: {sourceNode?.data.identifier.displayName || 'Unknown'}</div>
            <div>To: {targetNode?.data.identifier.displayName || 'Unknown'}</div>
            <div>Edge ID: {edge.id}</div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-300">
            Object Flow Filtering
          </label>
          <div className="text-xs text-gray-400">
            {selectedNodeIds.length}/{available.length} objects
          </div>
        </div>

        {available.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-4">
            No geometry objects available on this path
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <Button
                onClick={handleSelectAll}
                variant="ghost"
                size="sm"
                className="text-xs"
              >
                Select All
              </Button>
              <Button
                onClick={handleSelectNone}
                variant="ghost"
                size="sm"
                className="text-xs"
              >
                Select None
              </Button>
            </div>

            <div className="space-y-2">
              {available.map((node) => {
                const isSelected = selectedNodeIds.includes(node.data.identifier.id);
                const nodeColor = (node.data as Record<string, unknown>).color as string;
                
                return (
                  <div
                    key={node.data.identifier.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer",
                      isSelected 
                        ? "border-blue-500 bg-blue-500/10" 
                        : "border-gray-600 bg-gray-700/50 hover:border-gray-500"
                    )}
                    onClick={() => handleToggleNode(node.data.identifier.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-lg", getNodeTypeColor(node.type!))}>
                          {getNodeTypeIcon(node.type!)}
                        </span>
                        <div 
                          className="w-4 h-4 rounded border border-gray-400"
                          style={{ backgroundColor: nodeColor }}
                        />
                      </div>
                      
                      <div>
                        <div className="text-sm font-medium text-white">
                          {node.data.identifier.displayName}
                        </div>
                        <div className="text-xs text-gray-400">
                          {node.type} • #{node.data.identifier.sequence}
                        </div>
                      </div>
                    </div>

                    <div className={cn(
                      "w-5 h-5 border-2 rounded flex items-center justify-center",
                      isSelected 
                        ? "border-blue-500 bg-blue-500" 
                        : "border-gray-400"
                    )}>
                      {isSelected && (
                        <span className="text-white text-xs">✓</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="mt-4 p-3 bg-gray-700/50 rounded-lg">
          <div className="text-xs text-gray-300 space-y-1">
            <div className="font-medium">How Flow Filtering Works:</div>
            <div>• Selected objects flow through this connection</div>
            <div>• Unselected objects are filtered out</div>
            <div>• Target node only processes selected objects</div>
            <div>• Changes propagate to downstream connections</div>
          </div>
        </div>
      </div>
    </div>
  );
}