// src/components/editor/property-mapping-modal.tsx
"use client";

import { useEffect, useMemo, useState } from 'react';
import type { Node } from 'reactflow';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberField, SelectField, ColorField } from '@/components/ui/form-fields';
import type { AnimationNodeData, AnimationTrack, NodeData, PropertyOverrides } from '@/shared/types/nodes';
import { getTrackRegistryEntry } from '@/shared/registry/track-registry';
import type { PropertySchema } from '@/shared/types/properties';

interface PropertyMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  animationData: AnimationNodeData;
  onChange: (data: Partial<NodeData>) => void;
  upstreamObjects: Node<NodeData>[];
  fixedTrackId?: string;
  fixedPropertyKey?: string;
}

export function PropertyMappingModal({ isOpen, onClose, animationData, onChange, upstreamObjects, fixedTrackId, fixedPropertyKey }: PropertyMappingModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(fixedTrackId ?? null);
  const [selectedPropertyKey, setSelectedPropertyKey] = useState<string | null>(fixedPropertyKey ?? null);

  // Ensure modal state always reflects the latest fixed inputs when opened
  // Prevents stale selections showing incorrect track/property from previous opens
  useEffect(() => {
    if (isOpen) {
      setSelectedTrackId(fixedTrackId ?? null);
      setSelectedPropertyKey(fixedPropertyKey ?? null);
      setSearchTerm('');
    }
  }, [isOpen, fixedTrackId, fixedPropertyKey]);

  const filteredObjects = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    return upstreamObjects.filter(o =>
      o.data.identifier.displayName.toLowerCase().includes(lower)
    );
  }, [upstreamObjects, searchTerm]);

  const selectedTrack: AnimationTrack | undefined = useMemo(() => {
    return animationData.tracks.find(t => t.id === selectedTrackId);
  }, [animationData.tracks, selectedTrackId]);

  // Support nested keys like 'from.x' or 'to.y' for move tracks
  const { basePropertyKey, nestedPath } = useMemo(() => {
    if (!selectedPropertyKey) return { basePropertyKey: null as string | null, nestedPath: null as string | null };
    const parts = selectedPropertyKey.split('.') as string[];
    if (parts.length > 1) {
      return { basePropertyKey: parts[0]!, nestedPath: parts.slice(1).join('.') };
    }
    return { basePropertyKey: selectedPropertyKey, nestedPath: null };
  }, [selectedPropertyKey]);

  const propertySchema: PropertySchema | undefined = useMemo(() => {
    if (!selectedTrack || !basePropertyKey) return undefined;
    const entry = getTrackRegistryEntry(selectedTrack.type);
    return entry?.properties.find(p => p.key === basePropertyKey);
  }, [selectedTrack, basePropertyKey]);

  const propertyOptions = useMemo(() => {
    if (!selectedTrack) return [] as PropertySchema[];
    const entry = getTrackRegistryEntry(selectedTrack.type);
    return entry?.properties ?? [];
  }, [selectedTrack]);

  const ensureOverrides = (overrides: PropertyOverrides | undefined): PropertyOverrides => overrides ?? {};

  const handleOverrideChange = (objectId: string, value: unknown) => {
    if (!selectedTrack || !basePropertyKey) return;
    const next: PropertyOverrides = ensureOverrides(animationData.propertyOverrides);
    next[selectedTrack.id] ??= {};
    const key = selectedPropertyKey!; // store full key including nested path for precision
    next[selectedTrack.id]![key] ??= { overrides: {} };
    next[selectedTrack.id]![key]!.overrides[objectId] = { type: 'manual', value };
    onChange({ propertyOverrides: { ...next } });
  };

  const handleRemoveOverride = (objectId: string) => {
    if (!selectedTrack || !selectedPropertyKey) return;
    const next: PropertyOverrides = ensureOverrides(animationData.propertyOverrides);
    const entry = next[selectedTrack.id]?.[selectedPropertyKey];
    if (entry && entry.overrides && objectId in entry.overrides) {
      const { [objectId]: _removed, ...rest } = entry.overrides;
      next[selectedTrack.id]![selectedPropertyKey] = { overrides: rest };
      onChange({ propertyOverrides: { ...next } });
    }
  };

  const renderValueInput = (objectId: string) => {
    if (!propertySchema || !selectedTrack) return null;
    const lookupKey = selectedPropertyKey ?? propertySchema.key;
    const overrideValue = animationData.propertyOverrides?.[selectedTrack.id]?.[lookupKey]?.overrides[objectId];
    const isOverridden = overrideValue !== undefined;

    // For display default, try to read current track property value (supports nested path)
    let current: unknown = (selectedTrack as any).properties?.[propertySchema.key];
    if (nestedPath) {
      const root = (selectedTrack as any).properties?.[basePropertyKey!];
      if (root && typeof root === 'object') {
        const segs = nestedPath.split('.');
        current = segs.reduce((acc: any, seg) => (acc ? acc[seg] : undefined), root);
      }
    }
    const displayValue = isOverridden && overrideValue?.type === 'manual' ? overrideValue.value : current;

    switch (propertySchema.type) {
      case 'number':
        return (
          <NumberField
            label=""
            value={typeof displayValue === 'number' ? displayValue : (typeof current === 'number' ? current : 0)}
            onChange={(v) => handleOverrideChange(objectId, v)}
            min={propertySchema.min}
            max={propertySchema.max}
            step={propertySchema.step}
            className="w-28"
          />
        );
      case 'color':
        return (
          <ColorField
            label=""
            value={typeof displayValue === 'string' ? displayValue : (typeof current === 'string' ? current : '#ffffff')}
            onChange={(v) => handleOverrideChange(objectId, v)}
          />
        );
      case 'string':
        return (
          <Input
            value={typeof displayValue === 'string' ? displayValue : (typeof current === 'string' ? current : '')}
            onChange={(e) => handleOverrideChange(objectId, e.target.value)}
            className="w-40"
          />
        );
      case 'boolean':
        return (
          <input
            type="checkbox"
            checked={Boolean(displayValue ?? current ?? false)}
            onChange={(e) => handleOverrideChange(objectId, e.target.checked)}
          />
        );
      case 'select':
        return (
          <SelectField
            label=""
            value={String(displayValue ?? current ?? '')}
            onChange={(v) => handleOverrideChange(objectId, v)}
            options={propertySchema.options}
          />
        );
      case 'point2d': {
        // If we are mapping a nested coordinate like from.x or to.y, show single numeric input
        if (nestedPath === 'x' || nestedPath === 'y') {
          const asNumber = typeof displayValue === 'number' ? displayValue : 0;
          return (
            <NumberField
              label=""
              value={asNumber}
              onChange={(v) => handleOverrideChange(objectId, v)}
              className="w-20"
            />
          );
        }
        const point = (displayValue as { x: number; y: number }) ?? (current as { x: number; y: number }) ?? { x: 0, y: 0 };
        return (
          <div className="flex gap-2">
            <NumberField label="X" value={point.x} onChange={(x) => handleOverrideChange(objectId, { ...point, x })} className="w-20" />
            <NumberField label="Y" value={point.y} onChange={(y) => handleOverrideChange(objectId, { ...point, y })} className="w-20" />
          </div>
        );
      }
      default:
        return (
          <div className="text-xs text-gray-400">Unsupported type</div>
        );
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Property Overrides" size="lg">
      <div className="space-y-4">
        {!fixedTrackId || !fixedPropertyKey ? (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Transform</label>
              <select
                value={selectedTrackId ?? ''}
                onChange={(e) => { setSelectedTrackId(e.target.value || null); setSelectedPropertyKey(null); }}
                className="w-full bg-gray-800 text-white rounded px-2 py-1"
              >
                <option value="">Select a transform</option>
                {animationData.tracks.map((t) => (
                  <option key={t.id} value={t.id}>{t.type} ({t.id.slice(-6)})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Transform Property</label>
              <select
                value={selectedPropertyKey ?? ''}
                onChange={(e) => setSelectedPropertyKey(e.target.value || null)}
                disabled={!selectedTrackId}
                className="w-full bg-gray-800 text-white rounded px-2 py-1"
              >
                <option value="">Select a property</option>
                {propertyOptions.map((p) => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Search Objects</label>
              <Input placeholder="Filter objects..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <div className="text-sm text-gray-300">
              <div className="text-gray-400">Transform</div>
              <div>{(selectedTrack as any)?.displayName || selectedTrack?.type}</div>
            </div>
            <div className="text-sm text-gray-300">
              <div className="text-gray-400">Transform Property</div>
              <div>{propertySchema?.label ?? fixedPropertyKey}</div>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Search Objects</label>
              <Input placeholder="Filter objects..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>
        )}

        {(!selectedTrackId || !selectedPropertyKey) ? (
          <div className="text-xs text-gray-400 py-6">Select a track and property to map overrides.</div>
        ) : (
          <div className="max-h-72 overflow-y-auto divide-y divide-gray-700">
            {filteredObjects.map((obj) => {
              const objectId = obj.data.identifier.id;
              const isOverridden = !!animationData.propertyOverrides?.[selectedTrackId!]?.[selectedPropertyKey!]?.overrides[objectId];
              return (
                <div key={objectId} className="flex items-center justify-between py-2 gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-white truncate">{obj.data.identifier.displayName}</div>
                    <div className="text-xs text-gray-400">{obj.type}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {renderValueInput(objectId)}
                    {isOverridden && (
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveOverride(objectId)} className="text-red-400">×</Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}


