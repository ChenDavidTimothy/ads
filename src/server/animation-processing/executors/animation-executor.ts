// src/server/animation-processing/executors/animation-executor.ts
import type { NodeData, AnimationTrack, SceneAnimationTrack } from "@/shared/types";
import { setNodeOutput, getConnectedInputs, type ExecutionContext, type ExecutionValue } from "../execution-context";
import type { ReactFlowNode, ReactFlowEdge } from "../types/graph";
import { BaseExecutor } from "./base-executor";
import { convertTracksToSceneAnimations, mergeCursorMaps } from "../scene/scene-assembler";
import type { PerObjectAssignments, ObjectAssignments } from "@/shared/properties/assignments";
import { mergeObjectAssignments } from "@/shared/properties/assignments";
import { setByPath } from "@/shared/utils/object-path";
import { deleteByPath } from "@/shared/utils/object-path";
import { logger } from "@/lib/logger";
import type { SceneObject } from "@/shared/types/scene";

// Safe deep clone that preserves types without introducing `any`
function deepClone<T>(value: T): T {
  try {
    // Prefer native structuredClone when available
    return structuredClone(value);
  } catch {
    // Fallback to JSON-based clone for plain data
    return JSON.parse(JSON.stringify(value)) as T;
  }
}

export class AnimationNodeExecutor extends BaseExecutor {
  // Register animation node handlers
  protected registerHandlers(): void {
    this.registerHandler('animation', this.executeAnimation.bind(this));
    this.registerHandler('textstyle', this.executeTextStyle.bind(this));
  }

  private async executeAnimation(
    node: ReactFlowNode<NodeData>,
    context: ExecutionContext,
    connections: ReactFlowEdge[]
  ): Promise<void> {
    const data = node.data as unknown as Record<string, unknown>;
    const inputs = getConnectedInputs(
      context,
      connections as unknown as Array<{ target: string; targetHandle: string; source: string; sourceHandle: string }>,
      node.data.identifier.id,
      'input'
    );

    // Resolve variable bindings from upstream Result nodes
    const bindings = (data.variableBindings as Record<string, { target?: string; boundResultNodeId?: string }> | undefined) ?? {};
    const bindingsByObject = (data.variableBindingsByObject as Record<string, Record<string, { target?: string; boundResultNodeId?: string }>> | undefined) ?? {};
    const readVarGlobal = (key: string): unknown => {
      const rid = bindings[key]?.boundResultNodeId;
      if (!rid) return undefined;
      const val = (context.nodeOutputs.get(`${rid}.output`) ?? context.nodeOutputs.get(`${rid}.result`))?.data;
      return val;
    };
    const readVarForObject = (objectId: string | undefined) => (key: string): unknown => {
      if (!objectId) return readVarGlobal(key);
      const rid = bindingsByObject[objectId]?.[key]?.boundResultNodeId;
      if (rid) return (context.nodeOutputs.get(`${rid}.output`) ?? context.nodeOutputs.get(`${rid}.result`))?.data;
      return readVarGlobal(key);
    };

    // Resolve duration binding if present (global only)
    const boundDuration = readVarGlobal('duration');
    if (typeof boundDuration === 'number') {
      data.duration = boundDuration;
    }

    // Build a list of binding keys to apply at global level
    const globalBindingKeys = Object.keys(bindings);

    // Clone tracks and apply generic per-track bindings using key prefixes
    const originalTracks: AnimationTrack[] = (data.tracks as AnimationTrack[]) || [];

    const applyBindingsToTrack = (t: AnimationTrack, keys: string[], reader: (k: string) => unknown): AnimationTrack => {
      // Copy track and properties
      const next = { ...t, properties: { ...t.properties } } as AnimationTrack;

      const typePrefix = `${t.type}.`;
      const trackTypePrefix = `track.${t.identifier.id}.${t.type}.`;
      const trackScalarPrefix = `track.${t.identifier.id}.`;

      // 1) Apply type-level keys (affect all tracks of this type)
      for (const key of keys) {
        if (!key.startsWith(typePrefix)) continue;
        const subPath = key.slice(typePrefix.length);
        const val = reader(key);
        if (val === undefined) continue;
        if (subPath === 'easing' && (val === 'linear' || val === 'easeInOut' || val === 'easeIn' || val === 'easeOut')) {
          next.easing = val;
          continue;
        }
        if (subPath === 'startTime' && typeof val === 'number') {
          next.startTime = val;
          continue;
        }
        if (subPath === 'duration' && typeof val === 'number') {
          next.duration = val;
          continue;
        }
        setByPath(next.properties as unknown as Record<string, unknown>, subPath, val);
      }

      // 2) Apply track-specific keys (override type-level)
      for (const key of keys) {
        if (key.startsWith(trackTypePrefix)) {
          const subPath = key.slice(trackTypePrefix.length);
          const val = reader(key);
          if (val === undefined) continue;
          if (subPath === 'easing' && (val === 'linear' || val === 'easeInOut' || val === 'easeIn' || val === 'easeOut')) {
            next.easing = val;
            continue;
          }
          if (subPath === 'startTime' && typeof val === 'number') {
            next.startTime = val;
            continue;
          }
          if (subPath === 'duration' && typeof val === 'number') {
            next.duration = val;
            continue;
          }
          setByPath(next.properties as unknown as Record<string, unknown>, subPath, val);
          continue;
        }
        // Also support scalar track keys like track.<id>.duration, track.<id>.easing
        if (key.startsWith(trackScalarPrefix)) {
          const sub = key.slice(trackScalarPrefix.length);
          const val = reader(key);
          if (val === undefined) continue;
          if (sub === 'easing' && (val === 'linear' || val === 'easeInOut' || val === 'easeIn' || val === 'easeOut')) {
            next.easing = val;
            continue;
          }
          if (sub === 'startTime' && typeof val === 'number') {
            next.startTime = val;
            continue;
          }
          if (sub === 'duration' && typeof val === 'number') {
            next.duration = val;
            continue;
          }
        }
      }

      return next;
    };

    // First, apply global bindings once
    const resolvedTracks: AnimationTrack[] = originalTracks.map((t) => applyBindingsToTrack(t, globalBindingKeys, readVarGlobal));

    const allAnimations: SceneAnimationTrack[] = [];
    const passThoughObjects: unknown[] = [];
    const upstreamCursorMap = this.extractCursorsFromInputs(inputs as unknown as ExecutionValue[]);
    const outputCursorMap: Record<string, number> = { ...upstreamCursorMap };
    const perObjectAnimations: Record<string, SceneAnimationTrack[]> = this.extractPerObjectAnimationsFromInputs(inputs as unknown as ExecutionValue[]);
    const upstreamAssignments: PerObjectAssignments | undefined = this.extractPerObjectAssignmentsFromInputs(inputs as unknown as ExecutionValue[]);

    // Read node-level assignments stored on the Animation node itself
    const nodeAssignments: PerObjectAssignments | undefined = (data.perObjectAssignments as PerObjectAssignments | undefined);

    // Merge upstream + node-level; node-level takes precedence per object
    const mergedAssignments: PerObjectAssignments | undefined = (() => {
      if (!upstreamAssignments && !nodeAssignments) return undefined;
      const result: PerObjectAssignments = {};
      const objectIds = new Set<string>([
        ...Object.keys(upstreamAssignments ?? {}),
        ...Object.keys(nodeAssignments ?? {}),
      ]);
      for (const objectId of objectIds) {
        const base = upstreamAssignments?.[objectId];
        const overrides = nodeAssignments?.[objectId];
        const merged = mergeObjectAssignments(base, overrides);
        if (merged) result[objectId] = merged;
      }
      return result;
    })();

    for (const input of inputs) {
      const inputData = Array.isArray(input.data) ? input.data : [input.data];

      for (const timedObject of inputData) {
        const objectId = (timedObject as { id?: unknown }).id as string | undefined;
        const appearanceTime = (timedObject as { appearanceTime?: unknown }).appearanceTime as number | undefined;
        let baseline: number;
        if (typeof objectId === 'string' && upstreamCursorMap[objectId] !== undefined) {
          baseline = upstreamCursorMap[objectId];
        } else {
          baseline = appearanceTime ?? 0;
        }
        // Only include prior animations from the current execution path
        const priorForObject = objectId ? (perObjectAnimations[objectId] ?? []) : [];

        // Apply per-object bindings if present
        const objectBindingKeys = objectId ? Object.keys(bindingsByObject[objectId] ?? {}) : [];
        const objectReader = readVarForObject(objectId);
        const resolvedForObject = objectId ? resolvedTracks.map((t) => applyBindingsToTrack(t, objectBindingKeys, objectReader)) : resolvedTracks;

        // Build a masked per-object assignment so bound keys take precedence over manual overrides
        const maskedAssignmentsForObject = (() => {
          if (!objectId) return undefined;
          const base = mergedAssignments?.[objectId];
          if (!base) return undefined;
          const keys = [...globalBindingKeys, ...objectBindingKeys];
          
          // FIX: Use proper typing with ObjectAssignments interface instead of any
          interface ObjectAssignments {
            initial?: Record<string, unknown>;
            tracks?: Array<{
              trackId?: string;
              type?: string;
              properties?: Record<string, unknown>;
              [key: string]: unknown;
            }>;
          }
          
          const next: ObjectAssignments = { ...base };
          const prunedTracks: Array<Record<string, unknown>> = [];
          const tracks = Array.isArray(base.tracks)
            ? (base.tracks as Array<Record<string, unknown>>).map((t) => ({
                ...t,
                properties: t.properties ? deepClone(t.properties) : undefined,
              }))
            : [];
          
          for (const t of tracks) {
            // Remove overrides for any bound keys that apply to this track
            for (const key of keys) {
              const trackId = (t as { trackId?: string }).trackId;
              if (!trackId) continue;
              const trackPrefix = `track.${trackId}.`;
              if (key.startsWith(trackPrefix)) {
                const sub = key.slice(trackPrefix.length);
                if (sub === 'duration' || sub === 'startTime' || sub === 'easing') {
                  delete (t as Record<string, unknown>)[sub];
                  continue;
                }
                const trackType = (t as { type?: string }).type;
                if (!trackType) continue;
                const typePrefix = `${trackType}.`;
                if (sub.startsWith(typePrefix)) {
                  const propPath = sub.slice(typePrefix.length);
                  if (propPath === 'duration' || propPath === 'startTime' || propPath === 'easing') {
                    delete (t as Record<string, unknown>)[sub];
                  } else if ((t as { properties?: Record<string, unknown> }).properties) {
                    deleteByPath((t as { properties: Record<string, unknown> }).properties, propPath);
                  }
                }
                continue;
              }
              const trackType = (t as { type?: string }).type;
              if (!trackType) continue;
              const typePrefix = `${trackType}.`;
              if (key.startsWith(typePrefix)) {
                const subPath = key.slice(typePrefix.length);
                if (subPath === 'duration' || subPath === 'startTime' || subPath === 'easing') {
                  delete (t as Record<string, unknown>)[subPath];
                } else if ((t as { properties?: Record<string, unknown> }).properties) {
                  deleteByPath((t as { properties: Record<string, unknown> }).properties, subPath);
                }
              }
            }
            const properties = (t as { properties?: Record<string, unknown> }).properties;
            const hasProps = properties && Object.keys(properties).length > 0;
            const tRecord = t as Record<string, unknown>;
            const hasMeta = tRecord.easing !== undefined || tRecord.startTime !== undefined || tRecord.duration !== undefined;
            if (hasProps || hasMeta) prunedTracks.push(t as Record<string, unknown>);
          }
          const nextRecord = next as Record<string, unknown>;
          if (prunedTracks.length > 0) nextRecord.tracks = prunedTracks;
          else delete nextRecord.tracks;
          return { [objectId]: next } as PerObjectAssignments;
        })();

        const animations = convertTracksToSceneAnimations(
          resolvedForObject,
          objectId ?? '',
          baseline,
          priorForObject,
          maskedAssignmentsForObject
        );

        if (objectId) {
          perObjectAnimations[objectId] = [...(perObjectAnimations[objectId] ?? []), ...animations];
        }

        allAnimations.push(...animations);
        passThoughObjects.push(timedObject);

        if (objectId) {
          const localEnd = animations.length > 0
            ? Math.max(...animations.map(a => a.startTime + a.duration))
            : baseline;
          outputCursorMap[objectId] = Math.max(outputCursorMap[objectId] ?? 0, localEnd);
        }
      }
    }

    setNodeOutput(
      context,
      node.data.identifier.id,
      'output',
      'object_stream',
      passThoughObjects,
      { perObjectTimeCursor: outputCursorMap, perObjectAnimations: this.clonePerObjectAnimations(perObjectAnimations), perObjectAssignments: mergedAssignments }
    );
  }

  private clonePerObjectAnimations(map: Record<string, SceneAnimationTrack[]>): Record<string, SceneAnimationTrack[]> {
    const cloned: Record<string, SceneAnimationTrack[]> = {};
    for (const [k, v] of Object.entries(map)) {
      cloned[k] = v.map((t) => ({
        ...t,
        properties: deepClone(t.properties),
      })) as SceneAnimationTrack[];
    }
    return cloned;
  }

  private extractPerObjectAnimationsFromInputs(inputs: ExecutionValue[]): Record<string, SceneAnimationTrack[]> {
    const merged: Record<string, SceneAnimationTrack[]> = {};
    for (const input of inputs) {
      // FIX: Properly type the metadata instead of using any
      const perObj = (input.metadata as { perObjectAnimations?: Record<string, SceneAnimationTrack[]> } | undefined)?.perObjectAnimations;
      if (!perObj) continue;
      for (const [objectId, tracks] of Object.entries(perObj)) {
        const list = merged[objectId] ?? [];
        merged[objectId] = [...list, ...tracks];
      }
    }
    return merged;
  }

  private extractCursorsFromInputs(inputs: ExecutionValue[]): Record<string, number> {
    const maps: Record<string, number>[] = [];
    for (const input of inputs) {
      // FIX: Properly type the metadata instead of using any
      const cursors = (input.metadata as { perObjectTimeCursor?: Record<string, number> } | undefined)?.perObjectTimeCursor;
      if (cursors) maps.push(cursors);
    }
    if (maps.length === 0) return {};
    return mergeCursorMaps(maps);
  }

  private extractPerObjectAssignmentsFromInputs(inputs: ExecutionValue[]): PerObjectAssignments | undefined {
    const merged: PerObjectAssignments = {};
    let found = false;
    for (const input of inputs) {
      // FIX: Properly type the metadata instead of using any
      const fromMeta = (input.metadata as { perObjectAssignments?: PerObjectAssignments } | undefined)?.perObjectAssignments;
      if (!fromMeta) continue;
      for (const input of inputs) {
        // FIX: Properly type the metadata instead of using any
        const fromMeta = (input.metadata as { perObjectAssignments?: PerObjectAssignments } | undefined)?.perObjectAssignments;
        if (!fromMeta) continue;
        for (const [objectId, assignment] of Object.entries(fromMeta)) {
          found = true;
          const base = merged[objectId];
          const combined = mergeObjectAssignments(base, assignment);
          if (combined) merged[objectId] = combined;
        }
      }
    }
    return found ? merged : undefined;
  }

  private async executeTextStyle(
    node: ReactFlowNode<NodeData>,
    context: ExecutionContext,
    connections: ReactFlowEdge[]
  ): Promise<void> {
    const data = node.data as unknown as Record<string, unknown>;
    const inputs = getConnectedInputs(
      context,
      connections as unknown as Array<{ target: string; targetHandle: string; source: string; sourceHandle: string }>,
      node.data.identifier.id,
      'input'
    );

    logger.info(`Applying text styling: ${node.data.identifier.displayName}`);

    // Variable binding resolution (identical to Canvas pattern)
    const bindings = (data.variableBindings as Record<string, { target?: string; boundResultNodeId?: string }> | undefined) ?? {};
    const bindingsByObject = (data.variableBindingsByObject as Record<string, Record<string, { target?: string; boundResultNodeId?: string }>> | undefined) ?? {};
    
    const readVarGlobal = (key: string): unknown => {
      const rid = bindings[key]?.boundResultNodeId;
      if (!rid) return undefined;
      return (context.nodeOutputs.get(`${rid}.output`) ?? context.nodeOutputs.get(`${rid}.result`))?.data;
    };
    
    const readVarForObject = (objectId: string | undefined) => (key: string): unknown => {
      if (!objectId) return readVarGlobal(key);
      const rid = bindingsByObject[objectId]?.[key]?.boundResultNodeId;
      if (rid) return (context.nodeOutputs.get(`${rid}.output`) ?? context.nodeOutputs.get(`${rid}.result`))?.data;
      return readVarGlobal(key);
    };

    // Build text style overrides with proper defaults
    const baseOverrides: {
      fontFamily?: string;
      fontWeight?: string;
      textAlign?: string;
      lineHeight?: number;
      letterSpacing?: number;
    } = {
      fontFamily: data.fontFamily as string,
      fontWeight: data.fontWeight as string,
      textAlign: data.textAlign as string,
      lineHeight: data.lineHeight as number,
      letterSpacing: data.letterSpacing as number,
    };

    // Apply all global binding keys generically into baseOverrides
    const globalKeys = Object.keys(bindings);
    const nodeOverrides = JSON.parse(JSON.stringify(baseOverrides)) as typeof baseOverrides;
    for (const key of globalKeys) {
      const val = readVarGlobal(key);
      if (val === undefined) continue;
      
      // Type-safe property setting for TextStyle overrides
      switch (key) {
        case 'fontFamily':
          if (typeof val === 'string') nodeOverrides.fontFamily = val;
          break;
        case 'fontWeight':
          if (typeof val === 'string') nodeOverrides.fontWeight = val;
          break;
        case 'textAlign':
          if (typeof val === 'string') nodeOverrides.textAlign = val;
          break;
        case 'lineHeight':
          if (typeof val === 'number') nodeOverrides.lineHeight = val;
          break;
        case 'letterSpacing':
          if (typeof val === 'number') nodeOverrides.letterSpacing = val;
          break;
      }
    }

    const processedObjects: unknown[] = [];

    // Read optional per-object assignments metadata (from upstream)
    const upstreamAssignments: PerObjectAssignments | undefined = this.extractPerObjectAssignmentsFromInputs(inputs);
    // Read node-level assignments stored on the TextStyle node itself
    const nodeAssignments: PerObjectAssignments | undefined = data.perObjectAssignments as PerObjectAssignments | undefined;

    // Merge upstream + node-level; node-level takes precedence per object
    const mergedAssignments: PerObjectAssignments | undefined = (() => {
      if (!upstreamAssignments && !nodeAssignments) return undefined;
      const result: PerObjectAssignments = {};
      const objectIds = new Set<string>([
        ...Object.keys(upstreamAssignments ?? {}),
        ...Object.keys(nodeAssignments ?? {}),
      ]);
      for (const objectId of objectIds) {
        const base = upstreamAssignments?.[objectId];
        const overrides = nodeAssignments?.[objectId];
        const merged = mergeObjectAssignments(base, overrides);
        if (merged) result[objectId] = merged;
      }
      return result;
    })();

    for (const input of inputs) {
      const inputData = Array.isArray(input.data) ? input.data : [input.data];
      
      for (const obj of inputData) {
        if (this.isTextObject(obj)) {
          const processed = this.processTextObject(
            obj,
            nodeOverrides,
            mergedAssignments,
            bindingsByObject,
            readVarForObject
          );
          processedObjects.push(processed);
        } else {
          // Pass through non-text objects unchanged
          processedObjects.push(obj);
        }
      }
    }

    setNodeOutput(
      context,
      node.data.identifier.id,
      'output',
      'object_stream',
      processedObjects,
      {
        perObjectTimeCursor: this.extractCursorsFromInputs(inputs),
        perObjectAnimations: this.extractPerObjectAnimationsFromInputs(inputs),
        perObjectAssignments: mergedAssignments
      }
    );

    logger.info(`Text styling applied: ${processedObjects.length} objects processed`);
  }

  // Helper methods (follow Canvas implementation patterns)
  private isTextObject(obj: unknown): obj is SceneObject {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      'type' in obj &&
      (obj as { type: string }).type === 'text'
    );
  }

  private processTextObject(
    obj: SceneObject,
    nodeOverrides: {
      fontFamily?: string;
      fontWeight?: string;
      textAlign?: string;
      lineHeight?: number;
      letterSpacing?: number;
    },
    assignments: PerObjectAssignments | undefined,
    bindingsByObject: Record<string, Record<string, { target?: string; boundResultNodeId?: string }>>,
    readVarForObject: (objectId: string | undefined) => (key: string) => unknown
  ): SceneObject {
    const objectId = obj.id;
    const reader = readVarForObject(objectId);
    
    // Build object-specific overrides
    const objectOverrides = { ...nodeOverrides };
    const objectKeys = Object.keys(bindingsByObject[objectId] ?? {});
    
    for (const key of objectKeys) {
      const value = reader(key);
      if (value !== undefined) {
        switch (key) {
          case 'fontFamily':
            if (typeof value === 'string') objectOverrides.fontFamily = value;
            break;
          case 'fontWeight':
            if (typeof value === 'string') objectOverrides.fontWeight = value;
            break;
          case 'textAlign':
            if (typeof value === 'string') objectOverrides.textAlign = value;
            break;
          case 'lineHeight':
            if (typeof value === 'number') objectOverrides.lineHeight = value;
            break;
          case 'letterSpacing':
            if (typeof value === 'number') objectOverrides.letterSpacing = value;
            break;
        }
      }
    }

    // Apply per-object assignments (masking bound properties)
    const assignmentsForObject = assignments?.[objectId];
    const maskedAssignmentsForObject = (() => {
      if (!assignmentsForObject) return undefined;
      const keys = objectKeys; // Only use per-object bindings
      const next: ObjectAssignments = { ...assignmentsForObject };
      const initial = { ...(next.initial ?? {}) } as Record<string, unknown>;
      
      // Remove properties that are bound by variables
      for (const key of keys) {
        switch (key) {
          case 'fontFamily': delete initial.fontFamily; break;
          case 'fontWeight': delete initial.fontWeight; break;
          case 'textAlign': delete initial.textAlign; break;
          case 'lineHeight': delete initial.lineHeight; break;
          case 'letterSpacing': delete initial.letterSpacing; break;
          default: break;
        }
      }
      
      // Prune empty objects recursively
      const prunedInitial = (() => {
        const obj = JSON.parse(JSON.stringify(initial)) as Record<string, unknown>;
        const prune = (o: Record<string, unknown>): Record<string, unknown> => {
          for (const k of Object.keys(o)) {
            if (o[k] && typeof o[k] === 'object' && !Array.isArray(o[k])) {
              o[k] = prune(o[k] as Record<string, unknown>);
              if (Object.keys(o[k] as Record<string, unknown>).length === 0) {
                delete o[k];
              }
            }
          }
          return o;
        };
        return prune(obj);
      })();
      
      if (Object.keys(prunedInitial).length > 0) {
        next.initial = prunedInitial;
      } else {
        delete next.initial;
      }
      return next;
    })();

    // Apply text styling from assignments
    const finalTextStyle = {
      fontFamily: (maskedAssignmentsForObject?.initial as Record<string, unknown>)?.fontFamily as string ?? objectOverrides.fontFamily,
      fontWeight: (maskedAssignmentsForObject?.initial as Record<string, unknown>)?.fontWeight as string ?? objectOverrides.fontWeight,
      textAlign: (maskedAssignmentsForObject?.initial as Record<string, unknown>)?.textAlign as string ?? objectOverrides.textAlign,
      lineHeight: (maskedAssignmentsForObject?.initial as Record<string, unknown>)?.lineHeight as number ?? objectOverrides.lineHeight,
      letterSpacing: (maskedAssignmentsForObject?.initial as Record<string, unknown>)?.letterSpacing as number ?? objectOverrides.letterSpacing,
    };

    // Return object with applied text styling
    return {
      ...obj,
      textStyle: finalTextStyle
    };
  }

  private mergeAssignments(
    upstream: PerObjectAssignments | undefined,
    node: PerObjectAssignments | undefined
  ): PerObjectAssignments | undefined {
    if (!upstream && !node) return undefined;
    
    const result: PerObjectAssignments = {};
    const objectIds = new Set<string>([
      ...Object.keys(upstream ?? {}),
      ...Object.keys(node ?? {}),
    ]);
    
    for (const objectId of objectIds) {
      const base = upstream?.[objectId];
      const overrides = node?.[objectId];
      const merged = mergeObjectAssignments(base, overrides);
      if (merged) result[objectId] = merged;
    }
    
    return result;
  }



}


