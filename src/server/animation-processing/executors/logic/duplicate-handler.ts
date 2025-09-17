import { setNodeOutput, getConnectedInputs, type ExecutionContext } from '../../execution-context';
import type { ReactFlowNode, ReactFlowEdge } from '../../types/graph';
import type { NodeData } from '@/shared/types';
import type { PerObjectAssignments, ObjectAssignments } from '@/shared/properties/assignments';
import type { SceneAnimationTrack } from '@/shared/types/scene';
import { logger } from '@/lib/logger';
import {
  extractPerObjectAssignmentsFromInputs,
  extractPerObjectAnimationsFromInputs,
  extractCursorsFromInputs,
} from './shared/per-object';
import { DuplicateNodeError, DuplicateCountExceededError } from '@/shared/errors/domain';

export async function executeDuplicateNode(
  node: ReactFlowNode<NodeData>,
  context: ExecutionContext,
  connections: ReactFlowEdge[]
): Promise<void> {
  logger.debug(`Starting duplicate execution for node: ${node.data.identifier.displayName}`);

  const data = node.data as unknown as Record<string, unknown>;
  const count = Math.min(Math.max(Number(data.count) || 1, 1), 50);

  const inputs = getConnectedInputs(
    context,
    connections as unknown as Array<{
      target: string;
      targetHandle: string;
      source: string;
      sourceHandle: string;
    }>,
    node.data.identifier.id,
    'input'
  );

  const totalInputObjects = inputs.reduce((acc, input) => {
    const inputData = Array.isArray(input.data) ? input.data : [input.data];
    return acc + inputData.length;
  }, 0);

  validateDuplicateInputs(
    count,
    totalInputObjects,
    node.data.identifier.id,
    node.data.identifier.displayName
  );

  if (inputs.length === 0) {
    logger.debug('No inputs connected to duplicate node');
    setNodeOutput(context, node.data.identifier.id, 'output', 'object_stream', [], {
      perObjectTimeCursor: {},
      perObjectAnimations: {},
      perObjectAssignments: {},
    });
    return;
  }

  const inputObjectIds: string[] = [];
  for (const input of inputs) {
    const inputData = Array.isArray(input.data) ? input.data : [input.data];
    for (const obj of inputData) {
      if (hasValidObjectStructure(obj)) {
        inputObjectIds.push((obj as { id: string }).id);
      }
    }
  }

  const upstreamAssignments = extractPerObjectAssignmentsFromInputs(inputs, inputObjectIds);
  const upstreamAnimations = extractPerObjectAnimationsFromInputs(inputs, inputObjectIds);
  const upstreamCursors = extractCursorsFromInputs(inputs);

  const allOutputObjects: unknown[] = [];
  const expandedAssignments: PerObjectAssignments = {};
  const expandedAnimations: Record<string, SceneAnimationTrack[]> = {};
  const expandedCursors: Record<string, number> = {};
  const allExistingIds = getAllExistingObjectIds(context);
  const newlyCreatedIds = new Set<string>();

  for (const input of inputs) {
    const inputData = Array.isArray(input.data) ? input.data : [input.data];

    for (const originalObject of inputData) {
      if (!hasValidObjectStructure(originalObject)) {
        allOutputObjects.push(originalObject);
        continue;
      }

      const originalId = (originalObject as { id: string }).id;

      allOutputObjects.push(originalObject);
      copyMetadataForObject(
        originalId,
        originalId,
        upstreamAssignments,
        upstreamAnimations,
        upstreamCursors,
        expandedAssignments,
        expandedAnimations,
        expandedCursors
      );

      for (let i = 1; i < count; i++) {
        const duplicateId = generateUniqueId(originalId, i, allExistingIds, newlyCreatedIds);
        const duplicate = createDuplicateObject(originalObject, duplicateId);
        allOutputObjects.push(duplicate);
        copyMetadataForObject(
          originalId,
          duplicateId,
          upstreamAssignments,
          upstreamAnimations,
          upstreamCursors,
          expandedAssignments,
          expandedAnimations,
          expandedCursors
        );
        newlyCreatedIds.add(duplicateId);
      }
    }
  }

  logger.debug(`Duplicate execution complete. Output: ${allOutputObjects.length} objects`);

  setNodeOutput(context, node.data.identifier.id, 'output', 'object_stream', allOutputObjects, {
    perObjectTimeCursor: expandedCursors,
    perObjectAnimations: expandedAnimations,
    perObjectAssignments: expandedAssignments,
  });
}

function validateDuplicateInputs(
  count: number,
  totalInputObjects: number,
  nodeId: string,
  nodeDisplayName: string
): void {
  if (totalInputObjects === 0) {
    throw new DuplicateNodeError(
      nodeId,
      nodeDisplayName,
      'Duplicate node requires at least one input object'
    );
  }
  if (count < 1) {
    throw new DuplicateNodeError(nodeId, nodeDisplayName, 'Duplicate count must be at least 1');
  }
  if (count > 50) {
    throw new DuplicateCountExceededError(nodeId, nodeDisplayName, count, 50);
  }

  const totalOutput = totalInputObjects * count;
  if (totalOutput > 200) {
    throw new DuplicateNodeError(
      nodeId,
      nodeDisplayName,
      `Operation would create ${totalOutput} objects, exceeding system limit of 200`
    );
  }
}

function hasValidObjectStructure(obj: unknown): boolean {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    typeof (obj as { id: unknown }).id === 'string'
  );
}

function generateUniqueId(
  originalId: string,
  index: number,
  existingIds: Set<string>,
  newIds: Set<string>
): string {
  const baseId = `${originalId}_dup_${index.toString().padStart(3, '0')}`;
  let candidateId = baseId;
  let suffix = 0;

  while (existingIds.has(candidateId) || newIds.has(candidateId)) {
    suffix++;
    candidateId = `${baseId}_${suffix}`;
  }

  return candidateId;
}

function getAllExistingObjectIds(context: ExecutionContext): Set<string> {
  const ids = new Set<string>();

  for (const output of context.nodeOutputs.values()) {
    if (output.type !== 'object_stream') continue;

    const objects = Array.isArray(output.data) ? output.data : [output.data];
    for (const obj of objects) {
      if (hasValidObjectStructure(obj)) {
        ids.add((obj as { id: string }).id);
      }
    }
  }

  return ids;
}

function createDuplicateObject(original: unknown, duplicateId: string): unknown {
  const duplicate = JSON.parse(JSON.stringify(original)) as Record<string, unknown>;
  duplicate.id = duplicateId;
  return duplicate;
}

function copyMetadataForObject(
  sourceId: string,
  targetId: string,
  sourceAssignments: PerObjectAssignments | undefined,
  sourceAnimations: Record<string, SceneAnimationTrack[]>,
  sourceCursors: Record<string, number>,
  targetAssignments: PerObjectAssignments,
  targetAnimations: Record<string, SceneAnimationTrack[]>,
  targetCursors: Record<string, number>
): void {
  if (sourceAssignments?.[sourceId]) {
    try {
      targetAssignments[targetId] = JSON.parse(
        JSON.stringify(sourceAssignments[sourceId])
      ) as ObjectAssignments;
    } catch (error) {
      logger.warn(`Failed to clone assignments for ${sourceId}->${targetId}:`, {
        error: String(error),
      });
      targetAssignments[targetId] = {} as ObjectAssignments;
    }
  }

  if (sourceAnimations[sourceId]) {
    try {
      targetAnimations[targetId] = sourceAnimations[sourceId].map((anim) => ({
        ...anim,
        objectId: targetId,
        id: anim.id.replace(sourceId, targetId),
        properties: JSON.parse(JSON.stringify(anim.properties)) as typeof anim.properties,
      })) as SceneAnimationTrack[];
    } catch (error) {
      logger.warn(`Failed to clone animations for ${sourceId}->${targetId}:`, {
        error: String(error),
      });
      targetAnimations[targetId] = [];
    }
  }

  if (sourceCursors[sourceId] !== undefined) {
    targetCursors[targetId] = sourceCursors[sourceId];
  }
}
