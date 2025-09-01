// src/server/animation-processing/executors/logic-executor.ts
import type { NodeData } from "@/shared/types";
import type { SceneAnimationTrack } from "@/shared/types/scene";
import {
  setNodeOutput,
  getConnectedInputs,
  getTypedConnectedInput,
  getConnectedInput,
  type ExecutionContext,
  type ExecutionValue,
} from "../execution-context";
import type { ReactFlowNode, ReactFlowEdge } from "../types/graph";
import { BaseExecutor } from "./base-executor";
import {
  extractObjectIdsFromInputs,
  isPerObjectCursorMap,
  mergeCursorMaps,
  pickCursorsForIds,
} from "../scene/scene-assembler";
import { TypeValidationError } from "@/shared/types/validation";
import {
  MultipleResultValuesError,
  DuplicateNodeError,
  DuplicateCountExceededError,
  DomainError,
  type DomainErrorCode,
} from "@/shared/errors/domain";
import { logger } from "@/lib/logger";
import type { PerObjectAssignments } from "@/shared/properties/assignments";
import {
  mergeObjectAssignments,
  isObjectAssignments,
  type ObjectAssignments,
} from "@/shared/properties/assignments";

export class LogicNodeExecutor extends BaseExecutor {
  // Register all logic node handlers
  protected registerHandlers(): void {
    this.registerHandler("filter", this.executeFilter.bind(this));
    this.registerHandler("merge", this.executeMerge.bind(this));
    this.registerHandler("constants", this.executeConstants.bind(this));
    this.registerHandler("result", this.executeResult.bind(this));
    this.registerHandler("compare", this.executeCompare.bind(this));
    this.registerHandler("if_else", this.executeIfElse.bind(this));
    this.registerHandler("boolean_op", this.executeBooleanOp.bind(this));
    this.registerHandler("math_op", this.executeMathOp.bind(this));
    this.registerHandler("duplicate", this.executeDuplicate.bind(this));
    this.registerHandler("batch", this.executeBatch.bind(this));
  }

  private async executeConstants(
    node: ReactFlowNode<NodeData>,
    context: ExecutionContext,
    _connections: ReactFlowEdge[],
  ): Promise<void> {
    const data = node.data as unknown as Record<string, unknown>;
    const valueType = data.valueType as string;

    let outputValue: unknown;
    let logicType: string;

    switch (valueType) {
      case "number":
        outputValue = Number(data.numberValue);
        logicType = "number";
        break;
      case "string":
        outputValue =
          typeof data.stringValue === "string"
            ? data.stringValue
            : (data.stringValue ?? "");
        logicType = "string";
        break;
      case "boolean":
        outputValue = (data.booleanValue as string) === "true";
        logicType = "boolean";
        break;
      case "color":
        outputValue =
          typeof data.colorValue === "string"
            ? data.colorValue
            : (data.colorValue ?? "#ffffff");
        logicType = "color";
        break;
      default:
        outputValue = 0;
        logicType = "number";
        logger.warn(`Unknown value type: ${valueType}, defaulting to number 0`);
    }

    logger.debug(
      `Constants ${node.data.identifier.displayName}: ${valueType} = ${String(outputValue)}`,
    );

    setNodeOutput(
      context,
      node.data.identifier.id,
      "output",
      "data",
      outputValue,
      { logicType, validated: true },
    );
  }

  private async executeResult(
    node: ReactFlowNode<NodeData>,
    context: ExecutionContext,
    connections: ReactFlowEdge[],
  ): Promise<void> {
    const data = node.data as unknown as Record<string, unknown>;
    const label = typeof data.label === "string" ? data.label : "Debug";
    const nodeDisplayName = node.data.identifier.displayName;

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

    // VALIDATION: Exactly one value required at execution time
    if (inputs.length === 0) {
      const noInputMessage = "<no input connected>";
      logger.info(`[RESULT] ${label}: ${noInputMessage}`);

      // Only capture debug logs if this node is the debug target
      const isDebugTarget =
        context.debugTargetNodeId === node.data.identifier.id;

      // Store "no input" state for production debugging
      if (context.debugMode && context.executionLog && isDebugTarget) {
        context.executionLog.push({
          nodeId: node.data.identifier.id,
          timestamp: Date.now(),
          action: "execute",
          data: {
            type: "result_output",
            label,
            nodeDisplayName,
            value: null,
            valueType: "no_input",
            formattedValue: noInputMessage,
            executionContext: {
              hasConnections: false,
              inputCount: 0,
              executionId: `exec-${Date.now()}`,
              flowState: "no_input_connected",
            },
          },
        });
      }
      return;
    }

    if (inputs.length > 1) {
      const sourceNames = inputs
        .map((input) => `${input.nodeId}:${input.portId}`)
        .join(", ");
      throw new MultipleResultValuesError(
        nodeDisplayName,
        sourceNames.split(", "),
      );
    }

    // Process the single connected input
    const input = inputs[0]!; // We know this exists because we checked inputs.length > 0
    const value = input.data;
    const valueType = this.getValueType(value);
    const formattedValue = this.formatValue(value);
    const executionId = `exec-${Date.now()}`;

    // Enhanced console logging for development
    logger.info(`[RESULT] ${label}: ${formattedValue} (${valueType})`);

    // Only capture debug logs if this node is the debug target
    const isDebugTarget = context.debugTargetNodeId === node.data.identifier.id;

    // Production-ready debug storage with comprehensive metadata
    if (context.debugMode && context.executionLog && isDebugTarget) {
      context.executionLog.push({
        nodeId: node.data.identifier.id,
        timestamp: Date.now(),
        action: "execute",
        data: {
          type: "result_output",
          label,
          nodeDisplayName,
          value,
          valueType,
          formattedValue,
          executionContext: {
            hasConnections: true,
            inputCount: 1,
            executionId,
            flowState: "executed_successfully",
            // Additional metadata for customer debugging
            dataSize: this.getDataSize(value),
            isComplexObject: this.isComplexObject(value),
            hasNestedData: this.hasNestedData(value),
            sourceMetadata: input.metadata ?? {},
          },
        },
      });
    }

    // Store result for potential debugging/display
    setNodeOutput(context, node.data.identifier.id, "result", "data", value, {
      resultType: valueType,
      displayValue: String(value),
    });

    // Also expose on canonical 'output' port for variables
    setNodeOutput(context, node.data.identifier.id, "output", "data", value, {
      resultType: valueType,
      displayValue: String(value),
    });
  }

  private getValueType(value: unknown): string {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (Array.isArray(value)) return `array[${value.length}]`;
    if (typeof value === "object") return `object`;
    return typeof value;
  }

  private formatValue(value: unknown): string {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (typeof value === "string") return `"${value}"`;
    if (
      typeof value === "number" ||
      typeof value === "boolean" ||
      typeof value === "bigint"
    ) {
      return String(value);
    }
    if (typeof value === "object" && value !== null) {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return "[Complex Object]";
      }
    }
    // For other types (function, symbol, etc.)
    return `[${typeof value}]`;
  }

  // Enhanced helper methods for production debugging
  private getDataSize(value: unknown): string {
    if (value === null || value === undefined) return "0 bytes";

    try {
      const str = JSON.stringify(value);
      const bytes = new Blob([str]).size;

      if (bytes < 1024) return `${bytes} bytes`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    } catch {
      return "unknown size";
    }
  }

  private isComplexObject(value: unknown): boolean {
    if (typeof value !== "object" || value === null) return false;
    if (Array.isArray(value)) return value.length > 10;

    try {
      const keys = Object.keys(value);
      return keys.length > 5;
    } catch {
      return false;
    }
  }

  private hasNestedData(value: unknown): boolean {
    if (typeof value !== "object" || value === null) return false;

    try {
      if (Array.isArray(value)) {
        return value.some((item) => typeof item === "object" && item !== null);
      }

      const values = Object.values(value);
      return values.some((val) => typeof val === "object" && val !== null);
    } catch {
      return false;
    }
  }

  private async executeFilter(
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
    const upstreamCursorMap = this.extractCursorsFromInputs(
      inputs as unknown as ExecutionValue[],
    );
    // Collect upstream batch overrides and bound fields
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
        if (this.hasFilterableObjects(item)) {
          const filtered = this.filterItem(item, selectedObjectIds);
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
    const propagatedAnimations = this.extractPerObjectAnimationsFromInputs(
      inputs as unknown as ExecutionValue[],
      filteredIds,
    );
    const propagatedAssignments = this.extractPerObjectAssignmentsFromInputs(
      inputs as unknown as ExecutionValue[],
      filteredIds,
    );
    // Filter perObjectBatchOverrides and bound fields to allowed IDs
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

  private hasFilterableObjects(item: unknown): boolean {
    return typeof item === "object" && item !== null && "id" in item;
  }

  private filterItem(item: unknown, selectedObjectIds: string[]): unknown {
    if (typeof item === "object" && item !== null && "id" in item) {
      const objectId = (item as { id: string }).id;
      return selectedObjectIds.includes(objectId) ? item : null;
    }

    return item;
  }

  private async executeMerge(
    node: ReactFlowNode<NodeData>,
    context: ExecutionContext,
    connections: ReactFlowEdge[],
  ): Promise<void> {
    logger.debug(
      `Starting merge execution for node: ${node.data.identifier.displayName}`,
    );

    const data = node.data as unknown as Record<string, unknown>;
    const portCount = Number(data.inputPortCount) || 2;

    logger.debug(`Merge port count: ${portCount}`);

    // Collect inputs from all ports in priority order
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
        `input${i}`,
      );
      portInputs.push(inputs);
      logger.debug(`Merge port ${i} inputs`, { connections: inputs.length });
    }

    // Merge logic: collect all objects, resolve conflicts by port priority
    const mergedObjects = new Map<string, unknown>();
    const allCursorMaps: Record<string, number>[] = [];

    logger.debug(
      "Processing ports in reverse order for priority (Port 1 = highest priority)",
    );

    // Process ports in reverse order so Port 1 (index 0) has highest priority
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

        // Extract cursor metadata
        const maybeMap = (
          input.metadata as { perObjectTimeCursor?: unknown } | undefined
        )?.perObjectTimeCursor;
        if (isPerObjectCursorMap(maybeMap)) {
          allCursorMaps.push(maybeMap);
        }

        for (const obj of inputData) {
          if (typeof obj === "object" && obj !== null && "id" in obj) {
            const objectId = (obj as { id: string }).id;

            const existingObject = mergedObjects.get(objectId);
            if (existingObject) {
              logger.debug(`Object ID conflict detected: ${objectId}`, {
                existingObject,
                newObject: obj,
                resolution: `Port ${portIndex + 1} overwrites previous`,
              });
            } else {
              logger.debug(
                `Adding new object ID: ${objectId} from port ${portIndex + 1}`,
              );
            }

            // Port priority: later iteration (lower port index) overwrites
            mergedObjects.set(objectId, obj);
          } else {
            logger.debug("Non-object or object without ID", { obj });
          }
        }
      }
    }

    const mergedResult = Array.from(mergedObjects.values());
    const mergedCursors = mergeCursorMaps(allCursorMaps);
    const mergedIds = mergedResult
      .map((obj) =>
        typeof obj === "object" && obj !== null && "id" in obj
          ? (obj as { id: string }).id
          : null,
      )
      .filter(Boolean) as string[];
    const propagatedAnimations =
      this.extractPerObjectAnimationsFromInputsWithPriority(
        portInputs as unknown as ExecutionValue[][],
        mergedIds,
      );
    const propagatedAssignments =
      this.extractPerObjectAssignmentsFromInputsWithPriority(
        portInputs as unknown as ExecutionValue[][],
        mergedIds,
      );

    const inputObjectCount = portInputs.flat().reduce((acc, input) => {
      const data = Array.isArray(input.data) ? input.data : [input.data];
      return acc + data.length;
    }, 0);
    const outputIds = mergedResult
      .map((obj) =>
        typeof obj === "object" && obj !== null && "id" in obj
          ? (obj as { id: string }).id
          : null,
      )
      .filter((id) => id !== null);
    logger.debug("Final merged result", {
      inputObjectCount,
      outputObjectCount: mergedResult.length,
      uniqueObjectIds: outputIds,
    });

    // CRITICAL: Verify no duplicate IDs in output

    const uniqueOutputIds = new Set(outputIds);
    logger.debug("Output verification", {
      totalIds: outputIds.length,
      uniqueIds: uniqueOutputIds.size,
    });

    if (outputIds.length !== uniqueOutputIds.size) {
      console.error(
        `[MERGE] ERROR: Merge node is outputting duplicate object IDs!`,
      );
      console.error(`[MERGE] All output IDs:`, outputIds);
      console.error(
        `[MERGE] Duplicate IDs:`,
        outputIds.filter((id, index) => outputIds.indexOf(id) !== index),
      );
      throw new Error(
        `Merge node ${node.data.identifier.displayName} failed to deduplicate objects`,
      );
    }

    setNodeOutput(
      context,
      node.data.identifier.id,
      "output",
      "object_stream",
      mergedResult,
      {
        perObjectTimeCursor: mergedCursors,
        perObjectAnimations: propagatedAnimations,
        perObjectAssignments: propagatedAssignments,
        // Merge perObjectBatchOverrides with port priority (Port 1 wins)
        perObjectBatchOverrides: (() => {
          const out: Record<
            string,
            Record<string, Record<string, unknown>>
          > = {};
          // Process ports in reverse so Port 1 has highest priority
          for (
            let portIndex = portInputs.length - 1;
            portIndex >= 0;
            portIndex--
          ) {
            const inputs = portInputs[portIndex];
            if (!inputs) continue;
            for (const input of inputs) {
              const fromMeta = (
                input.metadata as
                  | {
                      perObjectBatchOverrides?: Record<
                        string,
                        Record<string, Record<string, unknown>>
                      >;
                    }
                  | undefined
              )?.perObjectBatchOverrides;
              if (!fromMeta) continue;
              for (const [objectId, fields] of Object.entries(fromMeta)) {
                const destFields = out[objectId] ?? {};
                for (const [fieldPath, byKey] of Object.entries(fields)) {
                  const existing = destFields[fieldPath] ?? {};
                  // Overwrite byKey entries from higher priority port
                  destFields[fieldPath] = { ...existing, ...byKey };
                }
                out[objectId] = destFields;
              }
            }
          }
          return Object.keys(out).length > 0 ? out : undefined;
        })(),
      },
    );

    logger.debug("Merge execution completed successfully");
  }

  private extractCursorsFromInputs(
    inputs: ExecutionValue[],
  ): Record<string, number> {
    const maps: Record<string, number>[] = [];
    for (const input of inputs) {
      const maybeMap = (
        input.metadata as { perObjectTimeCursor?: unknown } | undefined
      )?.perObjectTimeCursor;
      if (isPerObjectCursorMap(maybeMap)) {
        maps.push(maybeMap);
      }
    }
    return mergeCursorMaps(maps);
  }

  private extractPerObjectAnimationsFromInputs(
    inputs: ExecutionValue[],
    allowIds: string[],
  ): Record<string, SceneAnimationTrack[]> {
    const merged: Record<string, SceneAnimationTrack[]> = {};
    for (const input of inputs) {
      const fromMeta = (
        input.metadata as
          | { perObjectAnimations?: Record<string, SceneAnimationTrack[]> }
          | undefined
      )?.perObjectAnimations;
      if (!fromMeta) continue;
      for (const [objectId, animations] of Object.entries(fromMeta)) {
        if (!allowIds.includes(objectId)) continue;
        merged[objectId] = [...(merged[objectId] ?? []), ...animations];
      }
    }
    return merged;
  }

  private extractPerObjectAnimationsFromInputsWithPriority(
    portInputs: ExecutionValue[][],
    allowIds: string[],
  ): Record<string, SceneAnimationTrack[]> {
    const merged: Record<string, SceneAnimationTrack[]> = {};

    // Process ports in reverse order so Port 1 (index 0) has highest priority
    // Same logic as object merging in executeMerge
    for (let portIndex = portInputs.length - 1; portIndex >= 0; portIndex--) {
      const inputs = portInputs[portIndex];
      if (!inputs) continue;

      for (const input of inputs) {
        const fromMeta = (
          input.metadata as
            | { perObjectAnimations?: Record<string, SceneAnimationTrack[]> }
            | undefined
        )?.perObjectAnimations;
        if (!fromMeta) continue;

        for (const [objectId, animations] of Object.entries(fromMeta)) {
          if (!allowIds.includes(objectId)) continue;

          // Clone animations to prevent shared reference mutations
          const clonedAnimations = animations.map((anim) => {
            switch (anim.type) {
              case "move":
              case "rotate":
              case "scale":
              case "fade":
              case "color":
                return {
                  ...anim,
                  properties: { ...anim.properties },
                } as SceneAnimationTrack;
              default:
                return anim as SceneAnimationTrack;
            }
          });

          // For each animation, check for conflicts with existing animations
          const existingAnimations = merged[objectId] ?? [];
          const newAnimations: SceneAnimationTrack[] = [];

          for (const newAnim of clonedAnimations) {
            // Check if there's a conflicting animation (same type)
            // For merge node priority rules, identical animation types should prioritize Port 1
            const conflictingAnimations = existingAnimations.filter(
              (existingAnim) => existingAnim.type === newAnim.type,
            );

            if (conflictingAnimations.length === 0) {
              // No conflict, add the animation
              newAnimations.push(newAnim);
            } else {
              // Conflict detected - port priority decides
              // Since we process in reverse order, later iteration (lower port index) wins
              // The new animation from higher priority port wins
              newAnimations.push(newAnim);

              logger.debug(
                `Animation conflict resolved: Port ${portIndex + 1} ${newAnim.type} animation overrides previous`,
                {
                  objectId,
                  animationType: newAnim.type,
                  winningPort: portIndex + 1,
                  conflictsRemoved: conflictingAnimations.length,
                },
              );
            }
          }

          // Resolve animation conflicts by type: remove existing animations of same type before adding new ones
          const currentAnimations = merged[objectId] ?? [];
          const nonConflictingExisting = currentAnimations.filter(
            (existingAnim) =>
              !newAnimations.some(
                (newAnim) => newAnim.type === existingAnim.type,
              ),
          );
          merged[objectId] = [...nonConflictingExisting, ...newAnimations];
        }
      }
    }

    return merged;
  }

  private extractPerObjectAssignmentsFromInputs(
    inputs: ExecutionValue[],
    allowIds: string[],
  ): PerObjectAssignments {
    const merged: PerObjectAssignments = {};
    for (const input of inputs) {
      const fromMeta = (
        input.metadata as
          | { perObjectAssignments?: PerObjectAssignments }
          | undefined
      )?.perObjectAssignments;
      if (!fromMeta) continue;
      for (const [objectId, assignment] of Object.entries(fromMeta)) {
        if (!allowIds.includes(objectId)) continue;
        const base = merged[objectId];
        // Fix: Properly type the assignment from Object.entries and validate it
        if (!isObjectAssignments(assignment)) continue;
        const combined = mergeObjectAssignments(base, assignment);
        if (combined) merged[objectId] = combined;
      }
    }
    return merged;
  }

  private extractPerObjectAssignmentsFromInputsWithPriority(
    portInputs: ExecutionValue[][],
    allowIds: string[],
  ): PerObjectAssignments {
    const merged: PerObjectAssignments = {};
    for (let portIndex = portInputs.length - 1; portIndex >= 0; portIndex--) {
      const inputs = portInputs[portIndex];
      if (!inputs) continue;
      for (const input of inputs) {
        const fromMeta = (
          input.metadata as
            | { perObjectAssignments?: PerObjectAssignments }
            | undefined
        )?.perObjectAssignments;
        if (!fromMeta) continue;
        for (const [objectId, assignment] of Object.entries(fromMeta)) {
          if (!allowIds.includes(objectId)) continue;
          const base = merged[objectId];
          // Fix: Properly type the assignment from Object.entries and validate it
          if (!isObjectAssignments(assignment)) continue;
          const combined = mergeObjectAssignments(base, assignment);
          if (combined) merged[objectId] = combined;
        }
      }
    }
    return merged;
  }

  private animationsOverlap(
    anim1: SceneAnimationTrack,
    anim2: SceneAnimationTrack,
  ): boolean {
    const end1 = anim1.startTime + anim1.duration;
    const end2 = anim2.startTime + anim2.duration;

    // Check if time ranges overlap
    return !(end1 <= anim2.startTime || end2 <= anim1.startTime);
  }

  private async executeCompare(
    node: ReactFlowNode<NodeData>,
    context: ExecutionContext,
    connections: ReactFlowEdge[],
  ): Promise<void> {
    const data = node.data as unknown as {
      operator: "gt" | "lt" | "eq" | "neq" | "gte" | "lte";
    };

    let inputA: ReturnType<typeof getTypedConnectedInput<number>> | undefined;
    let inputB: ReturnType<typeof getTypedConnectedInput<number>> | undefined;

    try {
      inputA = getTypedConnectedInput<number>(
        context,
        connections as unknown as Array<{
          target: string;
          targetHandle: string;
          source: string;
          sourceHandle: string;
        }>,
        node.data.identifier.id,
        "input_a",
        "number",
      );
    } catch (error) {
      if (error instanceof TypeValidationError) {
        logger.error(
          `Type validation failed for input A in Compare node ${node.data.identifier.displayName}: ${error.message}`,
        );
        throw error;
      }
      throw error;
    }

    try {
      inputB = getTypedConnectedInput<number>(
        context,
        connections as unknown as Array<{
          target: string;
          targetHandle: string;
          source: string;
          sourceHandle: string;
        }>,
        node.data.identifier.id,
        "input_b",
        "number",
      );
    } catch (error) {
      if (error instanceof TypeValidationError) {
        logger.error(
          `Type validation failed for input B in Compare node ${node.data.identifier.displayName}: ${error.message}`,
        );
        throw error;
      }
      throw error;
    }

    if (!inputA || !inputB) {
      throw new Error(
        `Compare node ${node.data.identifier.displayName} missing required inputs`,
      );
    }

    const valueA = inputA.data;
    const valueB = inputB.data;

    let result: boolean;
    switch (data.operator) {
      case "gt":
        result = valueA > valueB;
        break;
      case "lt":
        result = valueA < valueB;
        break;
      case "eq":
        result = valueA === valueB;
        break;
      case "neq":
        result = valueA !== valueB;
        break;
      case "gte":
        result = valueA >= valueB;
        break;
      case "lte":
        result = valueA <= valueB;
        break;
      default: {
        const _exhaustive: never = data.operator;
        throw new Error(`Unknown operator: ${String(_exhaustive)}`);
      }
    }

    logger.debug(
      `Compare ${node.data.identifier.displayName}: ${String(valueA)} ${data.operator} ${String(valueB)} = ${result}`,
    );

    setNodeOutput(context, node.data.identifier.id, "output", "data", result, {
      logicType: "boolean",
      validated: true,
    });
    // Note: Error handling is done above for individual inputs
  }

  private async executeIfElse(
    node: ReactFlowNode<NodeData>,
    context: ExecutionContext,
    connections: ReactFlowEdge[],
  ): Promise<void> {
    let condition:
      | ReturnType<typeof getTypedConnectedInput<boolean>>
      | undefined;

    try {
      condition = getTypedConnectedInput<boolean>(
        context,
        connections as unknown as Array<{
          target: string;
          targetHandle: string;
          source: string;
          sourceHandle: string;
        }>,
        node.data.identifier.id,
        "condition",
        "boolean",
      );
    } catch (error) {
      if (error instanceof TypeValidationError) {
        logger.error(
          `Type validation failed for condition in If/Else node ${node.data.identifier.displayName}: ${error.message}`,
        );
        throw error;
      }
      throw error;
    }

    if (!condition) {
      throw new Error(
        `If/Else node ${node.data.identifier.displayName} missing condition input`,
      );
    }
    // Fetch required data input
    const dataInput = getConnectedInput(
      context,
      connections as unknown as Array<{
        target: string;
        targetHandle: string;
        source: string;
        sourceHandle: string;
      }>,
      node.data.identifier.id,
      "data",
    );

    if (!dataInput) {
      throw new Error(
        `If/Else node ${node.data.identifier.displayName} missing data input`,
      );
    }

    // Route actual data based on the boolean condition
    if (condition.data) {
      setNodeOutput(
        context,
        node.data.identifier.id,
        "true_path",
        "data",
        dataInput.data,
      );
      logger.debug(
        `If/Else ${node.data.identifier.displayName}: condition=true, routing data to true_path`,
      );
    } else {
      setNodeOutput(
        context,
        node.data.identifier.id,
        "false_path",
        "data",
        dataInput.data,
      );
      logger.debug(
        `If/Else ${node.data.identifier.displayName}: condition=false, routing data to false_path`,
      );
    }
    // Note: Error handling is done above for inputs
  }

  private async executeBooleanOp(
    node: ReactFlowNode<NodeData>,
    context: ExecutionContext,
    connections: ReactFlowEdge[],
  ): Promise<void> {
    const data = node.data as unknown as {
      operator: "and" | "or" | "not" | "xor";
    };

    if (data.operator === "not") {
      // NOT operation - single input
      let input: ReturnType<typeof getTypedConnectedInput<boolean>> | undefined;

      try {
        input = getTypedConnectedInput<boolean>(
          context,
          connections as unknown as Array<{
            target: string;
            targetHandle: string;
            source: string;
            sourceHandle: string;
          }>,
          node.data.identifier.id,
          "input1",
          "boolean",
        );
      } catch (error) {
        if (error instanceof TypeValidationError) {
          logger.error(
            `Type validation failed for input in Boolean NOT node ${node.data.identifier.displayName}: ${error.message}`,
          );
          throw error;
        }
        throw error;
      }

      if (!input) {
        throw new Error(
          `Boolean NOT node ${node.data.identifier.displayName} missing input`,
        );
      }

      const result = !input.data;
      logger.debug(
        `Boolean NOT ${node.data.identifier.displayName}: !${input.data} = ${result}`,
      );

      setNodeOutput(
        context,
        node.data.identifier.id,
        "output",
        "data",
        result,
        { logicType: "boolean", validated: true },
      );
      return;
    }

    // Binary operations (AND, OR, XOR) - two inputs
    let inputA: ReturnType<typeof getTypedConnectedInput<boolean>> | undefined;
    let inputB: ReturnType<typeof getTypedConnectedInput<boolean>> | undefined;

    try {
      inputA = getTypedConnectedInput<boolean>(
        context,
        connections as unknown as Array<{
          target: string;
          targetHandle: string;
          source: string;
          sourceHandle: string;
        }>,
        node.data.identifier.id,
        "input1",
        "boolean",
      );
    } catch (error) {
      if (error instanceof TypeValidationError) {
        logger.error(
          `Type validation failed for input A in Boolean ${data.operator.toUpperCase()} node ${node.data.identifier.displayName}: ${error.message}`,
        );
        throw error;
      }
      throw error;
    }

    try {
      inputB = getTypedConnectedInput<boolean>(
        context,
        connections as unknown as Array<{
          target: string;
          targetHandle: string;
          source: string;
          sourceHandle: string;
        }>,
        node.data.identifier.id,
        "input2",
        "boolean",
      );
    } catch (error) {
      if (error instanceof TypeValidationError) {
        logger.error(
          `Type validation failed for input B in Boolean ${data.operator.toUpperCase()} node ${node.data.identifier.displayName}: ${error.message}`,
        );
        throw error;
      }
      throw error;
    }

    if (!inputA || !inputB) {
      throw new Error(
        `Boolean ${data.operator.toUpperCase()} node ${node.data.identifier.displayName} missing required inputs`,
      );
    }

    const valueA = inputA.data;
    const valueB = inputB.data;

    let result: boolean;
    switch (data.operator) {
      case "and":
        result = valueA && valueB;
        break;
      case "or":
        result = valueA || valueB;
        break;
      case "xor":
        result = valueA !== valueB; // XOR: true when inputs differ
        break;
      default: {
        const _exhaustive: never = data.operator;
        throw new Error(`Unknown boolean operator: ${String(_exhaustive)}`);
      }
    }

    logger.debug(
      `Boolean ${data.operator.toUpperCase()} ${node.data.identifier.displayName}: ${String(valueA)} ${data.operator} ${String(valueB)} = ${result}`,
    );

    setNodeOutput(context, node.data.identifier.id, "output", "data", result, {
      logicType: "boolean",
      validated: true,
    });
  }

  private async executeMathOp(
    node: ReactFlowNode<NodeData>,
    context: ExecutionContext,
    connections: ReactFlowEdge[],
  ): Promise<void> {
    const data = node.data as unknown as {
      operator:
        | "add"
        | "subtract"
        | "multiply"
        | "divide"
        | "modulo"
        | "power"
        | "sqrt"
        | "abs"
        | "min"
        | "max";
    };

    if (data.operator === "sqrt" || data.operator === "abs") {
      // Unary operations - single input
      let input: ReturnType<typeof getTypedConnectedInput<number>> | undefined;

      try {
        input = getTypedConnectedInput<number>(
          context,
          connections as unknown as Array<{
            target: string;
            targetHandle: string;
            source: string;
            sourceHandle: string;
          }>,
          node.data.identifier.id,
          "input_a",
          "number",
        );
      } catch (error) {
        if (error instanceof TypeValidationError) {
          logger.error(
            `Type validation failed for input in Math ${data.operator.toUpperCase()} node ${node.data.identifier.displayName}: ${error.message}`,
          );
          throw error;
        }
        throw error;
      }

      if (!input) {
        throw new Error(
          `Math ${data.operator.toUpperCase()} node ${node.data.identifier.displayName} missing input`,
        );
      }

      let result: number;
      switch (data.operator) {
        case "sqrt":
          if (input.data < 0) {
            throw new Error(
              `Math SQRT node ${node.data.identifier.displayName}: Cannot take square root of negative number (${input.data})`,
            );
          }
          result = Math.sqrt(input.data);
          break;
        case "abs":
          result = Math.abs(input.data);
          break;
        default: {
          const _exhaustive: never = data.operator;
          throw new Error(
            `Unknown unary math operator: ${String(_exhaustive)}`,
          );
        }
      }

      logger.debug(
        `Math ${data.operator.toUpperCase()} ${node.data.identifier.displayName}: ${data.operator}(${input.data}) = ${result}`,
      );

      setNodeOutput(
        context,
        node.data.identifier.id,
        "output",
        "data",
        result,
        { logicType: "number", validated: true },
      );
      return;
    }

    // Binary operations - two inputs
    let inputA: ReturnType<typeof getTypedConnectedInput<number>> | undefined;
    let inputB: ReturnType<typeof getTypedConnectedInput<number>> | undefined;

    try {
      inputA = getTypedConnectedInput<number>(
        context,
        connections as unknown as Array<{
          target: string;
          targetHandle: string;
          source: string;
          sourceHandle: string;
        }>,
        node.data.identifier.id,
        "input_a",
        "number",
      );
    } catch (error) {
      if (error instanceof TypeValidationError) {
        logger.error(
          `Type validation failed for input A in Math ${data.operator.toUpperCase()} node ${node.data.identifier.displayName}: ${error.message}`,
        );
        throw error;
      }
      throw error;
    }

    try {
      inputB = getTypedConnectedInput<number>(
        context,
        connections as unknown as Array<{
          target: string;
          targetHandle: string;
          source: string;
          sourceHandle: string;
        }>,
        node.data.identifier.id,
        "input_b",
        "number",
      );
    } catch (error) {
      if (error instanceof TypeValidationError) {
        logger.error(
          `Type validation failed for input B in Math ${data.operator.toUpperCase()} node ${node.data.identifier.displayName}: ${error.message}`,
        );
        throw error;
      }
      throw error;
    }

    if (!inputA || !inputB) {
      throw new Error(
        `Math ${data.operator.toUpperCase()} node ${node.data.identifier.displayName} missing required inputs`,
      );
    }

    const valueA = inputA.data;
    const valueB = inputB.data;

    let result: number;
    switch (data.operator) {
      case "add":
        result = valueA + valueB;
        break;
      case "subtract":
        result = valueA - valueB;
        break;
      case "multiply":
        result = valueA * valueB;
        break;
      case "divide":
        if (valueB === 0) {
          throw new Error(
            `Math DIVIDE node ${node.data.identifier.displayName}: Division by zero (A=${valueA}, B=${valueB})`,
          );
        }
        result = valueA / valueB;
        break;
      case "modulo":
        if (valueB === 0) {
          throw new Error(
            `Math MODULO node ${node.data.identifier.displayName}: Modulo by zero (A=${valueA}, B=${valueB})`,
          );
        }
        result = valueA % valueB;
        break;
      case "power":
        result = Math.pow(valueA, valueB);
        break;
      case "min":
        result = Math.min(valueA, valueB);
        break;
      case "max":
        result = Math.max(valueA, valueB);
        break;
      default: {
        const _exhaustive: never = data.operator;
        throw new Error(`Unknown binary math operator: ${String(_exhaustive)}`);
      }
    }

    // Handle special cases for result validation
    if (!Number.isFinite(result)) {
      if (Number.isNaN(result)) {
        throw new Error(
          `Math ${data.operator.toUpperCase()} node ${node.data.identifier.displayName}: Operation resulted in NaN (A=${valueA}, B=${valueB})`,
        );
      }
      if (!Number.isFinite(result)) {
        logger.warn(
          `Math ${data.operator.toUpperCase()} node ${node.data.identifier.displayName}: Operation resulted in ${result} (A=${valueA}, B=${valueB})`,
        );
      }
    }

    logger.debug(
      `Math ${data.operator.toUpperCase()} ${node.data.identifier.displayName}: ${String(valueA)} ${data.operator} ${String(valueB)} = ${result}`,
    );

    setNodeOutput(context, node.data.identifier.id, "output", "data", result, {
      logicType: "number",
      validated: true,
    });
  }

  private async executeDuplicate(
    node: ReactFlowNode<NodeData>,
    context: ExecutionContext,
    connections: ReactFlowEdge[],
  ): Promise<void> {
    logger.debug(
      `Starting duplicate execution for node: ${node.data.identifier.displayName}`,
    );

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
      "input",
    );

    // Calculate total input objects for validation
    const totalInputObjects = inputs.reduce((acc, input) => {
      const data = Array.isArray(input.data) ? input.data : [input.data];
      return acc + data.length;
    }, 0);

    // Validate inputs with updated rules
    this.validateDuplicateInputs(
      count,
      totalInputObjects,
      node.data.identifier.id,
      node.data.identifier.displayName,
    );

    if (inputs.length === 0) {
      logger.debug("No inputs connected to duplicate node");
      setNodeOutput(
        context,
        node.data.identifier.id,
        "output",
        "object_stream",
        [],
        {
          perObjectTimeCursor: {},
          perObjectAnimations: {},
          perObjectAssignments: {},
        },
      );
      return;
    }

    // Extract input object IDs for metadata filtering
    const inputObjectIds: string[] = [];
    for (const input of inputs) {
      const inputData = Array.isArray(input.data) ? input.data : [input.data];
      for (const obj of inputData) {
        if (this.hasValidObjectStructure(obj)) {
          inputObjectIds.push((obj as { id: string }).id);
        }
      }
    }

    // Extract upstream metadata with object ID filtering
    const upstreamAssignments = this.extractPerObjectAssignmentsFromInputs(
      inputs as unknown as ExecutionValue[],
      inputObjectIds,
    );
    const upstreamAnimations = this.extractPerObjectAnimationsFromInputs(
      inputs as unknown as ExecutionValue[],
      inputObjectIds,
    );
    const upstreamCursors = this.extractCursorsFromInputs(
      inputs as unknown as ExecutionValue[],
    );

    const allOutputObjects: unknown[] = [];
    const expandedAssignments: PerObjectAssignments = {};
    const expandedAnimations: Record<string, SceneAnimationTrack[]> = {};
    const expandedCursors: Record<string, number> = {};
    const allExistingIds = this.getAllExistingObjectIds(context);
    const newlyCreatedIds = new Set<string>();

    for (const input of inputs) {
      const inputData = Array.isArray(input.data) ? input.data : [input.data];

      for (const originalObject of inputData) {
        if (!this.hasValidObjectStructure(originalObject)) {
          allOutputObjects.push(originalObject);
          continue;
        }

        const originalId = (originalObject as { id: string }).id;

        // Add original object
        allOutputObjects.push(originalObject);
        this.copyMetadataForObject(
          originalId,
          originalId,
          upstreamAssignments,
          upstreamAnimations,
          upstreamCursors,
          expandedAssignments,
          expandedAnimations,
          expandedCursors,
        );

        // Create duplicates - pure copy, only change ID
        for (let i = 1; i < count; i++) {
          const duplicateId = this.generateUniqueId(
            originalId,
            i,
            allExistingIds,
            newlyCreatedIds,
          );
          const duplicate = this.createDuplicateObject(
            originalObject,
            duplicateId,
          ); // ✅ Pure copy
          allOutputObjects.push(duplicate);
          this.copyMetadataForObject(
            originalId,
            duplicateId,
            upstreamAssignments,
            upstreamAnimations,
            upstreamCursors,
            expandedAssignments,
            expandedAnimations,
            expandedCursors,
          );
          newlyCreatedIds.add(duplicateId);
        }
      }
    }

    logger.debug(
      `Duplicate execution complete. Output: ${allOutputObjects.length} objects`,
    );

    setNodeOutput(
      context,
      node.data.identifier.id,
      "output",
      "object_stream",
      allOutputObjects,
      {
        perObjectTimeCursor: expandedCursors,
        perObjectAnimations: expandedAnimations,
        perObjectAssignments: expandedAssignments,
      },
    );
  }

  private async executeBatch(
    node: ReactFlowNode<NodeData>,
    context: ExecutionContext,
    connections: ReactFlowEdge[],
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
      "input",
    );

    if (inputs.length === 0) {
      setNodeOutput(
        context,
        node.data.identifier.id,
        "output",
        "object_stream",
        [],
        {
          perObjectTimeCursor: {},
          perObjectAnimations: {},
          perObjectAssignments: {},
        },
      );
      return;
    }

    // Extract object IDs first for validation and method calls
    const inputObjectIds = extractObjectIdsFromInputs(
      inputs as unknown as ExecutionValue[],
    );

    // Resolve bindings for per-object key evaluation (mirror Canvas/Animation executors)
    const bindings =
      (data.variableBindings as
        | Record<string, { target?: string; boundResultNodeId?: string }>
        | undefined) ?? {};
    const bindingsByObject =
      (data.variableBindingsByObject as
        | Record<
            string,
            Record<string, { target?: string; boundResultNodeId?: string }>
          >
        | undefined) ?? {};
    const readVarGlobal = (key: string): unknown => {
      const rid = bindings[key]?.boundResultNodeId;
      if (!rid) return undefined;
      return (
        context.nodeOutputs.get(`${rid}.output`) ??
        context.nodeOutputs.get(`${rid}.result`)
      )?.data;
    };
    const readVarForObject =
      (objectId: string | undefined) =>
      (key: string): unknown => {
        if (!objectId) return readVarGlobal(key);
        const rid = bindingsByObject[objectId]?.[key]?.boundResultNodeId;
        if (rid)
          return (
            context.nodeOutputs.get(`${rid}.output`) ??
            context.nodeOutputs.get(`${rid}.result`)
          )?.data;
        return readVarGlobal(key);
      };

    // Collect validation data
    const emptyKeyObjectIds: string[] = [];

    const tagged: unknown[] = [];
    for (const input of inputs) {
      const inputData = Array.isArray(input.data) ? input.data : [input.data];
      for (const obj of inputData) {
        if (typeof obj === "object" && obj !== null && "id" in obj) {
          const objectId = (obj as { id: string }).id;
          const objWithBatch = obj as Record<string, unknown> & {
            batch?: boolean;
            batchKeys?: string[];
          };

          // Resolve key(s) per object with precedence: per-object binding -> global binding -> literal
          const perObjectVal = readVarForObject(objectId)("key");
          const globalVal = readVarGlobal("key");
          // Literal value from key property
          const literalVal = (data as { key?: unknown }).key;

          const coerceToKeys = (v: unknown): string[] => {
            if (Array.isArray(v)) {
              return v
                .map((x) =>
                  typeof x === "string" ||
                  typeof x === "number" ||
                  typeof x === "boolean"
                    ? String(x).trim()
                    : "",
                )
                .filter((s) => s.length > 0);
            }
            if (
              typeof v === "string" ||
              typeof v === "number" ||
              typeof v === "boolean"
            ) {
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
            // Check the data.keys array as configured in the UI
            const keysArray = (data as { keys?: unknown[] }).keys;
            if (Array.isArray(keysArray)) {
              const fromKeysArray = keysArray
                .map((k) =>
                  typeof k === "string" ? k.trim() : String(k).trim(),
                )
                .filter((k) => k.length > 0);
              if (fromKeysArray.length > 0) return fromKeysArray;
            }
            return [];
          })();

          if (resolvedKeys.length === 0) {
            emptyKeyObjectIds.push(objectId);
          }

          // Check for re-tagging (only supports batchKeys array format)
          const prevKeys = (() => {
            const arr = (objWithBatch as { batchKeys?: unknown }).batchKeys;
            return Array.isArray(arr) ? (arr as string[]) : [];
          })();
          const alreadyTagged =
            objWithBatch.batch === true && prevKeys.length > 0;
          if (alreadyTagged) {
            const same =
              prevKeys.length === resolvedKeys.length &&
              prevKeys.every((k) => resolvedKeys.includes(k));
            if (!same) {
              // Enforce strict error: no retagging allowed
              throw new DomainError(
                `Batch node '${node.data.identifier.displayName}' received already-tagged objects. Only one Batch node allowed per object path.`,
                "ERR_BATCH_DOUBLE_TAG" as DomainErrorCode,
                {
                  nodeId: node.data.identifier.id,
                  nodeName: node.data.identifier.displayName,
                  objectIds: [objectId],
                },
              );
            }
          }

          // Apply batch tagging; emit batchKeys array
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

    // Validate empty keys and throw error if any found
    if (emptyKeyObjectIds.length > 0) {
      const maxDisplay = 20;
      const displayedIds = emptyKeyObjectIds.slice(0, maxDisplay);
      const remainingCount = emptyKeyObjectIds.length - maxDisplay;
      const remainingText =
        remainingCount > 0 ? ` …+${remainingCount} more` : "";
      const objectIdsText = displayedIds.join(", ") + remainingText;
      throw new DomainError(
        `Batch node '${node.data.identifier.displayName}' received objects with empty keys: [${objectIdsText}]`,
        "ERR_BATCH_EMPTY_KEY" as DomainErrorCode,
        {
          nodeId: node.data.identifier.id,
          nodeName: node.data.identifier.displayName,
          info: { objectIds: emptyKeyObjectIds },
        },
      );
    }

    // Strict mode: no retag log spam since it's an error now

    // Pass through upstream metadata unchanged
    const perObjectTimeCursor = this.extractCursorsFromInputs(
      inputs as unknown as ExecutionValue[],
    );
    const perObjectAnimations = this.extractPerObjectAnimationsFromInputs(
      inputs as unknown as ExecutionValue[],
      inputObjectIds,
    );
    const perObjectAssignments = this.extractPerObjectAssignmentsFromInputs(
      inputs as unknown as ExecutionValue[],
      inputObjectIds,
    );

    setNodeOutput(
      context,
      node.data.identifier.id,
      "output",
      "object_stream",
      tagged,
      {
        perObjectTimeCursor,
        perObjectAnimations,
        perObjectAssignments,
        // Pass-through point for future per-field per-key overrides (v1 UI may write this)
        // perObjectBatchOverrides?: Record<objectId, Record<fieldId, Record<batchKey, value>>>
      },
    );
  }

  private validateDuplicateInputs(
    count: number,
    totalInputObjects: number,
    nodeId: string,
    nodeDisplayName: string,
  ): void {
    // Count validation
    if (count < 1) {
      throw new DuplicateNodeError(
        nodeId,
        nodeDisplayName,
        "Duplicate count must be at least 1",
      );
    }
    if (count > 50) {
      throw new DuplicateCountExceededError(nodeId, nodeDisplayName, count, 50);
    }

    // CRITICAL: Total output validation (system safety limit)
    const totalOutput = totalInputObjects * count;
    if (totalOutput > 200) {
      throw new DuplicateNodeError(
        nodeId,
        nodeDisplayName,
        `Operation would create ${totalOutput} objects, exceeding system limit of 200`,
      );
    }
  }

  private hasValidObjectStructure(obj: unknown): boolean {
    return (
      typeof obj === "object" &&
      obj !== null &&
      "id" in obj &&
      typeof (obj as { id: unknown }).id === "string"
    );
  }

  private generateUniqueId(
    originalId: string,
    index: number,
    existingIds: Set<string>,
    newIds: Set<string>,
  ): string {
    const baseId = `${originalId}_dup_${index.toString().padStart(3, "0")}`;
    let candidateId = baseId;
    let suffix = 0;

    while (existingIds.has(candidateId) || newIds.has(candidateId)) {
      suffix++;
      candidateId = `${baseId}_${suffix}`;
    }

    return candidateId;
  }

  private getAllExistingObjectIds(context: ExecutionContext): Set<string> {
    const ids = new Set<string>();

    for (const output of context.nodeOutputs.values()) {
      if (output.type !== "object_stream") continue;

      const objects = Array.isArray(output.data) ? output.data : [output.data];
      for (const obj of objects) {
        if (this.hasValidObjectStructure(obj)) {
          ids.add((obj as { id: string }).id);
        }
      }
    }

    return ids;
  }

  private createDuplicateObject(
    original: unknown,
    duplicateId: string,
  ): unknown {
    const duplicate = JSON.parse(JSON.stringify(original)) as Record<
      string,
      unknown
    >;
    duplicate.id = duplicateId;
    return duplicate; // ✅ Pure copy, no positioning
  }

  private copyMetadataForObject(
    sourceId: string,
    targetId: string,
    sourceAssignments: PerObjectAssignments | undefined,
    sourceAnimations: Record<string, SceneAnimationTrack[]>,
    sourceCursors: Record<string, number>,
    targetAssignments: PerObjectAssignments,
    targetAnimations: Record<string, SceneAnimationTrack[]>,
    targetCursors: Record<string, number>,
  ): void {
    // Copy assignments with deep clone
    if (sourceAssignments?.[sourceId]) {
      try {
        targetAssignments[targetId] = JSON.parse(
          JSON.stringify(sourceAssignments[sourceId]),
        ) as ObjectAssignments;
      } catch (error) {
        logger.warn(
          `Failed to clone assignments for ${sourceId}→${targetId}:`,
          { error: String(error) },
        );
        targetAssignments[targetId] = {} as ObjectAssignments;
      }
    }

    // Copy animations with objectId updates and DEEP CLONE properties
    if (sourceAnimations[sourceId]) {
      try {
        targetAnimations[targetId] = sourceAnimations[sourceId].map((anim) => ({
          ...anim,
          objectId: targetId,
          id: anim.id.replace(sourceId, targetId),
          properties: JSON.parse(
            JSON.stringify(anim.properties),
          ) as typeof anim.properties, // ✅ FIX: Deep clone properties
        })) as SceneAnimationTrack[];
      } catch (error) {
        logger.warn(`Failed to clone animations for ${sourceId}→${targetId}:`, {
          error: String(error),
        });
        targetAnimations[targetId] = [];
      }
    }

    // Copy timing cursors
    if (sourceCursors[sourceId] !== undefined) {
      targetCursors[targetId] = sourceCursors[sourceId];
    }
  }
}
