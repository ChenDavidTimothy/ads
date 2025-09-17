import { setNodeOutput, getConnectedInputs, type ExecutionContext } from '../../execution-context';
import type { ReactFlowNode, ReactFlowEdge } from '../../types/graph';
import type { NodeData } from '@/shared/types';
import { extractObjectIdsFromInputs } from '../../scene/scene-assembler';
import {
  extractCursorsFromInputs,
  extractPerObjectAnimationsFromInputs,
  extractPerObjectAssignmentsFromInputs,
} from './shared/per-object';
import { DomainError, type DomainErrorCode } from '@/shared/errors/domain';

export async function executeBatchNode(
  node: ReactFlowNode<NodeData>,
  context: ExecutionContext,
  connections: ReactFlowEdge[]
): Promise<void> {
  const data = node.data as unknown as Record<string, unknown>;

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

  if (inputs.length === 0) {
    setNodeOutput(context, node.data.identifier.id, 'output', 'object_stream', [], {
      perObjectTimeCursor: {},
      perObjectAnimations: {},
      perObjectAssignments: {},
    });
    return;
  }

  const inputObjectIds = extractObjectIdsFromInputs(inputs);

  const bindings =
    (data.variableBindings as
      | Record<string, { target?: string; boundResultNodeId?: string }>
      | undefined) ?? {};
  const bindingsByObject =
    (data.variableBindingsByObject as
      | Record<string, Record<string, { target?: string; boundResultNodeId?: string }>>
      | undefined) ?? {};

  const readVarGlobal = (key: string): unknown => {
    const rid = bindings[key]?.boundResultNodeId;
    if (!rid) return undefined;
    return (context.nodeOutputs.get(`${rid}.output`) ?? context.nodeOutputs.get(`${rid}.result`))
      ?.data;
  };
  const readVarForObject =
    (objectId: string | undefined) =>
    (key: string): unknown => {
      if (!objectId) return readVarGlobal(key);
      const rid = bindingsByObject[objectId]?.[key]?.boundResultNodeId;
      if (rid)
        return (
          context.nodeOutputs.get(`${rid}.output`) ?? context.nodeOutputs.get(`${rid}.result`)
        )?.data;
      return readVarGlobal(key);
    };

  const emptyKeyObjectIds: string[] = [];
  const tagged: unknown[] = [];

  for (const input of inputs) {
    const inputData = Array.isArray(input.data) ? input.data : [input.data];
    for (const obj of inputData) {
      if (typeof obj === 'object' && obj !== null && 'id' in obj) {
        const objectId = (obj as { id: string }).id;
        const objWithBatch = obj as Record<string, unknown> & {
          batch?: boolean;
          batchKeys?: string[];
        };

        const perObjectVal = readVarForObject(objectId)('key');
        const globalVal = readVarGlobal('key');
        const literalVal = (data as { key?: unknown }).key;

        const coerceToKeys = (v: unknown): string[] => {
          if (Array.isArray(v)) {
            return v
              .map((x) =>
                typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean'
                  ? String(x).trim()
                  : ''
              )
              .filter((s) => s.length > 0);
          }
          if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
            const s = String(v).trim();
            return s.length > 0 ? [s] : [];
          }
          return [];
        };

        const resolvedKeys = (() => {
          const fromPerObject = coerceToKeys(perObjectVal);
          if (fromPerObject.length > 0) return fromPerObject;
          const fromGlobal = coerceToKeys(globalVal);
          if (fromGlobal.length > 0) return fromGlobal;
          const fromLiteral = coerceToKeys(literalVal);
          if (fromLiteral.length > 0) return fromLiteral;
          const keysArray = (data as { keys?: unknown[] }).keys;
          if (Array.isArray(keysArray)) {
            const fromKeysArray = keysArray
              .map((k) => (typeof k === 'string' ? k.trim() : String(k).trim()))
              .filter((k) => k.length > 0);
            if (fromKeysArray.length > 0) return fromKeysArray;
          }
          return [];
        })();

        if (resolvedKeys.length === 0) {
          emptyKeyObjectIds.push(objectId);
        }

        const prevKeys = (() => {
          const arr = (objWithBatch as { batchKeys?: unknown }).batchKeys;
          return Array.isArray(arr) ? (arr as string[]) : [];
        })();
        const alreadyTagged = objWithBatch.batch === true && prevKeys.length > 0;
        if (alreadyTagged) {
          const same =
            prevKeys.length === resolvedKeys.length &&
            prevKeys.every((k) => resolvedKeys.includes(k));
          if (!same) {
            throw new DomainError(
              `Batch node '${node.data.identifier.displayName}' received already-tagged objects. Only one Batch node allowed per object path.`,
              'ERR_BATCH_DOUBLE_TAG' as DomainErrorCode,
              {
                nodeId: node.data.identifier.id,
                nodeName: node.data.identifier.displayName,
                objectIds: [objectId],
              }
            );
          }
        }

        const outTagged = {
          ...objWithBatch,
          batch: true,
          batchKeys: resolvedKeys,
        } as Record<string, unknown>;
        tagged.push(outTagged);
      } else {
        tagged.push(obj);
      }
    }
  }

  if (emptyKeyObjectIds.length > 0) {
    const maxDisplay = 20;
    const displayedIds = emptyKeyObjectIds.slice(0, maxDisplay);
    const remainingCount = emptyKeyObjectIds.length - maxDisplay;
    const remainingText = remainingCount > 0 ? ` ...+${remainingCount} more` : '';
    const objectIdsText = displayedIds.join(', ') + remainingText;
    throw new DomainError(
      `Batch node '${node.data.identifier.displayName}' received objects with empty keys: [${objectIdsText}]`,
      'ERR_BATCH_EMPTY_KEY' as DomainErrorCode,
      {
        nodeId: node.data.identifier.id,
        nodeName: node.data.identifier.displayName,
        info: { objectIds: emptyKeyObjectIds },
      }
    );
  }

  const perObjectTimeCursor = extractCursorsFromInputs(inputs);
  const perObjectAnimations = extractPerObjectAnimationsFromInputs(inputs, inputObjectIds);
  const perObjectAssignments = extractPerObjectAssignmentsFromInputs(inputs, inputObjectIds);

  setNodeOutput(context, node.data.identifier.id, 'output', 'object_stream', tagged, {
    perObjectTimeCursor,
    perObjectAnimations,
    perObjectAssignments,
  });
}
