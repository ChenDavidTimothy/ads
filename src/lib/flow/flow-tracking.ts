// src/lib/flow/flow-tracking.ts - Registry-aware flow tracking with consistent ID handling
import type { Node, Edge } from "reactflow";
import type { NodeData, NodeLineage } from "@/shared/types/nodes";
import { getNodeDefinition, getNodesByCategory } from "@/shared/registry/registry-utils";

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

  // Track connection between nodes using registry for validation
  trackConnection(
    edgeId: string,
    sourceNodeId: string,
    targetNodeId: string,
    sourcePort: string,
    targetPort: string,
    nodes: Node<NodeData>[]
  ): void {
    // Registry-aware connection validation
    const sourceNode = nodes.find(n => n.data.identifier.id === sourceNodeId);
    const targetNode = nodes.find(n => n.data.identifier.id === targetNodeId);
    
    if (!sourceNode || !targetNode) {
      console.warn(`Connection tracking failed: Node not found`);
      return;
    }

    const sourceDefinition = getNodeDefinition(sourceNode.type!);
    const targetDefinition = getNodeDefinition(targetNode.type!);
    
    if (!sourceDefinition || !targetDefinition) {
      console.warn(`Connection tracking failed: Node definition not found`);
      return;
    }

    // Validate port compatibility using registry definitions
    const sourcePortDef = sourceDefinition.ports.outputs.find(p => p.id === sourcePort);
    const targetPortDef = targetDefinition.ports.inputs.find(p => p.id === targetPort);
    
    if (!sourcePortDef || !targetPortDef) {
      console.warn(`Connection tracking failed: Port definition not found`);
      return;
    }

    // Update node lineages for topology tracking
    this.updateNodeLineages(sourceNodeId, targetNodeId, edgeId);
  }

  // Remove connection tracking
  removeConnection(edgeId: string): void {
    for (const [nodeId, lineage] of this.nodeLineages.entries()) {
      if (lineage.flowPath.includes(edgeId)) {
        lineage.flowPath = lineage.flowPath.filter(id => id !== edgeId);
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

  // CRITICAL FIX: Registry-aware geometry object discovery with consistent ID handling
  getUpstreamGeometryObjects(
    nodeId: string, 
    allNodes: Node<NodeData>[], 
    allEdges: Edge[]
  ): Node<NodeData>[] {
    const geometryNodes: Node<NodeData>[] = [];
    const visited = new Set<string>();
    
    // Get geometry node types from registry instead of hardcoding
    const geometryNodeTypes = getNodesByCategory('geometry').map(def => def.type);
    
    // CRITICAL FIX: Handle ID conversion - edges use React Flow IDs, we need to convert
    const getNodeByReactFlowId = (reactFlowId: string): Node<NodeData> | undefined => {
      return allNodes.find(n => n.id === reactFlowId);
    };

    const getNodeByIdentifierId = (identifierId: string): Node<NodeData> | undefined => {
      return allNodes.find(n => n.data.identifier.id === identifierId);
    };

    // Recursive function to traverse upstream from the target node
    const traverseUpstream = (currentNodeId: string): void => {
      if (visited.has(currentNodeId)) return;
      visited.add(currentNodeId);
      
      // CRITICAL FIX: Try both ID types to find the current node
      const currentNode = getNodeByReactFlowId(currentNodeId) ?? getNodeByIdentifierId(currentNodeId);
      
      if (!currentNode) {
        console.warn(`Node not found for ID: ${currentNodeId}`);
        return;
      }
      
      // Registry-aware geometry node detection
      if (geometryNodeTypes.includes(currentNode.type!)) {
        geometryNodes.push(currentNode);
        // Continue traversal to find ALL upstream geometry nodes (don't return early)
      }
      
      // CRITICAL FIX: Find edges targeting this node using BOTH ID types
      const incomingEdges = allEdges.filter(edge => 
        edge.target === currentNode.id || edge.target === currentNode.data.identifier.id
      );
      
      // Recursively traverse all source nodes
      for (const edge of incomingEdges) {
        traverseUpstream(edge.source);
      }
    };
    
    // Start traversal from the target node
    traverseUpstream(nodeId);
    
    // Return all geometry nodes (including duplicates for validation)
    // Sort by display name for consistent UI
    return geometryNodes.sort((a, b) => 
      a.data.identifier.displayName.localeCompare(b.data.identifier.displayName)
    );
  }

  // Registry-aware node category validation
  isGeometryNode(nodeType: string): boolean {
    const definition = getNodeDefinition(nodeType);
    return definition?.execution.category === 'geometry' || false;
  }

  isTimingNode(nodeType: string): boolean {
    const definition = getNodeDefinition(nodeType);
    return definition?.execution.category === 'timing' || false;
  }

  isLogicNode(nodeType: string): boolean {
    const definition = getNodeDefinition(nodeType);
    return definition?.execution.category === 'logic' || false;
  }

  isAnimationNode(nodeType: string): boolean {
    const definition = getNodeDefinition(nodeType);
    return definition?.execution.category === 'animation' || false;
  }

  isOutputNode(nodeType: string): boolean {
    const definition = getNodeDefinition(nodeType);
    return definition?.execution.category === 'output' || false;
  }

  // Registry-aware flow validation
  validateNodeFlow(
    nodes: Node<NodeData>[], 
    edges: Edge[]
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Get node categories from registry
    const geometryNodeTypes = getNodesByCategory('geometry').map(def => def.type);

    // Validate proper flow architecture
    const geometryNodes = nodes.filter(n => geometryNodeTypes.includes(n.type!));
    
    for (const geoNode of geometryNodes) {
      const isConnectedToOutput = this.isNodeConnectedToCategory(
        geoNode.data.identifier.id, 
        'output', 
        edges, 
        nodes
      );
      
      if (isConnectedToOutput) {
        const canReachTiming = this.canReachNodeCategory(
          geoNode.data.identifier.id, 
          'timing', 
          edges, 
          nodes
        );
        
        if (!canReachTiming) {
          errors.push(
            `Geometry node ${geoNode.data.identifier.displayName} must connect to a timing node ` +
            `to control when it appears in the scene.`
          );
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // Registry-aware node category reachability
  private canReachNodeCategory(
    startNodeId: string, 
    targetCategory: string, 
    edges: Edge[], 
    nodes: Node<NodeData>[]
  ): boolean {
    const visited = new Set<string>();
    const targetNodeTypes = getNodesByCategory(targetCategory as 'geometry' | 'timing' | 'animation' | 'logic' | 'output').map(def => def.type);
    
    const traverse = (currentNodeId: string): boolean => {
      if (visited.has(currentNodeId)) return false;
      visited.add(currentNodeId);
      
      const currentNode = nodes.find(n => n.data.identifier.id === currentNodeId);
      if (currentNode && targetNodeTypes.includes(currentNode.type!)) return true;
      
      const outgoingEdges = edges.filter(e => e.source === currentNodeId);
      return outgoingEdges.some(edge => traverse(edge.target));
    };
    
    return traverse(startNodeId);
  }

  // Registry-aware category connection checking
  private isNodeConnectedToCategory(
    nodeId: string, 
    targetCategory: string, 
    edges: Edge[], 
    nodes: Node<NodeData>[]
  ): boolean {
    const visited = new Set<string>();
    const targetNodeTypes = getNodesByCategory(targetCategory as 'geometry' | 'timing' | 'animation' | 'logic' | 'output').map(def => def.type);
    
    const traverse = (currentNodeId: string): boolean => {
      if (visited.has(currentNodeId)) return false;
      visited.add(currentNodeId);
      
      const currentNode = nodes.find(n => n.data.identifier.id === currentNodeId);
      if (currentNode && targetNodeTypes.includes(currentNode.type!)) return true;
      
      const outgoingEdges = edges.filter(e => e.source === currentNodeId);
      return outgoingEdges.some(edge => traverse(edge.target));
    };
    
    return traverse(nodeId);
  }

  // Update node lineages for topology tracking
  private updateNodeLineages(sourceNodeId: string, targetNodeId: string, edgeId: string): void {
    const sourceLineage = this.nodeLineages.get(sourceNodeId);
    const targetLineage = this.nodeLineages.get(targetNodeId);
    
    if (sourceLineage && targetLineage) {
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

  // Recalculate upstream connections for topology
  private recalculateUpstreamConnections(nodeId: string): void {
    const lineage = this.nodeLineages.get(nodeId);
    if (!lineage) return;

    // Clear and rebuild parent relationships based on current flow paths
    lineage.parentNodes = [];
    
    for (const [otherNodeId, otherLineage] of this.nodeLineages.entries()) {
      if (otherLineage.childNodes.includes(nodeId)) {
        if (!lineage.parentNodes.includes(otherNodeId)) {
          lineage.parentNodes.push(otherNodeId);
        }
      }
    }
  }

  // Future: Get nodes by execution priority for conditional execution
  getNodesByExecutionPriority(nodes: Node<NodeData>[]): Node<NodeData>[] {
    return nodes.sort((a, b) => {
      const defA = getNodeDefinition(a.type!);
      const defB = getNodeDefinition(b.type!);
      
      const priorityA = defA?.execution.executionPriority ?? 0;
      const priorityB = defB?.execution.executionPriority ?? 0;
      
      return priorityB - priorityA; // Higher priority first
    });
  }

  // Future: Get conditional execution paths
  getConditionalPaths(nodeId: string, nodes: Node<NodeData>[], edges: Edge[]): string[] {
    const node = nodes.find(n => n.data.identifier.id === nodeId);
    if (!node) return [];
    
    const definition = getNodeDefinition(node.type!);
    if (!definition || definition.execution.category !== 'logic') return [];
    
    // Get all outgoing edges (potential conditional paths)
    const outgoingEdges = edges.filter(e => e.source === nodeId);
    return outgoingEdges.map(e => e.targetHandle ?? 'default');
  }

  // Check if there's a node of specific type upstream from the given node
  hasUpstreamNodeOfType(nodeId: string, targetNodeType: string, nodes: Node<NodeData>[], edges: Edge[]): boolean {
    const visited = new Set<string>();
    
    const traverse = (currentNodeId: string): boolean => {
      if (visited.has(currentNodeId)) return false;
      visited.add(currentNodeId);
      
      // Find incoming edges to current node
      const incomingEdges = edges.filter(e => e.target === currentNodeId);
      
      for (const edge of incomingEdges) {
        const sourceNode = nodes.find(n => n.id === edge.source);
        if (!sourceNode) continue;
        
        // If we found the target node type, return true
        if (sourceNode.type === targetNodeType) {
          return true;
        }
        
        // Recursively check upstream from this source node
        if (traverse(edge.source)) {
          return true;
        }
      }
      
      return false;
    };
    
    return traverse(nodeId);
  }
}