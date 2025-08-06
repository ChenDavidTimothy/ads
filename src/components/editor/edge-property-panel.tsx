// src/components/editor/edge-property-panel.tsx
"use client";

import { useCallback, useMemo } from "react";
import type { Node } from "reactflow";
import type { NodeData } from "@/shared/types/nodes";
import type { FlowTracker, EdgeFlow } from "@/lib/flow/flow-tracking";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { X } from "lucide-react";

interface EdgePropertyPanelProps {
  edgeId: string;
  nodes: Node<NodeData>[];
  flowTracker: FlowTracker;
  activeEdgeFilters: Record<string, string[]>;
  onFilterChange: (edgeId: string, newSelectedNodeIds: string[]) => void;
  onClosePanel: () => void;
}

export function EdgePropertyPanel({
  edgeId,
  nodes,
  flowTracker,
  activeEdgeFilters,
  onFilterChange,
  onClosePanel,
}: EdgePropertyPanelProps) {
  const edgeFlow: EdgeFlow | undefined = flowTracker.getEdgeFlow(edgeId);
  
  // Debug info for troubleshooting
  const debugInfo = useMemo(() => {
    const allEdgeFlows = flowTracker.getAllEdgeFlows();
    return {
      requestedEdgeId: edgeId,
      edgeFlowFound: !!edgeFlow,
      allEdgeIds: Object.keys(allEdgeFlows),
      totalNodes: nodes.length,
      geometryNodeCount: nodes.filter(n => ['triangle', 'circle', 'rectangle'].includes(n.type!)).length
    };
  }, [edgeId, edgeFlow, flowTracker, nodes]);

  // Determine source and target node display names for header
  const sourceNode = nodes.find(n => n.id === edgeFlow?.sourceNodeId);
  const targetNode = nodes.find(n => n.id === edgeFlow?.targetNodeId);
  
  const headerTitle = edgeFlow 
    ? `${sourceNode?.data.identifier.displayName || 'Unknown'} → ${targetNode?.data.identifier.displayName || 'Unknown'}`
    : `Edge Properties`;

  // Compute displayable objects and their states
  const { displayableObjects, currentSelectedIds } = useMemo(() => {
    if (!edgeFlow) {
      return { 
        displayableObjects: [], 
        currentSelectedIds: [] 
      };
    }

    try {
      // Get objects available to flow through this specific edge
      const { available: objectsAvailableToThisEdge } = flowTracker.getAvailableGeometryNodesForEdge(edgeId, nodes);
      
      // Get objects taken by parallel branches from the same source node
      const branchInfo = flowTracker.getBranchAvailability(edgeFlow.sourceNodeId, edgeId);
      const takenObjectsIds = branchInfo.taken;

      // Map available geometry nodes to display objects with enable/disable state
      const displayObjects = objectsAvailableToThisEdge.map(node => ({
        id: node.data.identifier.id,
        displayName: node.data.identifier.displayName,
        nodeType: node.type || 'unknown',
        // Object is enabled if it's not taken by a parallel branch
        isEnabled: !takenObjectsIds.includes(node.data.identifier.id), 
      }));

      // Get current selected state from React state (source of truth)
      const selectedIdsForThisEdge = activeEdgeFilters[edgeId] || [];

      return {
        displayableObjects: displayObjects,
        currentSelectedIds: selectedIdsForThisEdge,
      };
    } catch (error) {
      console.error('Error computing displayable objects:', error);
      return { 
        displayableObjects: [], 
        currentSelectedIds: [] 
      };
    }
  }, [edgeId, nodes, flowTracker, edgeFlow, activeEdgeFilters]);

  // Handler for individual checkbox changes
  const handleCheckboxChange = useCallback((objectId: string, isChecked: boolean) => {
    const newSelection = isChecked
      ? [...currentSelectedIds, objectId]
      : currentSelectedIds.filter(id => id !== objectId);
    onFilterChange(edgeId, newSelection);
  }, [currentSelectedIds, edgeId, onFilterChange]);

  // Handler for "Select All Enabled" button
  const handleSelectAll = useCallback(() => {
    const allEnabledObjectIds = displayableObjects
      .filter(obj => obj.isEnabled)
      .map(obj => obj.id);
    onFilterChange(edgeId, allEnabledObjectIds);
  }, [displayableObjects, edgeId, onFilterChange]);

  // Handler for "Deselect All" button
  const handleDeselectAll = useCallback(() => {
    onFilterChange(edgeId, []);
  }, [edgeId, onFilterChange]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">{headerTitle}</h3>
        <Button variant="ghost" size="sm" onClick={onClosePanel}>
          <X size={16} />
        </Button>
      </div>

      {/* Debug info when no edge flow found */}
      {!edgeFlow && (
        <div className="bg-red-900/20 border border-red-500/30 rounded p-3 text-sm">
          <div className="text-red-400 font-medium mb-2">Debug Information:</div>
          <div className="text-gray-300 space-y-1 text-xs">
            <div>Requested Edge ID: <span className="font-mono">{debugInfo.requestedEdgeId}</span></div>
            <div>Available Edge IDs: <span className="font-mono">{debugInfo.allEdgeIds.join(', ')}</span></div>
            <div>Total Nodes: {debugInfo.totalNodes}</div>
            <div>Geometry Nodes: {debugInfo.geometryNodeCount}</div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <p className="text-sm text-gray-400">
        Select which geometry objects flow through this path:
      </p>

      {/* Action Buttons */}
      {displayableObjects.length > 0 && (
        <div className="flex gap-2 mb-4">
          <Button onClick={handleSelectAll} size="sm">
            Select All Enabled
          </Button>
          <Button onClick={handleDeselectAll} variant="secondary" size="sm">
            Deselect All
          </Button>
        </div>
      )}

      {/* Object List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {!edgeFlow ? (
          <p className="text-gray-500 text-sm">
            Edge data not found. This may indicate a tracking issue.
          </p>
        ) : displayableObjects.length === 0 ? (
          <p className="text-gray-500 text-sm">
            No geometry objects available to filter on this edge. 
            Make sure geometry nodes are connected upstream.
          </p>
        ) : (
          displayableObjects.map(obj => (
            <div key={obj.id} className="flex items-center space-x-2 p-2 rounded hover:bg-gray-750 border border-transparent hover:border-gray-600">
              <Checkbox
                id={`filter-${obj.id}`}
                checked={currentSelectedIds.includes(obj.id)}
                onCheckedChange={(checked) => handleCheckboxChange(obj.id, !!checked)}
                disabled={!obj.isEnabled}
                className={obj.isEnabled ? '' : 'opacity-50 cursor-not-allowed'}
              />
              <label
                htmlFor={`filter-${obj.id}`}
                className={`flex-1 text-sm font-medium cursor-pointer ${
                  obj.isEnabled ? 'text-white' : 'text-gray-500 line-through'
                }`}
              >
                <span>{obj.displayName}</span>
                <span className="text-xs text-gray-400 ml-2">({obj.nodeType})</span>
                {!obj.isEnabled && <span className="text-xs text-orange-400 ml-2">(Used in Parallel Branch)</span>}
              </label>
            </div>
          ))
        )}
      </div>

      {/* Summary Information */}
      {edgeFlow && displayableObjects.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-600">
          <div className="text-xs text-gray-400 space-y-1">
            <div className="flex justify-between">
              <span>Available:</span>
              <span className="text-white">{displayableObjects.filter(obj => obj.isEnabled).length}</span>
            </div>
            <div className="flex justify-between">
              <span>Selected:</span>
              <span className="text-green-400">{currentSelectedIds.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Blocked:</span>
              <span className="text-orange-400">{displayableObjects.filter(obj => !obj.isEnabled).length}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}