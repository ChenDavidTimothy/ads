import {
  setNodeOutput,
  getConnectedInputs,
  type ExecutionContext,
  type ExecutionValue,
} from '../../execution-context';
import type { ReactFlowNode, ReactFlowEdge } from '../../types/graph';
import { mergeCursorMaps, isPerObjectCursorMap } from '../../scene/scene-assembler';
import type { NodeData } from '@/shared/types';
import { logger } from '@/lib/logger';
import {
  extractPerObjectAnimationsFromInputsWithPriority,
  extractPerObjectAssignmentsFromInputsWithPriority,
} from './shared/per-object';

export async function executeMergeNode(
  node: ReactFlowNode<NodeData>,
  context: ExecutionContext,
  connections: ReactFlowEdge[]
): Promise<void> {
  logger.debug(`Starting merge execution for node: ${node.data.identifier.displayName}`);

  const data = node.data as unknown as Record<string, unknown>;
  const portCount = Number(data.inputPortCount) || 2;

  logger.debug(`Merge port count: ${portCount}`);

  const portInputs: ExecutionValue[][] = [];
  for (let i = 1; i <= portCount; i++) {
    const inputs = getConnectedInputs(
      context,
      connections as unknown as Array<{
        target: string;
        targetHandle: string;
        source: string;
        sourceHandle: string;
      }>,
      node.data.identifier.id,
      `input${i}`
    );
    portInputs.push(inputs);
    logger.debug(`Merge port ${i} inputs`, { connections: inputs.length });
  }

  const mergedObjects = new Map<string, unknown>();
  const allCursorMaps: Record<string, number>[] = [];

  logger.debug('Processing ports in reverse order for priority (Port 1 = highest priority)');

  for (let portIndex = portCount - 1; portIndex >= 0; portIndex--) {
    const inputs = portInputs[portIndex];
    if (!inputs) continue;
    logger.debug(`Processing port ${portIndex + 1}`, {
      inputs: inputs.length,
    });

    for (const input of inputs) {
      const inputData = Array.isArray(input.data) ? input.data : [input.data];
      logger.debug(`Port ${portIndex + 1} input data`, {
        items: inputData.length,
      });

      const maybeMap = (input.metadata as { perObjectTimeCursor?: unknown } | undefined)
        ?.perObjectTimeCursor;
      if (isPerObjectCursorMap(maybeMap)) {
        allCursorMaps.push(maybeMap);
      }

      for (const obj of inputData) {
        if (typeof obj === 'object' && obj !== null && 'id' in obj) {
          const objectId = (obj as { id: string }).id;

          const existingObject = mergedObjects.get(objectId);
          if (existingObject) {
            logger.debug(`Object ID conflict detected: ${objectId}`, {
              existingObject,
              newObject: obj,
              resolution: `Port ${portIndex + 1} overwrites previous`,
            });
          } else {
            logger.debug(`Adding new object ID: ${objectId} from port ${portIndex + 1}`);
          }

          mergedObjects.set(objectId, obj);
        } else {
          logger.debug('Non-object or object without ID', { obj });
        }
      }
    }
  }

  const mergedResult = Array.from(mergedObjects.values());
  const mergedCursors = mergeCursorMaps(allCursorMaps);
  const mergedIds = mergedResult
    .map((obj) =>
      typeof obj === 'object' && obj !== null && 'id' in obj ? (obj as { id: string }).id : null
    )
    .filter(Boolean) as string[];
  const propagatedAnimations = extractPerObjectAnimationsFromInputsWithPriority(
    portInputs,
    mergedIds
  );
  const propagatedAssignments = extractPerObjectAssignmentsFromInputsWithPriority(
    portInputs,
    mergedIds
  );

  const inputObjectCount = portInputs.flat().reduce((acc, input) => {
    const inputData = Array.isArray(input.data) ? input.data : [input.data];
    return acc + inputData.length;
  }, 0);
  const outputIds = mergedResult
    .map((obj) =>
      typeof obj === 'object' && obj !== null && 'id' in obj ? (obj as { id: string }).id : null
    )
    .filter((id) => id !== null);
  logger.debug('Final merged result', {
    inputObjectCount,
    outputObjectCount: mergedResult.length,
    uniqueObjectIds: outputIds,
  });

  const uniqueOutputIds = new Set(outputIds);
  logger.debug('Output verification', {
    totalIds: outputIds.length,
    uniqueIds: uniqueOutputIds.size,
  });

  if (outputIds.length !== uniqueOutputIds.size) {
    console.error(`[MERGE] ERROR: Merge node is outputting duplicate object IDs!`);
    console.error(`[MERGE] All output IDs:`, outputIds);
    console.error(
      `[MERGE] Duplicate IDs:`,
      outputIds.filter((id, index) => outputIds.indexOf(id) !== index)
    );
    throw new Error(`Merge node ${node.data.identifier.displayName} failed to deduplicate objects`);
  }

  setNodeOutput(context, node.data.identifier.id, 'output', 'object_stream', mergedResult, {
    perObjectTimeCursor: mergedCursors,
    perObjectAnimations: propagatedAnimations,
    perObjectAssignments: propagatedAssignments,
    perObjectBatchOverrides: (() => {
      const out: Record<string, Record<string, Record<string, unknown>>> = {};
      for (let portIndex = portInputs.length - 1; portIndex >= 0; portIndex--) {
        const inputs = portInputs[portIndex];
        if (!inputs) continue;
        for (const input of inputs) {
          const fromMeta = (
            input.metadata as
              | {
                  perObjectBatchOverrides?: Record<string, Record<string, Record<string, unknown>>>;
                }
              | undefined
          )?.perObjectBatchOverrides;
          if (!fromMeta) continue;
          for (const [objectId, fields] of Object.entries(fromMeta)) {
            const destFields = out[objectId] ?? {};
            for (const [fieldPath, byKey] of Object.entries(fields)) {
              const existing = destFields[fieldPath] ?? {};
              destFields[fieldPath] = { ...existing, ...byKey };
            }
            out[objectId] = destFields;
          }
        }
      }
      return Object.keys(out).length > 0 ? out : undefined;
    })(),
  });

  logger.debug('Merge execution completed successfully');
}
