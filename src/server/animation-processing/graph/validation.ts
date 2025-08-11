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
  // Note: Logic node port validation is handled separately in runUniversalValidation
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

/**
 * Universal validation for ALL logic nodes to prevent multiple edges to the same input port.
 * This prevents logical contradictions and ambiguity in logic operations.
 * Applies to: merge, boolean_op, filter, if_else, compare, math_op, and any future logic nodes.
 */
export function validateLogicNodePortConnections(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): void {
  // Get all logic node types (current and future)
  const logicNodeTypes = getNodesByCategory('logic').map(def => def.type);
  const logicNodes = nodes.filter(node => logicNodeTypes.includes(node.type!));
  
  for (const logicNode of logicNodes) {
    // Safety check for node data
    if (!logicNode.data?.identifier?.id || !logicNode.data?.identifier?.displayName) {
      continue; // Skip nodes with invalid data structure
    }
    
    const incomingEdges = edges.filter(edge => edge.target === logicNode.data.identifier.id);
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
          `Multiple connections to logic port "${portId}" on ${logicNode.data.identifier.displayName}. Each logic input port can only accept one connection to prevent logical contradictions. Connected from: ${sourceNodeNames.join(', ')}`,
          { 
            nodeId: logicNode.data.identifier.id, 
            nodeName: logicNode.data.identifier.displayName,
            info: { portId, connectedEdges: connectedEdges.length, nodeType: logicNode.type }
          }
        );
      }
    }
  }
}

export function validateBooleanTypeConnections(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): void {
  // Validate boolean inputs for boolean operations and the condition input of if_else
  const booleanNodes = nodes.filter(node => node.type === 'boolean_op' || node.type === 'if_else');
  
  for (const booleanNode of booleanNodes) {
    // Safety check for node data
    if (!booleanNode.data?.identifier?.id || !booleanNode.data?.identifier?.displayName) {
      continue; // Skip nodes with invalid data structure
    }
    
    const incomingEdges = edges.filter(edge => edge.target === booleanNode.data.identifier.id);
    
    for (const edge of incomingEdges) {
      // For if_else nodes, only the 'condition' port must be boolean. Skip other ports.
      if (booleanNode.type === 'if_else' && edge.targetHandle !== 'condition') {
        continue;
      }
      const sourceNode = nodes.find(n => n.data?.identifier?.id === edge.source);
      if (!sourceNode?.data?.identifier?.displayName) continue;

      // Infer effective logical type, resolving pass-through (e.g., if_else)
      const effectiveType = inferEffectiveLogicalType(edge.source, edge.sourceHandle!, nodes, edges);
      const isValidBooleanSource = effectiveType === 'boolean';
      
      if (!isValidBooleanSource) {
        const nodeTypeLabel = booleanNode.type === 'if_else' ? 'If/Else' : 'Boolean operation';
        let errorMessage = `${nodeTypeLabel} "${booleanNode.data.identifier.displayName}" can only accept boolean inputs on port "${edge.targetHandle}". Connected from "${sourceNode.data.identifier.displayName}"`;
        
        if (sourceNode.type === 'constants') {
          const constantsData = sourceNode.data as unknown as { valueType?: string };
          errorMessage += ` which is configured to output ${constantsData.valueType ?? 'unknown'} values. Set the Constants node to output boolean values instead.`;
        } else {
          errorMessage += ` which is not inferred as boolean. Only boolean sources are allowed.`;
        }
        
        throw new InvalidConnectionError(
          errorMessage,
          { 
            nodeId: booleanNode.data.identifier.id,
            nodeName: booleanNode.data.identifier.displayName,
            sourceNodeId: sourceNode.data.identifier.id,
            info: { expectedType: 'boolean', actualType: sourceNode.type === 'constants' ? (sourceNode.data as { valueType?: string }).valueType : effectiveType }
          }
        );
      }
    }
  }
}

export function validateNumberTypeConnections(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): void {
  // Validate both math operations and compare nodes - they all require number inputs
  const mathNodes = nodes.filter(node => node.type === 'math_op' || node.type === 'compare');
  
  for (const mathNode of mathNodes) {
    // Safety check for node data
    if (!mathNode.data?.identifier?.id || !mathNode.data?.identifier?.displayName) {
      continue; // Skip nodes with invalid data structure
    }
    
    const incomingEdges = edges.filter(edge => edge.target === mathNode.data.identifier.id);
    
    for (const edge of incomingEdges) {
      const sourceNode = nodes.find(n => n.data?.identifier?.id === edge.source);
      if (!sourceNode?.data?.identifier?.displayName) continue;

      // Infer effective logical type, resolving pass-through (e.g., if_else)
      const effectiveType = inferEffectiveLogicalType(edge.source, edge.sourceHandle!, nodes, edges);
      const isValidNumberSource = effectiveType === 'number';

      if (!isValidNumberSource) {
        const nodeTypeLabel = mathNode.type === 'compare' ? 'Compare operation' : 'Math operation';
        let errorMessage = `${nodeTypeLabel} "${mathNode.data.identifier.displayName}" can only accept number inputs. Connected from "${sourceNode.data.identifier.displayName}"`;
        
        if (sourceNode.type === 'constants') {
          const constantsData = sourceNode.data as unknown as { valueType?: string };
          errorMessage += ` which is configured to output ${constantsData.valueType ?? 'unknown'} values. Set the Constants node to output number values instead.`;
        } else {
          errorMessage += ` which is not inferred as number. Only number sources are allowed.`;
        }
        
        throw new InvalidConnectionError(
          errorMessage,
          { 
            nodeId: mathNode.data.identifier.id,
            nodeName: mathNode.data.identifier.displayName,
            sourceNodeId: sourceNode.data.identifier.id,
            info: { expectedType: 'number', actualType: sourceNode.type === 'constants' ? (sourceNode.data as { valueType?: string }).valueType : effectiveType }
          }
        );
      }
    }
  }
}

// Helper: infer effective logical type of a node's output by tracing upstream
type LogicalType = 'number' | 'boolean' | 'string' | 'color' | 'unknown';

function inferEffectiveLogicalType(
  sourceNodeId: string,
  sourcePortId: string,
  nodes: ReactFlowNode<NodeData>[],
  edges: ReactFlowEdge[],
  visited: Set<string> = new Set()
): LogicalType {
  const visitKey = `${sourceNodeId}::${sourcePortId}`;
  if (visited.has(visitKey)) return 'unknown';
  visited.add(visitKey);

  const node = nodes.find(n => n.data?.identifier?.id === sourceNodeId);
  if (!node) return 'unknown';

  switch (node.type) {
    case 'math_op':
      return 'number';
    case 'compare':
    case 'boolean_op':
      return 'boolean';
    case 'constants': {
      const data = node.data as unknown as { valueType?: string };
      const vt = (data.valueType ?? 'unknown') as LogicalType;
      return vt === 'number' || vt === 'boolean' || vt === 'string' || vt === 'color' ? vt : 'unknown';
    }
    case 'if_else': {
      // Outputs inherit type of 'data' input
      const incoming = edges.filter(e => e.target === sourceNodeId && e.targetHandle === 'data');
      if (incoming.length !== 1) return 'unknown';
      const from = incoming[0];
      return inferEffectiveLogicalType(from.source, from.sourceHandle!, nodes, edges, visited);
    }
    case 'merge': {
      // Homogeneous type pass-through: all inputs must resolve to the same non-unknown type
      const incoming = edges.filter(e => e.target === sourceNodeId && !!e.targetHandle);
      if (incoming.length === 0) return 'unknown';
      const types = incoming.map(e => inferEffectiveLogicalType(e.source, e.sourceHandle!, nodes, edges, visited))
        .filter(t => t !== 'unknown');
      if (types.length === 0) return 'unknown';
      const unique = Array.from(new Set(types));
      return unique.length === 1 ? unique[0] : 'unknown';
    }
    default:
      return 'unknown';
  }
}

export function validateProperFlow(nodes: ReactFlowNode<NodeData>[], edges: ReactFlowEdge[]): void {
  const geometryNodeTypes = getNodesByCategory('geometry').map((def) => def.type);
  const geometryNodes = nodes.filter((n) => geometryNodeTypes.includes(n.type!));

  // Find all potential terminus nodes - nodes that can end a flow
  const outputNodeTypes = getNodesByCategory('output').map((def) => def.type);
  const logicNodeTypes = getNodesByCategory('logic').map((def) => def.type);
  
  // Include both output nodes (Scene) and terminal logic nodes (Result)
  const allTerminusTypes = [...outputNodeTypes, ...logicNodeTypes.filter(type => type === 'result')];

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
  
  // Include both output nodes (Scene) and terminal logic nodes (Result)
  const allTerminusTypes = [...outputNodeTypes, ...logicNodeTypes.filter(type => type === 'result')];
  
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
  // Enable verbose logging based on environment or flow complexity
  const shouldLogVerbose = process.env.DEBUG_VALIDATION === 'true' || nodes.length > 10;
  
  if (shouldLogVerbose) {
    logger.debug('Starting duplicate object ID validation');
    logger.debug('Validation nodes', { nodes: nodes.map(n => ({ id: n.data.identifier.id, type: n.type })) });
    logger.debug('Validation edges', { edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target })) });
  }

  for (const targetNode of nodes) {
    // Only merge nodes are allowed to receive duplicate object IDs
    if (targetNode.type === 'merge') {
      if (shouldLogVerbose) logger.debug(`Skipping merge node: ${targetNode.data.identifier.displayName}`);
      continue;
    }
    
    const incomingObjectIds = getIncomingObjectIds(targetNode.data.identifier.id, edges, nodes, shouldLogVerbose);
    const duplicates = incomingObjectIds.filter((id, index) => incomingObjectIds.indexOf(id) !== index);
    
    // Only log verbose details for complex flows or when explicitly enabled
    if (shouldLogVerbose && incomingObjectIds.length > 1) {
      logger.debug(`Checked ${targetNode.data.identifier.displayName}`, { 
        incomingObjectIds: incomingObjectIds.length,
        duplicates: duplicates.length
      });
    }
    
    if (duplicates.length > 0) {
      logger.error(`Duplicate object IDs detected for ${targetNode.data.identifier.displayName}`);
      throw new DuplicateObjectIdsError(
        targetNode.data.identifier.displayName, 
        targetNode.data.identifier.id, 
        duplicates
      );
    }
  }
  
  if (shouldLogVerbose) {
    logger.debug('No duplicate object IDs found - validation passed');
  }
}

// Helper functions (optimized for complex flows)
function getIncomingObjectIds(targetNodeId: string, edges: ReactFlowEdge[], nodes: ReactFlowNode<NodeData>[], enableDetailedLogging = false): string[] {
  if (enableDetailedLogging) {
    logger.debug(`Starting upstream trace for node: ${targetNodeId}`);
  }
  
  const geometryNodeTypes = getNodesByCategory('geometry').map((def) => def.type);
  if (enableDetailedLogging) {
    logger.debug('Geometry node types', { geometryNodeTypes });
  }

  const nodeByIdentifierId = new Map<string, ReactFlowNode<NodeData>>();
  nodes.forEach(node => {
    nodeByIdentifierId.set(node.data.identifier.id, node);
  });

  const traceUpstreamNode = (currentNodeId: string, pathVisited: Set<string>, depth = 0, pathId = 'root'): string[] => {
    const indent = '  '.repeat(depth);
    if (enableDetailedLogging) {
      logger.debug(`${indent}[Path ${pathId}] Visiting node: ${currentNodeId}`);
    }
    
    if (pathVisited.has(currentNodeId)) {
      if (enableDetailedLogging) {
        logger.debug(`${indent}[Path ${pathId}] Cycle detected in this path, skipping`);
      }
      return [];
    }
    
    const newPathVisited = new Set(pathVisited);
    newPathVisited.add(currentNodeId);
    
    const currentNode = nodeByIdentifierId.get(currentNodeId);
    if (!currentNode) {
      logger.warn(`${indent}[Path ${pathId}] Node not found for ID: ${currentNodeId}`);
      return [];
    }
    
    if (enableDetailedLogging) {
      logger.debug(`${indent}[Path ${pathId}] Found node: ${currentNode.data.identifier.displayName} (type: ${currentNode.type})`);
    }
    
    const objectIds: string[] = [];
    
    // Special handling for merge nodes - they deduplicate upstream objects
    if (currentNode.type === 'merge') {
      if (enableDetailedLogging) {
        logger.debug(`${indent}[Path ${pathId}] MERGE NODE DETECTED - will deduplicate upstream objects`);
      }
      
      const incomingEdges = edges.filter((edge) => edge.target === currentNodeId);
      const allUpstreamObjects: string[] = [];
      
      incomingEdges.forEach((edge, index) => {
        const subPathId = `${pathId}.merge.${index}`;
        if (enableDetailedLogging) {
          logger.debug(`${indent}[Path ${pathId}] Following merge input from: ${edge.source} (path: ${subPathId})`);
        }
        
        const upstreamObjects = traceUpstreamNode(edge.source, newPathVisited, depth + 1, subPathId);
        allUpstreamObjects.push(...upstreamObjects);
      });
      
      const uniqueObjects = [...new Set(allUpstreamObjects)];
      if (enableDetailedLogging) {
        logger.debug(`${indent}[Path ${pathId}] Merge deduplication: ${allUpstreamObjects.length} → ${uniqueObjects.length} objects`);
        logger.debug(`${indent}[Path ${pathId}] Before merge`, { allUpstreamObjects });
        logger.debug(`${indent}[Path ${pathId}] After merge`, { uniqueObjects });
      }
      
      return uniqueObjects;
    }
    
    // If this is a geometry node, add its object ID
    if (geometryNodeTypes.includes(currentNode.type!)) {
      if (enableDetailedLogging) {
        logger.debug(`${indent}[Path ${pathId}] Adding geometry object ID: ${currentNode.data.identifier.id}`);
      }
      objectIds.push(currentNode.data.identifier.id);
    }
    
    // Trace upstream from all incoming edges
    const incomingEdges = edges.filter((edge) => edge.target === currentNodeId);
    if (enableDetailedLogging) {
      logger.debug(`${indent}[Path ${pathId}] Incoming edges`, { edges: incomingEdges.map(e => ({ from: e.source, to: e.target })) });
    }
    
    incomingEdges.forEach((edge, index) => {
      const subPathId = `${pathId}.${index}`;
      if (enableDetailedLogging) {
        logger.debug(`${indent}[Path ${pathId}] Following edge from: ${edge.source} (new path: ${subPathId})`);
      }
      const upstreamObjects = traceUpstreamNode(edge.source, newPathVisited, depth + 1, subPathId);
      objectIds.push(...upstreamObjects);
    });
    
    return objectIds;
  };

  const result = traceUpstreamNode(targetNodeId, new Set<string>());
  
  if (enableDetailedLogging) {
    logger.debug(`Final result for ${targetNodeId}`, { result });
    logger.debug('Unique object IDs', { uniqueIds: [...new Set(result)] });
    logger.debug('Duplicate detection', { total: result.length, unique: new Set(result).size });
  }
  
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

// isNodeConnectedToScene function removed as it was unused

// findAllPathsToScene function removed as it was unused

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