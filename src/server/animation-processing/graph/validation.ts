// src/server/animation-processing/graph/validation.ts
import { getNodesByCategory } from "@/shared/registry/registry-utils";
import { DuplicateObjectIdsError, MissingInsertConnectionError, MultipleInsertNodesInSeriesError, SceneRequiredError, TooManyScenesError } from "@/shared/errors/domain";
import type { NodeData } from "@/shared/types";
import type { ReactFlowEdge, ReactFlowNode } from "../types/graph";

export function validateScene(nodes: ReactFlowNode<NodeData>[]): void {
  const sceneNodes = nodes.filter((node) => node.type === 'scene');
  if (sceneNodes.length === 0) throw new SceneRequiredError();
  if (sceneNodes.length > 1) throw new TooManyScenesError();
}

export function validateConnections(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): void {
  // Connection validation logic can be added here if needed in the future
  // Currently no restrictions on object branching - Merge nodes handle conflicts
}

export function validateProperFlow(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): void {
  const geometryNodeTypes = getNodesByCategory('geometry').map((def) => def.type);
  const geometryNodes = nodes.filter((n) => geometryNodeTypes.includes(n.type!));

  for (const geoNode of geometryNodes) {
    const isConnectedToScene = isNodeConnectedToScene(geoNode.data.identifier.id, edges, nodes);
    if (isConnectedToScene) {
      const canReachInsert = canReachNodeType(geoNode.data.identifier.id, 'insert', edges, nodes);
      if (!canReachInsert) {
        throw new MissingInsertConnectionError(geoNode.data.identifier.displayName, geoNode.data.identifier.id);
      }
    }
  }
}

export function validateNoMultipleInsertNodesInSeries(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): void {
  // Find all paths from any node to scene that pass through multiple insert nodes
  const sceneNodes = nodes.filter((node) => node.type === 'scene');
  if (sceneNodes.length === 0) return; // No scene to validate against

  const sceneNode = sceneNodes[0]; // We already validated there's only one scene
  
  // For each node, find all paths to scene and check for multiple insert nodes
  for (const startNode of nodes) {
    const pathsToScene = findAllPathsToScene(startNode.data.identifier.id, sceneNode.data.identifier.id, edges, nodes);
    
    for (const path of pathsToScene) {
      const insertNodesInPath = path.filter(nodeId => {
        const node = nodes.find(n => n.data.identifier.id === nodeId);
        return node?.type === 'insert';
      });
      
      if (insertNodesInPath.length > 1) {
        const insertNodeNames = insertNodesInPath.map(nodeId => {
          const node = nodes.find(n => n.data.identifier.id === nodeId);
          return node?.data.identifier.displayName || nodeId;
        });
        
        const pathDescription = path.map(nodeId => {
          const node = nodes.find(n => n.data.identifier.id === nodeId);
          return node?.data.identifier.displayName || nodeId;
        }).join(' → ');
        
        throw new MultipleInsertNodesInSeriesError(insertNodeNames, pathDescription);
      }
    }
  }
}

export function validateNoDuplicateObjectIds(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): void {
  console.log('[VALIDATION] Starting duplicate object ID validation');
  console.log('[VALIDATION] Nodes:', nodes.map(n => ({ id: n.data.identifier.id, type: n.type })));
  console.log('[VALIDATION] Edges:', edges.map(e => ({ id: e.id, source: e.source, target: e.target })));

  for (const targetNode of nodes) {
    // CRITICAL: Only merge nodes are allowed to receive duplicate object IDs
    if (targetNode.type === 'merge') {
      console.log(`[VALIDATION] Skipping merge node: ${targetNode.data.identifier.displayName}`);
      continue;
    }

    console.log(`[VALIDATION] Checking node: ${targetNode.data.identifier.displayName} (${targetNode.data.identifier.id})`);
    
    const incomingObjectIds = getIncomingObjectIds(targetNode.data.identifier.id, edges, nodes);
    console.log(`[VALIDATION] Incoming object IDs for ${targetNode.data.identifier.displayName}:`, incomingObjectIds);
    
    const duplicates = incomingObjectIds.filter((id, index) => incomingObjectIds.indexOf(id) !== index);
    console.log(`[VALIDATION] Duplicates found:`, duplicates);
    
    if (duplicates.length > 0) {
      console.log(`[VALIDATION] THROWING ERROR: Duplicate object IDs detected for ${targetNode.data.identifier.displayName}`);
      throw new DuplicateObjectIdsError(
        targetNode.data.identifier.displayName, 
        targetNode.data.identifier.id, 
        duplicates
      );
    }
  }
  
  console.log('[VALIDATION] No duplicate object IDs found - validation passed');
}

// CRITICAL FIX: Merge-aware traversal that understands merge nodes deduplicate objects
function getIncomingObjectIds(targetNodeId: string, edges: ReactFlowEdge[], nodes: ReactFlowNode<NodeData>[]): string[] {
  console.log(`[TRACE] Starting upstream trace for node: ${targetNodeId}`);
  
  const geometryNodeTypes = getNodesByCategory('geometry').map((def) => def.type);
  console.log(`[TRACE] Geometry node types:`, geometryNodeTypes);

  // Create a lookup map for faster node finding
  const nodeByIdentifierId = new Map<string, ReactFlowNode<NodeData>>();
  nodes.forEach(node => {
    nodeByIdentifierId.set(node.data.identifier.id, node);
  });

  // Recursive function that returns object IDs from this node and upstream
  const traceUpstreamNode = (currentNodeId: string, pathVisited: Set<string>, depth: number = 0, pathId: string = 'root'): string[] => {
    const indent = '  '.repeat(depth);
    console.log(`${indent}[TRACE] [Path ${pathId}] Visiting node: ${currentNodeId}`);
    
    // Prevent cycles within the same path
    if (pathVisited.has(currentNodeId)) {
      console.log(`${indent}[TRACE] [Path ${pathId}] Cycle detected in this path, skipping`);
      return [];
    }
    
    const newPathVisited = new Set(pathVisited);
    newPathVisited.add(currentNodeId);
    
    const currentNode = nodeByIdentifierId.get(currentNodeId);
    if (!currentNode) {
      console.log(`${indent}[TRACE] [Path ${pathId}] Node not found for ID: ${currentNodeId}`);
      return [];
    }
    
    console.log(`${indent}[TRACE] [Path ${pathId}] Found node: ${currentNode.data.identifier.displayName} (type: ${currentNode.type})`);
    
    const objectIds: string[] = [];
    
    // CRITICAL: Special handling for merge nodes - they deduplicate upstream objects
    if (currentNode.type === 'merge') {
      console.log(`${indent}[TRACE] [Path ${pathId}] MERGE NODE DETECTED - will deduplicate upstream objects`);
      
      const incomingEdges = edges.filter((edge) => edge.target === currentNodeId);
      const allUpstreamObjects: string[] = [];
      
      // Collect objects from all merge inputs
      incomingEdges.forEach((edge, index) => {
        const subPathId = `${pathId}.merge.${index}`;
        console.log(`${indent}[TRACE] [Path ${pathId}] Following merge input from: ${edge.source} (path: ${subPathId})`);
        
        const upstreamObjects = traceUpstreamNode(edge.source, newPathVisited, depth + 1, subPathId);
        allUpstreamObjects.push(...upstreamObjects);
      });
      
      // CRITICAL: Merge deduplicates identical object IDs
      const uniqueObjects = [...new Set(allUpstreamObjects)];
      console.log(`${indent}[TRACE] [Path ${pathId}] Merge deduplication: ${allUpstreamObjects.length} → ${uniqueObjects.length} objects`);
      console.log(`${indent}[TRACE] [Path ${pathId}] Before merge:`, allUpstreamObjects);
      console.log(`${indent}[TRACE] [Path ${pathId}] After merge:`, uniqueObjects);
      
      return uniqueObjects;
    }
    
    // If this is a geometry node, add its object ID
    if (geometryNodeTypes.includes(currentNode.type!)) {
      console.log(`${indent}[TRACE] [Path ${pathId}] Adding geometry object ID: ${currentNode.data.identifier.id}`);
      objectIds.push(currentNode.data.identifier.id);
    }
    
    // Trace upstream from all incoming edges
    const incomingEdges = edges.filter((edge) => edge.target === currentNodeId);
    console.log(`${indent}[TRACE] [Path ${pathId}] Incoming edges:`, incomingEdges.map(e => ({ from: e.source, to: e.target })));
    
    incomingEdges.forEach((edge, index) => {
      const subPathId = `${pathId}.${index}`;
      console.log(`${indent}[TRACE] [Path ${pathId}] Following edge from: ${edge.source} (new path: ${subPathId})`);
      const upstreamObjects = traceUpstreamNode(edge.source, newPathVisited, depth + 1, subPathId);
      objectIds.push(...upstreamObjects);
    });
    
    return objectIds;
  };

  // Start tracing from the target node
  const result = traceUpstreamNode(targetNodeId, new Set<string>());
  
  console.log(`[TRACE] Final result for ${targetNodeId}:`, result);
  console.log(`[TRACE] Unique object IDs:`, [...new Set(result)]);
  console.log(`[TRACE] Duplicate detection - Total: ${result.length}, Unique: ${new Set(result).size}`);
  
  return result;
}

function canReachNodeType(
  startNodeId: string,
  targetNodeType: string,
  edges: ReactFlowEdge[],
  nodes: ReactFlowNode<NodeData>[]
): boolean {
  const visited = new Set<string>();
  
  const nodeByIdentifierId = new Map<string, ReactFlowNode<NodeData>>();
  nodes.forEach(node => {
    nodeByIdentifierId.set(node.data.identifier.id, node);
  });
  
  const traverse = (currentNodeId: string): boolean => {
    if (visited.has(currentNodeId)) return false;
    visited.add(currentNodeId);
    
    const currentNode = nodeByIdentifierId.get(currentNodeId);
    if (currentNode?.type === targetNodeType) return true;
    
    const outgoingEdges = edges.filter((e) => e.source === currentNodeId);
    return outgoingEdges.some((edge) => traverse(edge.target));
  };
  
  return traverse(startNodeId);
}

function isNodeConnectedToScene(nodeId: string, edges: ReactFlowEdge[], nodes: ReactFlowNode<NodeData>[]): boolean {
  const visited = new Set<string>();
  
  const nodeByIdentifierId = new Map<string, ReactFlowNode<NodeData>>();
  nodes.forEach(node => {
    nodeByIdentifierId.set(node.data.identifier.id, node);
  });
  
  const traverse = (currentNodeId: string): boolean => {
    if (visited.has(currentNodeId)) return false;
    visited.add(currentNodeId);
    
    const currentNode = nodeByIdentifierId.get(currentNodeId);
    if (currentNode?.type === 'scene') return true;
    
    const outgoingEdges = edges.filter((e) => e.source === currentNodeId);
    return outgoingEdges.some((edge) => traverse(edge.target));
  };
  
  return traverse(nodeId);
}

// Find all possible paths from startNodeId to targetNodeId
function findAllPathsToScene(
  startNodeId: string, 
  targetNodeId: string, 
  edges: ReactFlowEdge[], 
  nodes: ReactFlowNode<NodeData>[]
): string[][] {
  const allPaths: string[][] = [];
  const currentPath: string[] = [];
  
  const nodeByIdentifierId = new Map<string, ReactFlowNode<NodeData>>();
  nodes.forEach(node => {
    nodeByIdentifierId.set(node.data.identifier.id, node);
  });
  
  const dfs = (currentNodeId: string, visited: Set<string>) => {
    // Avoid infinite loops
    if (visited.has(currentNodeId)) return;
    
    currentPath.push(currentNodeId);
    visited.add(currentNodeId);
    
    // If we reached the target, save this path
    if (currentNodeId === targetNodeId) {
      allPaths.push([...currentPath]);
    } else {
      // Continue exploring outgoing edges
      const outgoingEdges = edges.filter(e => e.source === currentNodeId);
      for (const edge of outgoingEdges) {
        dfs(edge.target, new Set(visited));
      }
    }
    
    // Backtrack
    currentPath.pop();
  };
  
  dfs(startNodeId, new Set());
  return allPaths;
}