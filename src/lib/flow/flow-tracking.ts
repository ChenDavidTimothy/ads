// src/lib/flow/flow-tracking.ts - Updated with hasEdge method
import type { Node} from "reactflow";
import type { NodeData, NodeLineage } from "@/shared/types/nodes";

// Enhanced edge flow tracking with filtering - REMOVED availableNodeIds
export interface EdgeFlow {
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourcePort: string;
  targetPort: string;
  selectedNodeIds: string[];     // User-filtered nodes that actually flow through
  timestamp: number;
}

// Edge filtering state - REMOVED availableNodes
export interface EdgeFilterState {
  edgeId: string;
  selectedNodes: Set<string>;
}

export class FlowTracker {
  private nodeLineages = new Map<string, NodeLineage>();
  private edgeFlows = new Map<string, EdgeFlow>();
  private edgeFilters = new Map<string, EdgeFilterState>();

  // Initialize tracking for a new node
  trackNodeCreation(nodeId: string): void {
    this.nodeLineages.set(nodeId, {
      parentNodes: [],
      childNodes: [],
      flowPath: []
    });
  }

  // Check if an edge is being tracked by FlowTracker
  hasEdge(edgeId: string): boolean {
    return this.edgeFlows.has(edgeId);
  }

  // Track connection between nodes with filtering
  trackConnection(
    edgeId: string,
    sourceNodeId: string,
    targetNodeId: string,
    sourcePort: string,
    targetPort: string,
    nodes: Node<NodeData>[]
  ): void {
    // Calculate available objects dynamically for initial selection
    const availableGeometryIds = this._getUpstreamGeometryObjects(sourceNodeId, nodes);
    
    // Create edge flow record with all available objects selected by default
    const edgeFlow: EdgeFlow = {
      edgeId,
      sourceNodeId,
      targetNodeId,
      sourcePort,
      targetPort,
      selectedNodeIds: availableGeometryIds, // Default: all available objects selected
      timestamp: Date.now()
    };
    
    this.edgeFlows.set(edgeId, edgeFlow);
    
    // Initialize edge filter state
    this.edgeFilters.set(edgeId, {
      edgeId,
      selectedNodes: new Set(availableGeometryIds)
    });
    
    // Update node lineages for basic topology tracking
    this.updateNodeLineages(sourceNodeId, targetNodeId, edgeId);
  }

  // Dynamic upstream geometry traversal
  private _getUpstreamGeometryObjects(targetNodeId: string, nodes: Node<NodeData>[]): string[] {
    const visited = new Set<string>();
    const geometryObjects = new Set<string>();
    
    const traverse = (nodeId: string): void => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      
      // Find the node object to check its type
      const node = nodes.find(n => n.data.identifier.id === nodeId);
      if (!node) return;
      
      // If this is a geometry node, add it to results
      if (['triangle', 'circle', 'rectangle'].includes(node.type!)) {
        geometryObjects.add(nodeId);
        return; // Don't traverse further upstream from geometry nodes
      }
      
      // Find all edges that target this node
      const incomingEdges = Array.from(this.edgeFlows.values())
        .filter(edge => edge.targetNodeId === nodeId);
      
      // Recursively traverse upstream from each source
      for (const edge of incomingEdges) {
        traverse(edge.sourceNodeId);
      }
    };
    
    traverse(targetNodeId);
    return Array.from(geometryObjects);
  }

  // Dynamic availability calculation
  getAvailableGeometryNodesForEdge(
    edgeId: string, 
    nodes: Node<NodeData>[]
  ): { available: Node<NodeData>[], selected: Node<NodeData>[] } {
    const edgeFlow = this.edgeFlows.get(edgeId);
    if (!edgeFlow) return { available: [], selected: [] };

    // Calculate available objects dynamically by traversing upstream from source node
    const availableGeometryIds = this._getUpstreamGeometryObjects(edgeFlow.sourceNodeId, nodes);
    
    const available = availableGeometryIds
      .map(nodeId => nodes.find(n => n.data.identifier.id === nodeId))
      .filter((node): node is Node<NodeData> => node !== undefined);

    const selected = edgeFlow.selectedNodeIds
      .map(nodeId => nodes.find(n => n.data.identifier.id === nodeId))
      .filter((node): node is Node<NodeData> => node !== undefined);

    return { available, selected };
  }

  // RENAMED: Get selected node IDs for edge (was getAvailableNodeIds)
  getSelectedNodeIds(edgeId: string): string[] {
    const edgeFlow = this.edgeFlows.get(edgeId);
    return edgeFlow?.selectedNodeIds ?? [];
  }

  // Update which nodes flow through a specific edge
  updateEdgeFiltering(edgeId: string, selectedNodeIds: string[]): void {
    const edgeFlow = this.edgeFlows.get(edgeId);
    const edgeFilter = this.edgeFilters.get(edgeId);
    
    if (!edgeFlow || !edgeFilter) return;

    // Update edge flow selections
    edgeFlow.selectedNodeIds = selectedNodeIds;
    edgeFlow.timestamp = Date.now();

    // Update filter state
    edgeFilter.selectedNodes = new Set(selectedNodeIds);
  }

  // CORRECTED: Get branch availability for smart filtering
  getBranchAvailability(
    sourceNodeId: string, 
    excludeEdgeId?: string,
    nodes?: Node<NodeData>[]
  ): { available: string[], taken: string[] } {
    // Get the target of the excluded edge to identify true parallel branches
    let excludeTargetNodeId: string | undefined;
    if (excludeEdgeId) {
      const excludeEdge = this.edgeFlows.get(excludeEdgeId);
      excludeTargetNodeId = excludeEdge?.targetNodeId;
    }

    // Find all outgoing edges from source node that target DIFFERENT nodes (true parallel branches)
    const parallelBranches = Array.from(this.edgeFlows.values())
      .filter(edge => 
        edge.sourceNodeId === sourceNodeId && 
        edge.edgeId !== excludeEdgeId &&
        edge.targetNodeId !== excludeTargetNodeId // Only true parallel branches
      );

    // Get all nodes taken by true parallel branches
    const takenNodes = new Set<string>();
    parallelBranches.forEach(edge => {
      edge.selectedNodeIds.forEach(nodeId => takenNodes.add(nodeId));
    });

    // Get all objects that can reach this source node (available for this branch)
    let allAvailableNodes: string[] = [];
    if (nodes) {
      allAvailableNodes = this._getUpstreamGeometryObjects(sourceNodeId, nodes);
    }

    // Available = all objects that can reach sourceNodeId minus taken by parallel branches
    const available = allAvailableNodes.filter(nodeId => !takenNodes.has(nodeId));

    return {
      available,
      taken: Array.from(takenNodes)
    };
  }

  // Get nodes actually flowing through specific edge (for execution)
  getNodesFlowingThroughEdge(edgeId: string): string[] {
    const edgeFlow = this.edgeFlows.get(edgeId);
    return edgeFlow?.selectedNodeIds ?? [];
  }

  // Remove connection tracking
  removeConnection(edgeId: string): void {
    const edgeFlow = this.edgeFlows.get(edgeId);
    if (!edgeFlow) return;

    // Update basic topology lineages
    const sourceLineage = this.nodeLineages.get(edgeFlow.sourceNodeId);
    const targetLineage = this.nodeLineages.get(edgeFlow.targetNodeId);

    if (sourceLineage && targetLineage) {
      sourceLineage.childNodes = sourceLineage.childNodes.filter(id => id !== edgeFlow.targetNodeId);
      sourceLineage.flowPath = sourceLineage.flowPath.filter(id => id !== edgeId);
      
      targetLineage.parentNodes = targetLineage.parentNodes.filter(id => id !== edgeFlow.sourceNodeId);
      this.recalculateUpstreamConnections(edgeFlow.targetNodeId);
    }

    // Clean up edge records
    this.edgeFlows.delete(edgeId);
    this.edgeFilters.delete(edgeId);
  }

  // Remove node tracking
  removeNode(nodeId: string): void {
    const lineage = this.nodeLineages.get(nodeId);
    if (!lineage) return;

    // Remove from all connected nodes
    lineage.childNodes.forEach(childId => {
      const childLineage = this.nodeLineages.get(childId);
      if (childLineage) {
        childLineage.parentNodes = childLineage.parentNodes.filter(id => id !== nodeId);
        this.recalculateUpstreamConnections(childId);
      }
    });

    lineage.parentNodes.forEach(parentId => {
      const parentLineage = this.nodeLineages.get(parentId);
      if (parentLineage) {
        parentLineage.childNodes = parentLineage.childNodes.filter(id => id !== nodeId);
      }
    });

    // Remove related edge flows
    const relatedEdges = Array.from(this.edgeFlows.values())
      .filter(edge => edge.sourceNodeId === nodeId || edge.targetNodeId === nodeId);
    
    relatedEdges.forEach(edge => {
      this.edgeFlows.delete(edge.edgeId);
      this.edgeFilters.delete(edge.edgeId);
    });

    this.nodeLineages.delete(nodeId);
  }

  // Validate display name uniqueness
  validateDisplayName(
    newName: string, 
    currentNodeId: string, 
    nodes: Node<NodeData>[]
  ): string | null {
    if (!newName.trim()) {
      return "Name cannot be empty";
    }
    
    const duplicate = nodes.find(node => 
      node.data.identifier.id !== currentNodeId && 
      node.data.identifier.displayName.toLowerCase() === newName.toLowerCase()
    );
    
    return duplicate ? "Name already exists" : null;
  }

  // SIMPLIFIED: Update node lineages for basic topology tracking only
  private updateNodeLineages(sourceNodeId: string, targetNodeId: string, edgeId: string): void {
    const sourceLineage = this.nodeLineages.get(sourceNodeId);
    const targetLineage = this.nodeLineages.get(targetNodeId);
    
    if (sourceLineage && targetLineage) {
      // Update basic parent-child relationships
      if (!sourceLineage.childNodes.includes(targetNodeId)) {
        sourceLineage.childNodes.push(targetNodeId);
      }
      if (!sourceLineage.flowPath.includes(edgeId)) {
        sourceLineage.flowPath.push(edgeId);
      }
      
      if (!targetLineage.parentNodes.includes(sourceNodeId)) {
        targetLineage.parentNodes.push(sourceNodeId);
      }
    }
  }

  // SIMPLIFIED: Recalculate upstream connections for basic topology only
  private recalculateUpstreamConnections(nodeId: string): void {
    const lineage = this.nodeLineages.get(nodeId);
    if (!lineage) return;

    // Clear and rebuild parent relationships based on current edges
    lineage.parentNodes = [];
    
    const incomingEdges = Array.from(this.edgeFlows.values())
      .filter(edge => edge.targetNodeId === nodeId);
    
    incomingEdges.forEach(edge => {
      if (!lineage.parentNodes.includes(edge.sourceNodeId)) {
        lineage.parentNodes.push(edge.sourceNodeId);
      }
    });
  }
}