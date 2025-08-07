// src/lib/flow/flow-tracking.ts - Simplified to basic topology tracking only
import type { Node} from "reactflow";
import type { NodeData, NodeLineage } from "@/shared/types/nodes";

export class FlowTracker {
  private nodeLineages = new Map<string, NodeLineage>();

  // Initialize tracking for a new node
  trackNodeCreation(nodeId: string): void {
    this.nodeLineages.set(nodeId, {
      parentNodes: [],
      childNodes: [],
      flowPath: []
    });
  }

  // Track basic connection between nodes for topology only
  trackConnection(
    edgeId: string,
    sourceNodeId: string,
    targetNodeId: string,
    sourcePort: string,
    targetPort: string,
    nodes: Node<NodeData>[]
  ): void {
    // Update node lineages for basic topology tracking only
    this.updateNodeLineages(sourceNodeId, targetNodeId, edgeId);
  }

  // Remove connection tracking
  removeConnection(edgeId: string): void {
    // Find nodes affected by this edge removal
    for (const [nodeId, lineage] of this.nodeLineages.entries()) {
      if (lineage.flowPath.includes(edgeId)) {
        // Remove this edge from flow path
        lineage.flowPath = lineage.flowPath.filter(id => id !== edgeId);
        
        // Recalculate connections for this node
        this.recalculateUpstreamConnections(nodeId);
      }
    }
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

  // Update node lineages for basic topology tracking only
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

  // Recalculate upstream connections for basic topology only
  private recalculateUpstreamConnections(nodeId: string): void {
    const lineage = this.nodeLineages.get(nodeId);
    if (!lineage) return;

    // Clear and rebuild parent relationships based on current flow paths
    lineage.parentNodes = [];
    
    // Find all edges in flow paths that target this node
    for (const [otherNodeId, otherLineage] of this.nodeLineages.entries()) {
      if (otherLineage.childNodes.includes(nodeId)) {
        if (!lineage.parentNodes.includes(otherNodeId)) {
          lineage.parentNodes.push(otherNodeId);
        }
      }
    }
  }
}