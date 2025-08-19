// src/lib/flow/flow-tracking.ts - Registry-aware flow tracking with consistent ID handling
import type { Node, Edge } from "reactflow";
import type { NodeData, NodeLineage } from "@/shared/types/nodes";
import { getNodeDefinition, getNodesByCategory } from "@/shared/registry/registry-utils";
import { canonicalizeEdges, buildIdMap, toCanonicalId } from "@/shared/graph/id";

// Enhanced object descriptor for duplicate-aware tracking
interface ObjectDescriptor {
  id: string;
  nodeId: string;
  displayName: string;
  type: string;
  sourceGeometryNodeId: string;
}

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



  // Enhanced method to get visual objects (geometry nodes only, excluding data nodes like constants)
  getUpstreamObjects(
    nodeId: string,
    allNodes: Node<NodeData>[],
    allEdges: Edge[]
  ): ObjectDescriptor[] {
    const visited = new Set<string>();

    // Build ID mapping
    const idMap = buildIdMap(allNodes as unknown as Array<{ id: string; data: { identifier: { id: string } } }>);

    // Get all node types from registry
    const geometryNodeTypes = getNodesByCategory('geometry').map(def => def.type);
    const textNodeTypes = getNodesByCategory('text').map(def => def.type);
    const dataNodeTypes = getNodesByCategory('data').map(def => def.type);
    const duplicateNodeTypes = ['duplicate']; // Can be expanded for other multiplier nodes

    const getNodeByIdentifierId = (identifierId: string): Node<NodeData> | undefined => {
      return allNodes.find((n) => n.data.identifier.id === identifierId);
    };

    // Enhanced: Handle multiple input ports for merge nodes
    const getInputPortsForNode = (node: Node<NodeData>): string[] => {
      if (node.type === 'merge') {
        const mergeData = node.data as unknown as { inputPortCount?: number };
        const portCount = Math.min(Math.max(Number(mergeData.inputPortCount) ?? 2, 2), 5);
        return Array.from({ length: portCount }, (_, i) => `input${i + 1}`);
      }
      return ['input']; // Default single input port
    };

    // Trace objects through the flow with merge node support
    const traceObjects = (currentNodeId: string, objectsByPort: Map<string, ObjectDescriptor[]>): ObjectDescriptor[] => {
      if (visited.has(currentNodeId)) return [];
      visited.add(currentNodeId);

      const currentNode = getNodeByIdentifierId(currentNodeId);
      if (!currentNode) {
        console.warn(`Node not found for ID: ${currentNodeId}`);
        return [];
      }

      // If this is a geometry node OR text node, it creates new visual objects
      if (geometryNodeTypes.includes(currentNode.type!) || textNodeTypes.includes(currentNode.type!)) {
        const newObject: ObjectDescriptor = {
          id: currentNode.data.identifier.id,
          nodeId: currentNode.data.identifier.id,
          displayName: currentNode.data.identifier.displayName,
          type: currentNode.type!,
          sourceGeometryNodeId: currentNode.data.identifier.id
        };
        return [newObject];
      }

      // Data nodes (like constants) output values but not visual objects
      // They should not appear in object selection lists for timeline/canvas editors
      if (dataNodeTypes.includes(currentNode.type!)) {
        return []; // Return empty array for data nodes
      }

      // Handle merge nodes with multiple ports and conflict resolution
      if (currentNode.type === 'merge') {
        return this.processMergeNode(objectsByPort);
      }

      // If this is a duplicate node, multiply the objects
      if (duplicateNodeTypes.includes(currentNode.type!)) {
        const duplicateData = currentNode.data as unknown as { count?: number };
        const count = Math.min(Math.max(Number(duplicateData.count) ?? 1, 1), 50);
        
        // Get objects from single input port
        const inputObjects = objectsByPort.get('input') ?? [];
        const multipliedObjects: ObjectDescriptor[] = [];
        
        for (const obj of inputObjects) {
          // Add original
          multipliedObjects.push(obj);
          
          // Add duplicates  
          for (let i = 1; i < count; i++) {
            const duplicateId = `${obj.id}_dup_${i.toString().padStart(3, '0')}`;
            multipliedObjects.push({
              id: duplicateId,
              nodeId: currentNode.data.identifier.id,
              displayName: `${obj.displayName} (Copy ${i})`,
              type: obj.type,
              sourceGeometryNodeId: obj.sourceGeometryNodeId
            });
          }
        }
        
        return multipliedObjects;
      }

      // For other nodes (filter, canvas, animation), pass through from single input
      const inputObjects = objectsByPort.get('input') ?? [];
      return inputObjects;
    };

    // Recursive traversal with merge-aware port handling
    const traverseUpstream = (currentNodeId: string): ObjectDescriptor[] => {
      const currentNode = getNodeByIdentifierId(currentNodeId);
      if (!currentNode) return [];

      // Get input ports for this node type
      const inputPorts = getInputPortsForNode(currentNode);
      
      // Collect objects from each input port
      const objectsByPort = new Map<string, ObjectDescriptor[]>();
      
      for (const portId of inputPorts) {
        // Find edges targeting this specific port (using React Flow IDs)
        const portEdges = allEdges.filter((edge) => {
          // Map React Flow target to canonical ID for comparison
          const targetCanonicalId = toCanonicalId(edge.target, idMap);
          return targetCanonicalId === currentNode.data.identifier.id && 
                 (edge.targetHandle === portId || (!edge.targetHandle && portId === 'input'));
        });
        
        const portObjects: ObjectDescriptor[] = [];
        for (const edge of portEdges) {
          // Map edge source to canonical identifier ID
          const sourceCanonicalId = toCanonicalId(edge.source, idMap);
          const upstreamObjs = traverseUpstream(sourceCanonicalId);
          portObjects.push(...upstreamObjs);
        }
        
        if (portObjects.length > 0) {
          objectsByPort.set(portId, portObjects);
        }
      }

      // If no input ports have objects and this is a geometry node, it's a source
      if (objectsByPort.size === 0 && geometryNodeTypes.includes(currentNode.type!)) {
        const emptyMap = new Map([['input', []]]);
        return traceObjects(currentNodeId, emptyMap);
      }

      // Process objects through current node
      return traceObjects(currentNodeId, objectsByPort);
    };

    // Start traversal from target node
    const startId = toCanonicalId(nodeId, idMap);
    const result = traverseUpstream(startId);

    // Remove duplicates and sort
    const uniqueObjects = new Map<string, ObjectDescriptor>();
    for (const obj of result) {
      uniqueObjects.set(obj.id, obj);
    }

    return Array.from(uniqueObjects.values()).sort((a, b) => 
      a.displayName.localeCompare(b.displayName)
    );
  }

  // Process merge node with port priority (matches backend logic)
  private processMergeNode(objectsByPort: Map<string, ObjectDescriptor[]>): ObjectDescriptor[] {
    const mergedObjects = new Map<string, ObjectDescriptor>();
    
    // Process ports in reverse order so Port 1 (input1) has highest priority
    const portNames = Array.from(objectsByPort.keys()).sort((a, b) => {
      const aNum = parseInt(a.replace('input', '')) ?? 0;
      const bNum = parseInt(b.replace('input', '')) ?? 0;
      return bNum - aNum; // Reverse order
    });
    
    for (const portName of portNames) {
      const objects = objectsByPort.get(portName) ?? [];
      
      for (const obj of objects) {
        const existingObject = mergedObjects.get(obj.id);
        if (existingObject) {
          // Conflict resolution: current port overwrites (lower port number = higher priority)
          console.debug(`[FlowTracker] Object ID conflict resolved: ${obj.id} from ${portName} overwrites previous`);
        }
        mergedObjects.set(obj.id, obj);
      }
    }
    
    return Array.from(mergedObjects.values());
  }



  // Registry-aware node category validation
  isGeometryNode(nodeType: string): boolean {
    const definition = getNodeDefinition(nodeType);
    return definition?.execution.category === 'geometry';
  }

  isDataNode(nodeType: string): boolean {
    const definition = getNodeDefinition(nodeType);
    return definition?.execution.category === 'data';
  }

  isTimingNode(nodeType: string): boolean {
    const definition = getNodeDefinition(nodeType);
    return definition?.execution.category === 'timing';
  }

  isLogicNode(nodeType: string): boolean {
    const definition = getNodeDefinition(nodeType);
    return definition?.execution.category === 'logic';
  }

  isAnimationNode(nodeType: string): boolean {
    const definition = getNodeDefinition(nodeType);
    return definition?.execution.category === 'animation';
  }

  isOutputNode(nodeType: string): boolean {
    const definition = getNodeDefinition(nodeType);
    return definition?.execution.category === 'output';
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
    // Data nodes are sources like geometry nodes, so they follow the same validation rules
    
    // Validate geometry nodes
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

    // Data nodes are sources that don't require timing validation
    // They can be used directly by logic nodes or connected to timing nodes if needed
    // No specific validation rules needed for data nodes as they are pure sources

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

  // Build a compact list of available variable bindings for UI
  getAllResultVariables(allNodes: Node<NodeData>[]): Array<{ id: string; name: string }> {
    return allNodes
      .filter(node => node.type === 'result')
      .map(node => ({
        id: node.data.identifier.id,
        name: node.data.identifier.displayName,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}