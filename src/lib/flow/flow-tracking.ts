// src/lib/flow/flow-tracking.ts - Enhanced with edge filtering support
import type { Node} from "reactflow";
import type { NodeData, NodeLineage } from "@/shared/types/nodes";

// Enhanced edge flow tracking with filtering
export interface EdgeFlow {
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourcePort: string;
  targetPort: string;
  availableNodeIds: string[];    // All nodes that could flow through
  selectedNodeIds: string[];     // User-filtered nodes that actually flow through
  timestamp: number;
}

// Edge filtering state
export interface EdgeFilterState {
  edgeId: string;
  selectedNodes: Set<string>;
  availableNodes: Set<string>;
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

  // Track connection between nodes with filtering
  trackConnection(
    edgeId: string,
    sourceNodeId: string,
    targetNodeId: string,
    sourcePort: string,
    targetPort: string
  ): void {
    // Get available upstream geometry nodes
    const availableNodes = this.getAvailableGeometryNodes(sourceNodeId);
    
    // Default: all available nodes are selected (user can filter later)
    const selectedNodes = [...availableNodes];

    // Create edge flow record
    const edgeFlow: EdgeFlow = {
      edgeId,
      sourceNodeId,
      targetNodeId,
      sourcePort,
      targetPort,
      availableNodeIds: availableNodes,
      selectedNodeIds: selectedNodes,
      timestamp: Date.now()
    };
    
    this.edgeFlows.set(edgeId, edgeFlow);
    
    // Initialize edge filter state
    this.edgeFilters.set(edgeId, {
      edgeId,
      selectedNodes: new Set(selectedNodes),
      availableNodes: new Set(availableNodes)
    });
    
    // Update node lineages
    this.updateNodeLineages(sourceNodeId, targetNodeId, edgeId);
  }

  // Get geometry nodes available to flow through an edge
  private getAvailableGeometryNodes(sourceNodeId: string): string[] {
    const sourceLineage = this.nodeLineages.get(sourceNodeId);
    if (!sourceLineage) {
      // If source has no lineage yet, return just the source if it exists
      return [sourceNodeId];
    }

    // Get all upstream nodes including source
    const allNodeIds = [sourceNodeId, ...sourceLineage.parentNodes];
    
    // Return all node IDs - the UI will filter to geometry nodes
    return [...new Set(allNodeIds)]; // Remove duplicates
  }

  // Enhanced method to get available geometry nodes with node type checking
  getAvailableGeometryNodesForEdge(
    edgeId: string, 
    nodes: Node<NodeData>[]
  ): { available: Node<NodeData>[], selected: Node<NodeData>[] } {
    const edgeFlow = this.edgeFlows.get(edgeId);
    if (!edgeFlow) return { available: [], selected: [] };

    const available = edgeFlow.availableNodeIds
      .map(nodeId => nodes.find(n => n.data.identifier.id === nodeId))
      .filter((node): node is Node<NodeData> => 
        node !== undefined && ['triangle', 'circle', 'rectangle'].includes(node.type!)
      );

    const selected = edgeFlow.selectedNodeIds
      .map(nodeId => nodes.find(n => n.data.identifier.id === nodeId))
      .filter((node): node is Node<NodeData> => node !== undefined);

    return { available, selected };
  }

  // Update which nodes flow through a specific edge (user filtering)
  updateEdgeFiltering(edgeId: string, selectedNodeIds: string[]): void {
    const edgeFlow = this.edgeFlows.get(edgeId);
    const edgeFilter = this.edgeFilters.get(edgeId);
    
    if (!edgeFlow || !edgeFilter) return;

    // Validate that selected nodes are available
    const validSelected = selectedNodeIds.filter(nodeId => 
      edgeFlow.availableNodeIds.includes(nodeId)
    );

    // Update edge flow
    edgeFlow.selectedNodeIds = validSelected;
    edgeFlow.timestamp = Date.now();

    // Update filter state
    edgeFilter.selectedNodes = new Set(validSelected);

    // Propagate changes downstream
    this.propagateFilteringDownstream(edgeId);
  }

  // Propagate filtering changes to downstream edges
  private propagateFilteringDownstream(sourceEdgeId: string): void {
    const sourceEdge = this.edgeFlows.get(sourceEdgeId);
    if (!sourceEdge) return;

    // Find downstream edges from the target node
    const downstreamEdges = Array.from(this.edgeFlows.values())
      .filter(edge => edge.sourceNodeId === sourceEdge.targetNodeId);

    for (const downstreamEdge of downstreamEdges) {
      // Update available nodes for downstream edge
      const newAvailable = sourceEdge.selectedNodeIds;
      
      // Keep only previously selected nodes that are still available
      const stillValid = downstreamEdge.selectedNodeIds.filter(nodeId =>
        newAvailable.includes(nodeId)
      );

      this.updateEdgeAvailability(downstreamEdge.edgeId, newAvailable, stillValid);
    }
  }

  // Update edge availability after upstream changes
  private updateEdgeAvailability(
    edgeId: string, 
    newAvailableIds: string[], 
    newSelectedIds: string[]
  ): void {
    const edgeFlow = this.edgeFlows.get(edgeId);
    const edgeFilter = this.edgeFilters.get(edgeId);
    
    if (!edgeFlow || !edgeFilter) return;

    edgeFlow.availableNodeIds = newAvailableIds;
    edgeFlow.selectedNodeIds = newSelectedIds;
    
    edgeFilter.availableNodes = new Set(newAvailableIds);
    edgeFilter.selectedNodes = new Set(newSelectedIds);
    
    // Continue propagation downstream
    this.propagateFilteringDownstream(edgeId);
  }

  // Get branch availability for smart filtering
  getBranchAvailability(
    sourceNodeId: string, 
    excludeEdgeId?: string
  ): { available: string[], taken: string[] } {
    // Find all outgoing edges from source node
    const outgoingEdges = Array.from(this.edgeFlows.values())
      .filter(edge => 
        edge.sourceNodeId === sourceNodeId && 
        edge.edgeId !== excludeEdgeId
      );

    // Get all nodes already taken by other branches
    const takenNodes = new Set<string>();
    outgoingEdges.forEach(edge => {
      edge.selectedNodeIds.forEach(nodeId => takenNodes.add(nodeId));
    });

    // Get all available nodes from source
    const sourceEdges = Array.from(this.edgeFlows.values())
      .filter(edge => edge.targetNodeId === sourceNodeId);
    
    const allAvailable = new Set<string>();
    sourceEdges.forEach(edge => {
      edge.selectedNodeIds.forEach(nodeId => allAvailable.add(nodeId));
    });

    // Available = all nodes minus taken by other branches
    const available = Array.from(allAvailable).filter(nodeId => !takenNodes.has(nodeId));

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

  // NEW: Public getter for a single edge's flow data
  public getEdgeFlow(edgeId: string): EdgeFlow | undefined {
    return this.edgeFlows.get(edgeId);
  }

  // NEW: Public getter for all edge flow data (for initial state, or full sync)
  public getAllEdgeFlows(): Record<string, EdgeFlow> {
    const result: Record<string, EdgeFlow> = {};
    for (const [edgeId, edgeFlow] of this.edgeFlows.entries()) {
      result[edgeId] = edgeFlow;
    }
    return result;
  }

  // Remove connection tracking
  removeConnection(edgeId: string): void {
    const edgeFlow = this.edgeFlows.get(edgeId);
    if (!edgeFlow) return;

    // Update lineages
    const sourceLineage = this.nodeLineages.get(edgeFlow.sourceNodeId);
    const targetLineage = this.nodeLineages.get(edgeFlow.targetNodeId);

    if (sourceLineage && targetLineage) {
      sourceLineage.childNodes = sourceLineage.childNodes.filter(id => id !== edgeFlow.targetNodeId);
      sourceLineage.flowPath = sourceLineage.flowPath.filter(id => id !== edgeId);
      
      targetLineage.parentNodes = targetLineage.parentNodes.filter(id => id !== edgeFlow.sourceNodeId);
      this.recalculateUpstreamConnections(edgeFlow.targetNodeId);
    }

    // Clean up
    this.edgeFlows.delete(edgeId);
    this.edgeFilters.delete(edgeId);
    
    // Propagate changes downstream
    this.propagateFilteringDownstream(edgeFlow.targetNodeId);
  }

  // Remove node tracking
  removeNode(nodeId: string): void {
    const lineage = this.nodeLineages.get(nodeId);
    if (!lineage) return;

    // Remove from all connected nodes and clean up edges
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

  // Helper methods
  private updateNodeLineages(sourceNodeId: string, targetNodeId: string, edgeId: string): void {
    const sourceLineage = this.nodeLineages.get(sourceNodeId);
    const targetLineage = this.nodeLineages.get(targetNodeId);
    
    if (sourceLineage && targetLineage) {
      sourceLineage.childNodes.push(targetNodeId);
      sourceLineage.flowPath.push(edgeId);
      
      targetLineage.parentNodes.push(sourceNodeId);
      
      // Propagate upstream nodes to target
      const upstreamNodes = this.getUpstreamNodeIds(sourceNodeId);
      upstreamNodes.forEach(upstreamId => {
        if (!targetLineage.parentNodes.includes(upstreamId)) {
          targetLineage.parentNodes.push(upstreamId);
        }
      });
    }
  }

  private getUpstreamNodeIds(nodeId: string): string[] {
    const lineage = this.nodeLineages.get(nodeId);
    if (!lineage) return [nodeId];
    
    const upstream = new Set([nodeId]);
    lineage.parentNodes.forEach(parentId => {
      this.getUpstreamNodeIds(parentId).forEach(id => upstream.add(id));
    });
    
    return Array.from(upstream);
  }

  private recalculateUpstreamConnections(nodeId: string): void {
    const lineage = this.nodeLineages.get(nodeId);
    if (!lineage) return;

    const directParents = [...lineage.parentNodes];
    lineage.parentNodes = [];

    directParents.forEach(parentId => {
      if (this.hasDirectConnection(parentId, nodeId)) {
        lineage.parentNodes.push(parentId);
        
        this.getUpstreamNodeIds(parentId).forEach(upstreamId => {
          if (upstreamId !== nodeId && !lineage.parentNodes.includes(upstreamId)) {
            lineage.parentNodes.push(upstreamId);
          }
        });
      }
    });
  }

  private hasDirectConnection(sourceId: string, targetId: string): boolean {
    return Array.from(this.edgeFlows.values()).some(
      flow => flow.sourceNodeId === sourceId && flow.targetNodeId === targetId
    );
  }
}