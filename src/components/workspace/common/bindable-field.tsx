"use client";

import React, { useMemo, useState } from 'react';
import { NumberField, ColorField } from '@/components/ui/form-fields';
import { useWorkspace } from '@/components/workspace/workspace-context';
import { FlowTracker } from '@/lib/flow/flow-tracking';
import { Link as LinkIcon } from 'lucide-react';

interface BaseBindableProps {
  nodeId: string;
  variableKey: string;
  selectionObjectId?: string; // when set, bind per-object; otherwise defaults
  label: string;
}

interface BindableNumberFieldProps extends BaseBindableProps {
  value: number | string;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
}

interface BindableColorFieldProps extends BaseBindableProps {
  value: string;
  onChange: (value: string) => void;
}

function useBindingState(nodeId: string, selectionObjectId?: string) {
  const { state, updateFlow } = useWorkspace();
  const node = state.flow.nodes.find(n => (n as any).data?.identifier?.id === nodeId) as any;

  const getBoundName = (variableKey: string): string | null => {
    const bindings = selectionObjectId
      ? ((node?.data?.variableBindingsByObject?.[selectionObjectId] ?? {}) as Record<string, { boundResultNodeId?: string }>)
      : ((node?.data?.variableBindings ?? {}) as Record<string, { boundResultNodeId?: string }>);
    const boundId = bindings?.[variableKey]?.boundResultNodeId;
    if (!boundId) return null;
    const name = state.flow.nodes.find(n => (n as any).data?.identifier?.id === boundId)?.data?.identifier?.displayName as string | undefined;
    return name ?? boundId;
  };

  const bindTo = (variableKey: string, resultNodeId: string) => {
    updateFlow({
      nodes: state.flow.nodes.map((n) => {
        if (((n as any).data?.identifier?.id) !== nodeId) return n;
        if (selectionObjectId) {
          const prevAll = ((n as any).data?.variableBindingsByObject ?? {}) as Record<string, Record<string, { target?: string; boundResultNodeId?: string }>>;
          const prev = prevAll[selectionObjectId] ?? {};
          const nextObj = { ...prev, [variableKey]: { target: variableKey, boundResultNodeId: resultNodeId } };
          return { ...n, data: { ...(n as any).data, variableBindingsByObject: { ...prevAll, [selectionObjectId]: nextObj } } } as any;
        } else {
          const prev = ((n as any).data?.variableBindings ?? {}) as Record<string, { target?: string; boundResultNodeId?: string }>;
          const next = { ...prev, [variableKey]: { target: variableKey, boundResultNodeId: resultNodeId } };
          return { ...n, data: { ...(n as any).data, variableBindings: next } } as any;
        }
      })
    });
  };

  const clearBinding = (variableKey: string) => {
    updateFlow({
      nodes: state.flow.nodes.map((n) => {
        if (((n as any).data?.identifier?.id) !== nodeId) return n;
        if (selectionObjectId) {
          const prevAll = ((n as any).data?.variableBindingsByObject ?? {}) as Record<string, Record<string, { target?: string; boundResultNodeId?: string }>>;
          const prev = { ...(prevAll[selectionObjectId] ?? {}) };
          delete prev[variableKey];
          return { ...n, data: { ...(n as any).data, variableBindingsByObject: { ...prevAll, [selectionObjectId]: prev } } } as any;
        } else {
          const prev = ((n as any).data?.variableBindings ?? {}) as Record<string, { target?: string; boundResultNodeId?: string }>;
          const next = { ...prev };
          delete next[variableKey];
          return { ...n, data: { ...(n as any).data, variableBindings: next } } as any;
        }
      })
    });
  };

  return { getBoundName, bindTo, clearBinding } as const;
}

function BindDropdown({ nodeId, variableKey, selectionObjectId, onSelect }: { nodeId: string; variableKey: string; selectionObjectId?: string; onSelect: (resultNodeId: string) => void }) {
  const { state } = useWorkspace();
  const variables = useMemo(() => {
    const tracker = new FlowTracker();
    return tracker.getAvailableResultVariables(nodeId, state.flow.nodes as any, state.flow.edges as any);
  }, [nodeId, state.flow.nodes, state.flow.edges]);
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(v => !v)} className="p-1 rounded hover:bg-[var(--surface-interactive)]" title="Bind to Result variable">
        <LinkIcon size={14} />
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded shadow-md min-w-[160px]">
          {variables.length === 0 ? (
            <div className="px-3 py-2 text-xs text-[var(--text-tertiary)]">No connected Result variables</div>
          ) : variables.map(v => (
            <div key={v.id} className="px-3 py-2 text-xs hover:bg-[var(--surface-interactive)] cursor-pointer" onClick={() => { onSelect(v.id); setOpen(false); }}>
              {v.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function BindableNumberField({ nodeId, variableKey, selectionObjectId, label, value, onChange, min, max, step, defaultValue }: BindableNumberFieldProps) {
  const { getBoundName, bindTo, clearBinding } = useBindingState(nodeId, selectionObjectId);
  const boundName = getBoundName(variableKey);
  return (
    <div className="space-y-1">
      <NumberField
        label={label}
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        step={step}
        defaultValue={defaultValue}
        bindAdornment={<BindDropdown nodeId={nodeId} variableKey={variableKey} selectionObjectId={selectionObjectId} onSelect={(rid) => bindTo(variableKey, rid)} />}
      />
      <div className="flex items-center gap-2 text-[10px] text-[var(--text-tertiary)]">
        {boundName ? <span>(bound: {boundName})</span> : null}
        {boundName ? <button className="underline" onClick={() => clearBinding(variableKey)}>Use manual</button> : null}
      </div>
    </div>
  );
}

export function BindableColorField({ nodeId, variableKey, selectionObjectId, label, value, onChange }: BindableColorFieldProps) {
  const { getBoundName, bindTo, clearBinding } = useBindingState(nodeId, selectionObjectId);
  const boundName = getBoundName(variableKey);
  return (
    <div className="space-y-1">
      <ColorField
        label={label}
        value={value}
        onChange={onChange}
        bindAdornment={<BindDropdown nodeId={nodeId} variableKey={variableKey} selectionObjectId={selectionObjectId} onSelect={(rid) => bindTo(variableKey, rid)} />}
      />
      <div className="flex items-center gap-2 text-[10px] text-[var(--text-tertiary)]">
        {boundName ? <span>(bound: {boundName})</span> : null}
        {boundName ? <button className="underline" onClick={() => clearBinding(variableKey)}>Use manual</button> : null}
      </div>
    </div>
  );
}