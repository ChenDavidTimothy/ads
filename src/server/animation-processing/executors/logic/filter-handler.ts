import {
  setNodeOutput,
  getConnectedInputs,
  type ExecutionContext,
} from "../../execution-context";
import type { ReactFlowNode, ReactFlowEdge } from "../../types/graph";
import type { NodeData } from "@/shared/types";
import {
  extractObjectIdsFromInputs,
  pickCursorsForIds,
} from "../../scene/scene-assembler";
import type { PerObjectAssignments } from "@/shared/properties/assignments";
import {
  extractCursorsFromInputs,
  extractPerObjectAnimationsFromInputs,
  extractPerObjectAssignmentsFromInputs,
} from "./shared/per-object";

export async function executeFilterNode(
  node: ReactFlowNode<NodeData>,
  context: ExecutionContext,
  connections: ReactFlowEdge[],
): Promise<void> {
  const data = node.data as unknown as Record<string, unknown>;
  const selectedObjectIds = (data.selectedObjectIds as string[]) || [];

  const inputs = getConnectedInputs(
    context,
    connections as unknown as Array<{
      target: string;
      targetHandle: string;
      source: string;
      sourceHandle: string;
    }>,
    node.data.identifier.id,
    "input",
  );

  if (inputs.length === 0) {
    setNodeOutput(
      context,
      node.data.identifier.id,
      "output",
      "object_stream",
      [],
      { perObjectTimeCursor: {}, perObjectAssignments: {} },
    );
    return;
  }

  const filteredResults: unknown[] = [];
  const upstreamCursorMap = extractCursorsFromInputs(inputs);
  const upstreamBatchOverridesList: Array<
    undefined | Record<string, Record<string, Record<string, unknown>>>
  > = inputs.map((i) => {
    const m = i.metadata as
      | {
          perObjectBatchOverrides?: Record<
            string,
            Record<string, Record<string, unknown>>
          >;
        }
      | undefined;
    return m?.perObjectBatchOverrides;
  });
  const upstreamBoundFieldsList: Array<undefined | Record<string, string[]>> =
    inputs.map((i) => {
      const m = i.metadata as
        | {
            perObjectBoundFields?: Record<string, string[]>;
          }
        | undefined;
      return m?.perObjectBoundFields;
    });

  for (const input of inputs) {
    const inputData = Array.isArray(input.data) ? input.data : [input.data];

    for (const item of inputData) {
      if (hasFilterableObjects(item)) {
        const filtered = filterItem(item, selectedObjectIds);
        if (filtered) {
          filteredResults.push(filtered);
        }
      } else {
        filteredResults.push(item);
      }
    }
  }

  const filteredIds = extractObjectIdsFromInputs([{ data: filteredResults }]);
  const propagatedCursors = pickCursorsForIds(upstreamCursorMap, filteredIds);
  const propagatedAnimations = extractPerObjectAnimationsFromInputs(
    inputs,
    filteredIds,
  );
  const propagatedAssignments: PerObjectAssignments =
    extractPerObjectAssignmentsFromInputs(inputs, filteredIds);

  const propagatedBatchOverrides: Record<
    string,
    Record<string, Record<string, unknown>>
  > = {};
  for (const m of upstreamBatchOverridesList) {
    if (!m) continue;
    for (const [objectId, fields] of Object.entries(m)) {
      if (!filteredIds.includes(objectId)) continue;
      propagatedBatchOverrides[objectId] = {
        ...(propagatedBatchOverrides[objectId] ?? {}),
        ...fields,
      };
    }
  }

  const propagatedBoundFields: Record<string, string[]> = {};
  for (const m of upstreamBoundFieldsList) {
    if (!m) continue;
    for (const [objectId, list] of Object.entries(m)) {
      if (!filteredIds.includes(objectId)) continue;
      const existing = propagatedBoundFields[objectId] ?? [];
      propagatedBoundFields[objectId] = Array.from(
        new Set([...existing, ...list.map(String)]),
      );
    }
  }

  setNodeOutput(
    context,
    node.data.identifier.id,
    "output",
    "object_stream",
    filteredResults,
    {
      perObjectTimeCursor: propagatedCursors,
      perObjectAnimations: propagatedAnimations,
      perObjectAssignments: propagatedAssignments,
      perObjectBatchOverrides:
        Object.keys(propagatedBatchOverrides).length > 0
          ? propagatedBatchOverrides
          : undefined,
      perObjectBoundFields:
        Object.keys(propagatedBoundFields).length > 0
          ? propagatedBoundFields
          : undefined,
    },
  );
}

function hasFilterableObjects(item: unknown): boolean {
  return typeof item === "object" && item !== null && "id" in item;
}

function filterItem(item: unknown, selectedObjectIds: string[]): unknown {
  if (typeof item === "object" && item !== null && "id" in item) {
    const objectId = (item as { id: string }).id;
    return selectedObjectIds.includes(objectId) ? item : null;
  }

  return item;
}
