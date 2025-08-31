"use client";

import { useMemo } from "react";
import type { Node } from "reactflow";
import { useWorkspace } from "@/components/workspace/workspace-context";
import type { NodeData } from "@/shared/types/nodes";

export interface BatchOverridesData {
  perObjectDefault?: unknown;
  perKeyOverrides: Record<string, unknown>;
}

export function useBatchOverrides(
  nodeId: string,
  fieldPath: string,
  objectId?: string,
): {
  data: BatchOverridesData;
  setPerObjectDefault: (value: unknown) => void;
  setPerKeyOverride: (key: string, value: unknown) => void;
  clearOverride: (key?: string) => void; // undefined => clear per-object default
  hasOverrides: boolean;
} {
  const { state, updateFlow } = useWorkspace();

  const node = useMemo(
    () => state.flow.nodes.find((n) => n.data?.identifier?.id === nodeId) as Node<NodeData> | undefined,
    [state.flow.nodes, nodeId],
  );

  const locus = useMemo(() => {
    const map = ((node?.data as any)?.batchOverridesByField ?? {}) as Record<string, Record<string, Record<string, unknown>>>;
    const byField = map[fieldPath] ?? {};
    const objKey = objectId ?? "__default_object__"; // group per-object; default row uses a fixed id
    const byKey = byField[objKey] ?? {};
    // per-object default stored under key "default"
    const { default: def, ...rest } = byKey as Record<string, unknown> & { default?: unknown };
    return {
      perObjectDefault: def,
      perKeyOverrides: rest as Record<string, unknown>,
    } as BatchOverridesData;
  }, [node, fieldPath, objectId]);

  const write = (producer: (draft: Record<string, Record<string, Record<string, unknown>>>) => void) => {
    updateFlow({
      nodes: state.flow.nodes.map((n) => {
        if (n.data?.identifier?.id !== nodeId) return n;
        const base = ((n.data as any)?.batchOverridesByField ?? {}) as Record<string, Record<string, Record<string, unknown>>>;
        const draft: Record<string, Record<string, Record<string, unknown>>> = JSON.parse(JSON.stringify(base));
        producer(draft);
        // Cleanup empty maps to keep state lean
        for (const fp of Object.keys(draft)) {
          const byObj = draft[fp];
          for (const obj of Object.keys(byObj)) {
            if (Object.keys(byObj[obj] ?? {}).length === 0) delete byObj[obj];
          }
          if (Object.keys(byObj ?? {}).length === 0) delete draft[fp];
        }
        return {
          ...n,
          data: {
            ...n.data,
            batchOverridesByField: Object.keys(draft).length > 0 ? draft : undefined,
          } as NodeData,
        };
      }),
    });
  };

  const setPerObjectDefault = (value: unknown) => {
    write((draft) => {
      const objKey = objectId ?? "__default_object__";
      draft[fieldPath] ??= {};
      draft[fieldPath][objKey] ??= {};
      if (value === undefined || value === null || value === "") delete draft[fieldPath][objKey]["default"];
      else draft[fieldPath][objKey]["default"] = value as unknown;
    });
  };

  const setPerKeyOverride = (key: string, value: unknown) => {
    const k = String(key).trim();
    if (!k) return;
    write((draft) => {
      const objKey = objectId ?? "__default_object__";
      draft[fieldPath] ??= {};
      draft[fieldPath][objKey] ??= {};
      draft[fieldPath][objKey][k] = value as unknown;
    });
  };

  const clearOverride = (key?: string) => {
    write((draft) => {
      const objKey = objectId ?? "__default_object__";
      const byField = draft[fieldPath];
      if (!byField) return;
      const byKey = byField[objKey];
      if (!byKey) return;
      if (!key) delete byKey["default"];
      else delete byKey[String(key)];
    });
  };

  const hasOverrides = useMemo(
    () => locus.perObjectDefault !== undefined || Object.keys(locus.perKeyOverrides).length > 0,
    [locus],
  );

  return { data: locus, setPerObjectDefault, setPerKeyOverride, clearOverride, hasOverrides };
}


