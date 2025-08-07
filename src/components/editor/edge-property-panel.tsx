// src/components/editor/edge-property-panel.tsx
"use client";

import { useMemo, useCallback } from "react";
import type { Edge } from "reactflow";
import type { Node } from "reactflow";
import type { NodeData } from "@/shared/types";
import type { FlowTracker } from "@/lib/flow/flow-tracking";

interface EdgePropertyPanelProps {
  edge: Edge;
  flowTracker: FlowTracker;
  nodes: Node<NodeData>[];
  onEdgeFilterChange: (edgeId: string, selectedNodeIds: string[]) => void;
  renderTrigger: number;
}

interface ObjectState {
  node: Node<NodeData>;
  status: 'available' | 'selected' | 'taken';
}

function categorizeObjectsByAvailability(
  edge: Edge,
  flowTracker: FlowTracker,
  nodes: Node<NodeData>[]
): ObjectState[] {
  try {
    // Get available and selected objects for this edge (now uses dynamic calculation)
    const edgeData = flowTracker.getAvailableGeometryNodesForEdge(edge.id, nodes);
    
    // Get branch availability to identify taken objects
    const branchData = flowTracker.getBranchAvailability(edge.source, edge.id, nodes);
    
    // Create sets for efficient lookup
    const selectedIds = new Set(edgeData.selected.map(node => node.data.identifier.id));
    const takenIds = new Set(branchData.taken);
    
    // Combine all relevant objects
    const allRelevantObjects = new Map<string, Node<NodeData>>();
    
    // Add available objects (now dynamically calculated)
    edgeData.available.forEach(node => {
      allRelevantObjects.set(node.data.identifier.id, node);
    });
    
    // Add taken objects (find them in nodes array)
    branchData.taken.forEach(takenId => {
      const takenNode = nodes.find(node => node.data.identifier.id === takenId);
      if (takenNode && ['triangle', 'circle', 'rectangle'].includes(takenNode.type!)) {
        allRelevantObjects.set(takenId, takenNode);
      }
    });
    
    // Categorize objects by status
    const categorizedObjects: ObjectState[] = [];
    
    allRelevantObjects.forEach((node) => {
      const nodeId = node.data.identifier.id;
      
      let status: ObjectState['status'];
      if (selectedIds.has(nodeId)) {
        status = 'selected';
      } else if (takenIds.has(nodeId)) {
        status = 'taken';
      } else {
        status = 'available';
      }
      
      categorizedObjects.push({ node, status });
    });
    
    // Sort by status priority (selected first, then available, then taken)
    return categorizedObjects.sort((a, b) => {
      const statusOrder = { selected: 0, available: 1, taken: 2 };
      return statusOrder[a.status] - statusOrder[b.status];
    });
    
  } catch (error) {
    console.warn('Error categorizing objects for edge', edge.id, error);
    return [];
  }
}

function getStatusIcon(status: ObjectState['status']): string {
  switch (status) {
    case 'selected':
      return '✓';
    case 'available':
      return '○';
    case 'taken':
      return '✕';
  }
}

function getStatusLabel(status: ObjectState['status']): string {
  switch (status) {
    case 'selected':
      return 'currently selected';
    case 'available':
      return 'available';
    case 'taken':
      return 'used by parallel path';
  }
}

function getStatusClassName(status: ObjectState['status']): string {
  switch (status) {
    case 'selected':
      return 'text-green-400 font-medium';
    case 'available':
      return 'text-white';
    case 'taken':
      return 'text-gray-500 italic';
  }
}

export function EdgePropertyPanel({ edge, flowTracker, nodes, onEdgeFilterChange, renderTrigger }: EdgePropertyPanelProps) {
  const objectStates = useMemo(
    () => categorizeObjectsByAvailability(edge, flowTracker, nodes),
    [edge, flowTracker, nodes, renderTrigger]
  );

  const statusCounts = useMemo(() => {
    const counts = { available: 0, selected: 0, taken: 0 };
    objectStates.forEach(obj => counts[obj.status]++);
    return counts;
  }, [objectStates]);

  // Get current selected node IDs for this edge
  const currentSelectedIds = useMemo(() => {
    return flowTracker.getSelectedNodeIds(edge.id);
  }, [flowTracker, edge.id, objectStates]); // Include objectStates to trigger updates

  // Individual object toggle handler
  const handleObjectToggle = useCallback((objectId: string, currentlySelected: boolean) => {
    const newSelectedIds = currentlySelected
      ? currentSelectedIds.filter(id => id !== objectId)
      : [...currentSelectedIds, objectId];
    onEdgeFilterChange(edge.id, newSelectedIds);
  }, [currentSelectedIds, edge.id, onEdgeFilterChange]);

  // Bulk selection handlers
  const handleSelectAll = useCallback(() => {
    const availableAndSelectedIds = objectStates
      .filter(obj => obj.status === 'available' || obj.status === 'selected')
      .map(obj => obj.node.data.identifier.id);
    onEdgeFilterChange(edge.id, availableAndSelectedIds);
  }, [objectStates, edge.id, onEdgeFilterChange]);

  const handleDeselectAll = useCallback(() => {
    onEdgeFilterChange(edge.id, []);
  }, [edge.id, onEdgeFilterChange]);

  // Button states
  const availableObjects = objectStates.filter(obj => obj.status === 'available');
  const selectedObjects = objectStates.filter(obj => obj.status === 'selected');
  const canSelectAll = availableObjects.length > 0;
  const canDeselectAll = selectedObjects.length > 0;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white mb-4">
        Edge Properties
      </h3>
      
      {/* Basic Edge Information */}
      <div className="space-y-3 pb-4 border-b border-gray-600">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Source:</span>
          <span className="text-sm text-white font-mono">{edge.source}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Target:</span>
          <span className="text-sm text-white font-mono">{edge.target}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Edge ID:</span>
          <span className="text-xs text-white font-mono">{edge.id}</span>
        </div>

        {edge.sourceHandle && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Source Port:</span>
            <span className="text-xs text-white font-mono">{edge.sourceHandle}</span>
          </div>
        )}

        {edge.targetHandle && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Target Port:</span>
            <span className="text-xs text-white font-mono">{edge.targetHandle}</span>
          </div>
        )}
      </div>

      {/* Object Flow Information */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-white">Objects Available for This Path</h4>
          <span className="text-xs text-gray-400">
            {objectStates.length} total
          </span>
        </div>

        {/* Status Summary */}
        {objectStates.length > 0 && (
          <div className="flex gap-4 text-xs">
            <span className="text-green-400">
              ✓ {statusCounts.selected} selected
            </span>
            <span className="text-white">
              ○ {statusCounts.available} available
            </span>
            <span className="text-gray-500">
              ✕ {statusCounts.taken} taken
            </span>
          </div>
        )}

        {/* Object List */}
        <div className="space-y-2">
          {objectStates.length === 0 ? (
            <div className="text-sm text-gray-500 italic">
              No geometry objects available for this path
            </div>
          ) : (
            <>
              {/* Bulk Selection Controls */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={handleSelectAll}
                  disabled={!canSelectAll}
                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
                >
                  Select All
                </button>
                <button
                  onClick={handleDeselectAll}
                  disabled={!canDeselectAll}
                  className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-600"
                >
                  Deselect All
                </button>
              </div>

              {/* Interactive Object List */}
              <ul className="space-y-2">
                {objectStates.map(({ node, status }) => {
                  const isSelected = status === 'selected';
                  const isDisabled = status === 'taken';
                  
                  return (
                    <li
                      key={node.data.identifier.id}
                      className={`flex items-center gap-3 text-sm p-2 rounded ${
                        isDisabled ? 'bg-gray-700 opacity-60' : 'bg-gray-700/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isDisabled}
                        onChange={(e) => handleObjectToggle(node.data.identifier.id, isSelected)}
                        className={`w-4 h-4 rounded border-2 ${
                          isDisabled 
                            ? 'border-gray-500 cursor-not-allowed' 
                            : 'border-gray-400 cursor-pointer focus:ring-2 focus:ring-blue-500'
                        }`}
                      />
                      
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="flex-shrink-0">
                          {getStatusIcon(status)}
                        </span>
                        <span className={`truncate ${getStatusClassName(status)}`}>
                          {node.data.identifier.displayName}
                        </span>
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          ({node.type})
                        </span>
                      </div>
                      
                      <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                        {getStatusLabel(status)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        {objectStates.length > 0 && statusCounts.taken > 0 && (
          <div className="text-xs text-gray-500 mt-2 p-2 bg-gray-700 rounded">
            <strong>Note:</strong> Objects marked as "used by parallel path" are already selected 
            on other connections from the same source node and cannot be selected here.
          </div>
        )}
      </div>
    </div>
  );
}