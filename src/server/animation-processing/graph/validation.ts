// src/server/animation-processing/graph/validation.ts
import { getNodesByCategory, getNodeDefinitionWithDynamicPorts, getNodeDefinition } from "@/shared/registry/registry-utils";
import { arePortsCompatible, type PortType } from "@/shared/types/ports";
import { 
  DuplicateObjectIdsError, 
  MissingInsertConnectionError, 
  MultipleInsertNodesInSeriesError, 
  SceneRequiredError, 
  TooManyScenesError,
  InvalidConnectionError 
} from "@/shared/errors/domain";
import { logger } from "@/lib/logger";
import type { NodeData } from "@/shared/types";
import type { ReactFlowEdge, ReactFlowNode } from "../types/graph";

export function validateScene(nodes: ReactFlowNode<NodeData>[]): void {
  const sceneNodes = nodes.filter((node) => node.type === 'scene');
  if (sceneNodes.length === 0) throw new SceneRequiredError();
  
  // Allow multiple scenes but with reasonable limits for performance
  const maxScenesPerExecution = Number(process.env.MAX_SCENES_PER_EXECUTION ?? '8');
  if (sceneNodes.length > maxScenesPerExecution) {
    throw new TooManyScenesError(sceneNodes.length, maxScenesPerExecution);
  }
}

export function validateConnections(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): void {
  // Validate port compatibility for all connections
  validatePortCompatibility(nodes, edges);
  // Note: Merge port validation is handled separately in runUniversalValidation
}

export function validatePortCompatibility(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): void {
  for (const edge of edges) {
    const sourceNode = nodes.find(n => n.data.identifier.id === edge.source);
    const targetNode = nodes.find(n => n.data.identifier.id === edge.target);
    
    if (!sourceNode || !targetNode) {
      throw new InvalidConnectionError(
        `Connection references non-existent nodes: ${edge.source} -> ${edge.target}`,
        { edgeId: edge.id, sourceNodeId: edge.source, targetNodeId: edge.target }
      );
    }

    const sourceDefinition = getNodeDefinition(sourceNode.type!);
    const targetDefinition = getNodeDefinition(targetNode.type!);
    
    if (!sourceDefinition || !targetDefinition) {
      throw new InvalidConnectionError(
        `Unknown node types in connection: ${sourceNode.type} -> ${targetNode.type}`,
        { edgeId: edge.id, sourceNodeId: edge.source, targetNodeId: edge.target }
      );
    }

    // Get dynamic definition for nodes with dynamic ports
    const actualTargetDefinition = (targetNode.type === 'merge' || targetNode.type === 'boolean_op')
      ? getNodeDefinitionWithDynamicPorts(targetNode.type, targetNode.data as unknown as Record<string, unknown>)
      : targetDefinition;

    const sourcePort = sourceDefinition.ports.outputs.find((p: { id: string }) => p.id === edge.sourceHandle);
    const targetPort = actualTargetDefinition?.ports.inputs.find((p: { id: string }) => p.id === edge.targetHandle);
    
    if (!sourcePort) {
      throw new InvalidConnectionError(
        `Source port "${edge.sourceHandle}" not found on ${sourceNode.data.identifier.displayName}`,
        { edgeId: edge.id, sourceNodeId: edge.source, targetNodeId: edge.target }
      );
    }
    
    if (!targetPort) {
      throw new InvalidConnectionError(
        `Target port "${edge.targetHandle}" not found on ${targetNode.data.identifier.displayName}`,
        { edgeId: edge.id, sourceNodeId: edge.source, targetNodeId: edge.target }
      );
    }

    if (!arePortsCompatible((sourcePort as { type: PortType }).type, (targetPort as { type: PortType }).type)) {
      throw new InvalidConnectionError(
        `Port types incompatible: ${(sourcePort as { type: PortType }).type} output cannot connect to ${(targetPort as { type: PortType }).type} input between ${sourceNode.data.identifier.displayName} and ${targetNode.data.identifier.displayName}`,
        { edgeId: edge.id, sourceNodeId: edge.source, targetNodeId: edge.target }
      );
    }
  }
}

export function validateMergePortConnections(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): void {
  const mergeNodes = nodes.filter(node => node.type === 'merge');
  
  for (const mergeNode of mergeNodes) {
    const incomingEdges = edges.filter(edge => edge.target === mergeNode.data.identifier.id);
    const portConnections = new Map<string, ReactFlowEdge[]>();
    
    // Group edges by target port
    for (const edge of incomingEdges) {
      if (!edge.targetHandle) continue;
      
      const existingEdges = portConnections.get(edge.targetHandle) ?? [];
      existingEdges.push(edge);
      portConnections.set(edge.targetHandle, existingEdges);
    }
    
    // Check for multiple connections to same port
    for (const [portId, connectedEdges] of portConnections.entries()) {
      if (connectedEdges.length > 1) {
        const sourceNodeNames = connectedEdges.map(edge => {
          const sourceNode = nodes.find(n => n.data.identifier.id === edge.source);
          return sourceNode?.data.identifier.displayName ?? edge.source;
        });
        
        throw new InvalidConnectionError(
          `Multiple connections to merge port "${portId}" on ${mergeNode.data.identifier.displayName}. Each merge input port can only accept one connection. Connected from: ${sourceNodeNames.join(', ')}`,
          { 
            nodeId: mergeNode.data.identifier.id, 
            nodeName: mergeNode.data.identifier.displayName,
            info: { portId, connectedEdges: connectedEdges.length }
          }
        );
      }
    }
  }
}

export function validateBooleanPortConnections(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): void {
  const booleanNodes = nodes.filter(node => node.type === 'boolean_op');
  
  for (const booleanNode of booleanNodes) {
    // Safety check for node data
    if (!booleanNode.data?.identifier?.id || !booleanNode.data?.identifier?.displayName) {
      continue; // Skip nodes with invalid data structure
    }
    
    const incomingEdges = edges.filter(edge => edge.target === booleanNode.data.identifier.id);
    const portConnections = new Map<string, ReactFlowEdge[]>();
    
    // Group edges by target port
    for (const edge of incomingEdges) {
      if (!edge.targetHandle) continue;
      
      const existingEdges = portConnections.get(edge.targetHandle) ?? [];
      existingEdges.push(edge);
      portConnections.set(edge.targetHandle, existingEdges);
    }
    
    // Check for multiple connections to same port
    for (const [portId, connectedEdges] of portConnections.entries()) {
      if (connectedEdges.length > 1) {
        const sourceNodeNames = connectedEdges.map(edge => {
          const sourceNode = nodes.find(n => n.data?.identifier?.id === edge.source);
          return sourceNode?.data?.identifier?.displayName ?? edge.source;
        });
        
        throw new InvalidConnectionError(
          `Multiple connections to boolean port "${portId}" on ${booleanNode.data.identifier.displayName}. Each boolean input port can only accept one connection. Connected from: ${sourceNodeNames.join(', ')}`,
          { 
            nodeId: booleanNode.data.identifier.id, 
            nodeName: booleanNode.data.identifier.displayName,
            info: { portId, connectedEdges: connectedEdges.length }
          }
        );
      }
    }
  }
}

export function validateBooleanTypeConnections(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): void {
  const booleanNodes = nodes.filter(node => node.type === 'boolean_op');
  
  for (const booleanNode of booleanNodes) {
    // Safety check for node data
    if (!booleanNode.data?.identifier?.id || !booleanNode.data?.identifier?.displayName) {
      continue; // Skip nodes with invalid data structure
    }
    
    const incomingEdges = edges.filter(edge => edge.target === booleanNode.data.identifier.id);
    
    for (const edge of incomingEdges) {
      const sourceNode = nodes.find(n => n.data?.identifier?.id === edge.source);
      if (!sourceNode || !sourceNode.data?.identifier?.displayName) continue;
      
      const sourceDefinition = getNodeDefinition(sourceNode.type!);
      if (!sourceDefinition) continue;
      
      const sourcePort = sourceDefinition.ports.outputs.find(p => p.id === edge.sourceHandle);
      if (!sourcePort) continue;
      
      // Check if the source port outputs boolean data
      let isValidBooleanSource = false;
      
      if (sourceNode.type === 'compare' || sourceNode.type === 'boolean_op') {
        // Compare and boolean_op nodes always output boolean
        isValidBooleanSource = true;
      } else if (sourceNode.type === 'constants') {
        // Constants node: check if it's configured to output boolean
        const constantsData = sourceNode.data as unknown as { valueType?: string };
        isValidBooleanSource = constantsData.valueType === 'boolean';
      }
      // Note: Removed generic 'data' type allowance - be more strict
      
      if (!isValidBooleanSource) {
        let errorMessage = `Boolean operation "${booleanNode.data.identifier.displayName}" can only accept boolean inputs. Connected from "${sourceNode.data.identifier.displayName}"`;
        
        if (sourceNode.type === 'constants') {
          const constantsData = sourceNode.data as unknown as { valueType?: string };
          errorMessage += ` which is configured to output ${constantsData.valueType || 'unknown'} values. Set the Constants node to output boolean values instead.`;
        } else {
          errorMessage += ` which outputs ${sourcePort.type} data. Only boolean sources are allowed.`;
        }
        
        throw new InvalidConnectionError(
          errorMessage,
          { 
            nodeId: booleanNode.data.identifier.id,
            nodeName: booleanNode.data.identifier.displayName,
            sourceNodeId: sourceNode.data.identifier.id,
            sourceNodeName: sourceNode.data.identifier.displayName,
            info: { expectedType: 'boolean', actualType: sourceNode.type === 'constants' ? (sourceNode.data as any).valueType : sourcePort.type }
          }
        );
      }
    }
  }
}

export function validateProperFlow(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): void {
  const geometryNodeTypes = getNodesByCategory('geometry').map((def) => def.type);
  const geometryNodes = nodes.filter((n) => geometryNodeTypes.includes(n.type!));

  // Find all potential terminus nodes - nodes that can end a flow
  const outputNodeTypes = getNodesByCategory('output').map((def) => def.type);
  const logicNodeTypes = getNodesByCategory('logic').map((def) => def.type);
  
  // Include both output nodes (Scene) and terminal logic nodes (Print)
  const allTerminusTypes = [...outputNodeTypes, ...logicNodeTypes.filter(type => type === 'print')];

  for (const geoNode of geometryNodes) {
    const isConnectedToAnyOutput = isNodeConnectedToAnyOutputType(geoNode.data.identifier.id, edges, nodes, allTerminusTypes);
    if (isConnectedToAnyOutput) {
      const canReachInsert = canReachNodeType(geoNode.data.identifier.id, 'insert', edges, nodes);
      if (!canReachInsert) {
        throw new MissingInsertConnectionError(geoNode.data.identifier.displayName, geoNode.data.identifier.id);
      }
    }
  }
}

export function validateNoMultipleInsertNodesInSeries(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): void {
  // Find all potential terminus nodes - nodes that can end a flow
  const outputNodeTypes = getNodesByCategory('output').map((def) => def.type);
  const logicNodeTypes = getNodesByCategory('logic').map((def) => def.type);
  
  // Include both output nodes (Scene) and terminal logic nodes (Print)
  const allTerminusTypes = [...outputNodeTypes, ...logicNodeTypes.filter(type => type === 'print')];
  
  const terminusNodes = nodes.filter((node) => allTerminusTypes.includes(node.type!));
  
  // If no terminus nodes, still validate all paths to catch Insert issues
  if (terminusNodes.length === 0) {
    // Check all possible paths between any nodes that have Insert nodes
    validateInsertConstraintsInAllPaths(nodes, edges);
    return;
  }

  // Check paths to each terminus node
  for (const terminusNode of terminusNodes) {
    for (const startNode of nodes) {
      const pathsToOutput = findAllPathsToNode(startNode.data.identifier.id, terminusNode.data.identifier.id, edges, nodes);
      
      for (const path of pathsToOutput) {
        const insertNodesInPath = path.filter(nodeId => {
          const node = nodes.find(n => n.data.identifier.id === nodeId);
          return node?.type === 'insert';
        });
        
        if (insertNodesInPath.length > 1) {
          const insertNodeNames = insertNodesInPath.map(nodeId => {
            const node = nodes.find(n => n.data.identifier.id === nodeId);
            return node?.data.identifier.displayName ?? nodeId;
          });
          
          const pathDescription = path.map(nodeId => {
            const node = nodes.find(n => n.data.identifier.id === nodeId);
            return node?.data.identifier.displayName ?? nodeId;
          }).join(' → ');
          
          throw new MultipleInsertNodesInSeriesError(insertNodeNames, pathDescription);
        }
      }
    }
  }
}

export function validateNoDuplicateObjectIds(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): void {
  logger.debug('Starting duplicate object ID validation');
  logger.debug('Validation nodes', { nodes: nodes.map(n => ({ id: n.data.identifier.id, type: n.type })) });
  logger.debug('Validation edges', { edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target })) });

  for (const targetNode of nodes) {
    // Only merge nodes are allowed to receive duplicate object IDs
    if (targetNode.type === 'merge') {
      logger.debug(`Skipping merge node: ${targetNode.data.identifier.displayName}`);
      continue;
    }

    logger.debug(`Checking node: ${targetNode.data.identifier.displayName} (${targetNode.data.identifier.id})`);
    
    const incomingObjectIds = getIncomingObjectIds(targetNode.data.identifier.id, edges, nodes);
    logger.debug(`Incoming object IDs for ${targetNode.data.identifier.displayName}`, { incomingObjectIds });
    
    const duplicates = incomingObjectIds.filter((id, index) => incomingObjectIds.indexOf(id) !== index);
    logger.debug('Duplicates found', { duplicates });
    
    if (duplicates.length > 0) {
      logger.error(`Duplicate object IDs detected for ${targetNode.data.identifier.displayName}`);
      throw new DuplicateObjectIdsError(
        targetNode.data.identifier.displayName, 
        targetNode.data.identifier.id, 
        duplicates
      );
    }
  }
  
  logger.debug('No duplicate object IDs found - validation passed');
}

// Helper functions (keeping existing implementation)
function getIncomingObjectIds(targetNodeId: string, edges: ReactFlowEdge[], nodes: ReactFlowNode<NodeData>[]): string[] {
  logger.debug(`Starting upstream trace for node: ${targetNodeId}`);
  
  const geometryNodeTypes = getNodesByCategory('geometry').map((def) => def.type);
  logger.debug('Geometry node types', { geometryNodeTypes });

  const nodeByIdentifierId = new Map<string, ReactFlowNode<NodeData>>();
  nodes.forEach(node => {
    nodeByIdentifierId.set(node.data.identifier.id, node);
  });

  const traceUpstreamNode = (currentNodeId: string, pathVisited: Set<string>, depth = 0, pathId = 'root'): string[] => {
    const indent = '  '.repeat(depth);
    logger.debug(`${indent}[Path ${pathId}] Visiting node: ${currentNodeId}`);
    
    if (pathVisited.has(currentNodeId)) {
      logger.debug(`${indent}[Path ${pathId}] Cycle detected in this path, skipping`);
      return [];
    }
    
    const newPathVisited = new Set(pathVisited);
    newPathVisited.add(currentNodeId);
    
    const currentNode = nodeByIdentifierId.get(currentNodeId);
    if (!currentNode) {
      logger.warn(`${indent}[Path ${pathId}] Node not found for ID: ${currentNodeId}`);
      return [];
    }
    
    logger.debug(`${indent}[Path ${pathId}] Found node: ${currentNode.data.identifier.displayName} (type: ${currentNode.type})`);
    
    const objectIds: string[] = [];
    
    // Special handling for merge nodes - they deduplicate upstream objects
    if (currentNode.type === 'merge') {
      logger.debug(`${indent}[Path ${pathId}] MERGE NODE DETECTED - will deduplicate upstream objects`);
      
      const incomingEdges = edges.filter((edge) => edge.target === currentNodeId);
      const allUpstreamObjects: string[] = [];
      
      incomingEdges.forEach((edge, index) => {
        const subPathId = `${pathId}.merge.${index}`;
        logger.debug(`${indent}[Path ${pathId}] Following merge input from: ${edge.source} (path: ${subPathId})`);
        
        const upstreamObjects = traceUpstreamNode(edge.source, newPathVisited, depth + 1, subPathId);
        allUpstreamObjects.push(...upstreamObjects);
      });
      
      const uniqueObjects = [...new Set(allUpstreamObjects)];
      logger.debug(`${indent}[Path ${pathId}] Merge deduplication: ${allUpstreamObjects.length} → ${uniqueObjects.length} objects`);
      logger.debug(`${indent}[Path ${pathId}] Before merge`, { allUpstreamObjects });
      logger.debug(`${indent}[Path ${pathId}] After merge`, { uniqueObjects });
      
      return uniqueObjects;
    }
    
    // If this is a geometry node, add its object ID
    if (geometryNodeTypes.includes(currentNode.type!)) {
      logger.debug(`${indent}[Path ${pathId}] Adding geometry object ID: ${currentNode.data.identifier.id}`);
      objectIds.push(currentNode.data.identifier.id);
    }
    
    // Trace upstream from all incoming edges
    const incomingEdges = edges.filter((edge) => edge.target === currentNodeId);
    logger.debug(`${indent}[Path ${pathId}] Incoming edges`, { edges: incomingEdges.map(e => ({ from: e.source, to: e.target })) });
    
    incomingEdges.forEach((edge, index) => {
      const subPathId = `${pathId}.${index}`;
      logger.debug(`${indent}[Path ${pathId}] Following edge from: ${edge.source} (new path: ${subPathId})`);
      const upstreamObjects = traceUpstreamNode(edge.source, newPathVisited, depth + 1, subPathId);
      objectIds.push(...upstreamObjects);
    });
    
    return objectIds;
  };

  const result = traceUpstreamNode(targetNodeId, new Set<string>());
  
  logger.debug(`Final result for ${targetNodeId}`, { result });
  logger.debug('Unique object IDs', { uniqueIds: [...new Set(result)] });
  logger.debug('Duplicate detection', { total: result.length, unique: new Set(result).size });
  
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

function findAllPathsToScene(
  startNodeId: string, 
  targetNodeId: string, 
  edges: ReactFlowEdge[], 
  nodes: ReactFlowNode<NodeData>[]
): string[][] {
  return findAllPathsToNode(startNodeId, targetNodeId, edges, nodes);
}

function findAllPathsToNode(
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
    if (visited.has(currentNodeId)) return;
    
    currentPath.push(currentNodeId);
    visited.add(currentNodeId);
    
    if (currentNodeId === targetNodeId) {
      allPaths.push([...currentPath]);
    } else {
      const outgoingEdges = edges.filter(e => e.source === currentNodeId);
      for (const edge of outgoingEdges) {
        dfs(edge.target, new Set(visited));
      }
    }
    
    currentPath.pop();
  };
  
  dfs(startNodeId, new Set());
  return allPaths;
}

function validateInsertConstraintsInAllPaths(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): void {
  // Find all Insert nodes
  const insertNodes = nodes.filter(node => node.type === 'insert');
  if (insertNodes.length <= 1) return; // No issue if 0 or 1 Insert nodes
  
  // Check all possible paths between nodes to find Insert chains
  for (const startNode of nodes) {
    for (const endNode of nodes) {
      if (startNode.data.identifier.id === endNode.data.identifier.id) continue;
      
      const paths = findAllPathsToNode(startNode.data.identifier.id, endNode.data.identifier.id, edges, nodes);
      
      for (const path of paths) {
        const insertNodesInPath = path.filter(nodeId => {
          const node = nodes.find(n => n.data.identifier.id === nodeId);
          return node?.type === 'insert';
        });
        
        if (insertNodesInPath.length > 1) {
          const insertNodeNames = insertNodesInPath.map(nodeId => {
            const node = nodes.find(n => n.data.identifier.id === nodeId);
            return node?.data.identifier.displayName ?? nodeId;
          });
          
          const pathDescription = path.map(nodeId => {
            const node = nodes.find(n => n.data.identifier.id === nodeId);
            return node?.data.identifier.displayName ?? nodeId;
          }).join(' → ');
          
          throw new MultipleInsertNodesInSeriesError(insertNodeNames, pathDescription);
        }
      }
    }
  }
}

function isNodeConnectedToAnyOutputType(
  nodeId: string, 
  edges: ReactFlowEdge[], 
  nodes: ReactFlowNode<NodeData>[], 
  outputTypes: string[]
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
    if (currentNode && outputTypes.includes(currentNode.type!)) return true;
    
    const outgoingEdges = edges.filter((e) => e.source === currentNodeId);
    return outgoingEdges.some((edge) => traverse(edge.target));
  };
  
  return traverse(nodeId);
}