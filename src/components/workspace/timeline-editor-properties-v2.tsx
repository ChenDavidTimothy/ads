"use client";

import React, { useCallback } from 'react';
import { useUnifiedProperties } from './properties/use-unified-properties';
import { 
  UnifiedPropertyField,
  MoveTrackFields
} from './properties/unified-property-field';
import type { AnimationTrack } from '@/shared/types/nodes';
import { 
  isMoveTrack, 
  isRotateTrack, 
  isScaleTrack, 
  isFadeTrack, 
  isColorTrack 
} from '@/shared/types/nodes';

interface UnifiedTimelinePropertiesProps {
  nodeId: string;
  selectedObjectId?: string;
  selectedTrack?: AnimationTrack;
  onTrackChange: (updates: Partial<AnimationTrack>) => void;
  onDisplayNameChange: (trackId: string, newName: string) => boolean;
  validateDisplayName: (name: string, trackId: string) => string | null;
}

export function UnifiedTimelineProperties({
  nodeId,
  selectedObjectId,
  selectedTrack,
  onTrackChange,
  onDisplayNameChange,
  validateDisplayName
}: UnifiedTimelinePropertiesProps) {
  const propertyManager = useUnifiedProperties(nodeId);

  const handleFieldChange = useCallback((fieldPath: string, value: any) => {
    if (selectedTrack) {
      // For track properties, we need to handle both global track changes and per-object overrides
      if (selectedObjectId) {
        // Per-object track override
        propertyManager.updateFieldOverride(fieldPath, value, selectedObjectId);
      } else {
        // Global track change - update the track directly
        if (fieldPath.includes('.')) {
          // Property change (e.g., "move.from.x")
          const parts = fieldPath.split('.');
          const propertyPath = parts.slice(1).join('.');
          const currentProps = { ...selectedTrack.properties } as any;
          
          // Set nested property
          let cursor = currentProps;
          const pathParts = propertyPath.split('.');
          for (let i = 0; i < pathParts.length - 1; i++) {
            const key = pathParts[i];
            if (!cursor[key]) cursor[key] = {};
            cursor = cursor[key];
          }
          cursor[pathParts[pathParts.length - 1]] = value;
          
          onTrackChange({ properties: currentProps });
        } else {
          // Direct track property (e.g., "easing", "startTime")
          onTrackChange({ [fieldPath]: value } as any);
        }
      }
    }
  }, [selectedTrack, selectedObjectId, propertyManager, onTrackChange]);

  if (!selectedTrack) {
    return (
      <div className="text-[var(--text-tertiary)] text-sm">
        Click a track to select and edit its properties
      </div>
    );
  }

  const overrides = selectedObjectId ? propertyManager.getOverrides(selectedObjectId) : undefined;
  const isPerObjectMode = !!selectedObjectId;

  const easingOptions = [
    { value: "linear", label: "Linear" },
    { value: "easeInOut", label: "Ease In Out" },
    { value: "easeIn", label: "Ease In" },
    { value: "easeOut", label: "Ease Out" },
  ];

  return (
    <div className="space-y-[var(--space-4)]">
      {/* Track Name Section */}
      {selectedTrack.identifier && !isPerObjectMode && (
        <div className="space-y-[var(--space-2)] pb-[var(--space-3)] border-b border-[var(--border-primary)]">
          <div className="flex items-center justify-between">
            <div className="text-sm text-[var(--text-secondary)]">Transform Name</div>
            <div className="text-xs text-[var(--text-tertiary)]">
              {selectedTrack.type} • #{selectedTrack.identifier.sequence}
            </div>
          </div>
          <div className="flex flex-col gap-[var(--space-1)] items-stretch">
            <input
              className="bg-[var(--surface-1)] text-[var(--text-primary)] text-sm px-[var(--space-2)] py-[var(--space-1)] rounded w-full border border-[var(--border-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-500)]"
              value={selectedTrack.identifier.displayName}
              onChange={(e) => {
                const proposed = e.target.value;
                onTrackChange({ 
                  identifier: { 
                    ...selectedTrack.identifier!, 
                    displayName: proposed 
                  } as any 
                });
              }}
              onBlur={(e) => {
                const proposed = e.target.value;
                const error = validateDisplayName(proposed, selectedTrack.identifier.id);
                if (!error) {
                  onDisplayNameChange(selectedTrack.identifier.id, proposed);
                }
              }}
            />
            {(() => {
              const err = validateDisplayName(selectedTrack.identifier.displayName, selectedTrack.identifier.id);
              return err ? <span className="text-xs text-[var(--text-red)]">{err}</span> : null;
            })()}
          </div>
        </div>
      )}

      {/* Per-Object Mode Indicator */}
      {isPerObjectMode && (
        <div className="bg-[var(--surface-1)] p-[var(--space-2)] rounded border border-[var(--border-primary)]">
          <div className="text-xs text-[var(--text-tertiary)]">
            Editing per-object overrides. Changes only affect the selected object.
          </div>
        </div>
      )}

      {/* Easing */}
      <UnifiedPropertyField
        nodeId={nodeId}
        objectId={selectedObjectId}
        fieldPath={`track.${selectedTrack.identifier.id}.easing`}
        label="Easing"
        type="select"
        defaultValue={selectedTrack.easing}
        overrides={overrides}
        onOverrideChange={handleFieldChange}
        options={easingOptions}
      />

      {/* Start Time & Duration */}
      {!isPerObjectMode && (
        <div className="grid grid-cols-2 gap-[var(--space-2)]">
          <UnifiedPropertyField
            nodeId={nodeId}
            fieldPath={`track.${selectedTrack.identifier.id}.startTime`}
            label="Start Time"
            type="number"
            defaultValue={selectedTrack.startTime}
            overrides={overrides}
            onOverrideChange={handleFieldChange}
            min={0}
            step={0.1}
          />
          <UnifiedPropertyField
            nodeId={nodeId}
            fieldPath={`track.${selectedTrack.identifier.id}.duration`}
            label="Duration"
            type="number"
            defaultValue={selectedTrack.duration}
            overrides={overrides}
            onOverrideChange={handleFieldChange}
            min={0.1}
            step={0.1}
          />
        </div>
      )}

      {/* Track-specific Properties */}
      {isMoveTrack(selectedTrack) && (
        <MoveTrackFields
          nodeId={nodeId}
          objectId={selectedObjectId}
          trackId={selectedTrack.identifier.id}
          overrides={overrides}
          onOverrideChange={handleFieldChange}
          defaultFromX={selectedTrack.properties.from.x}
          defaultFromY={selectedTrack.properties.from.y}
          defaultToX={selectedTrack.properties.to.x}
          defaultToY={selectedTrack.properties.to.y}
        />
      )}

      {isRotateTrack(selectedTrack) && (
        <div className="space-y-[var(--space-3)]">
          <div className="text-sm font-medium text-[var(--text-primary)]">Rotate Properties</div>
          <div className="grid grid-cols-2 gap-[var(--space-2)]">
            <UnifiedPropertyField
              nodeId={nodeId}
              objectId={selectedObjectId}
              fieldPath={`track.${selectedTrack.identifier.id}.from`}
              label="From Rotation"
              type="number"
              defaultValue={selectedTrack.properties.from}
              overrides={overrides}
              onOverrideChange={handleFieldChange}
              step={0.1}
            />
            <UnifiedPropertyField
              nodeId={nodeId}
              objectId={selectedObjectId}
              fieldPath={`track.${selectedTrack.identifier.id}.to`}
              label="To Rotation"
              type="number"
              defaultValue={selectedTrack.properties.to}
              overrides={overrides}
              onOverrideChange={handleFieldChange}
              step={0.1}
            />
          </div>
        </div>
      )}

      {isScaleTrack(selectedTrack) && (
        <div className="space-y-[var(--space-3)]">
          <div className="text-sm font-medium text-[var(--text-primary)]">Scale Properties</div>
          <div className="grid grid-cols-2 gap-[var(--space-2)]">
            <UnifiedPropertyField
              nodeId={nodeId}
              objectId={selectedObjectId}
              fieldPath={`track.${selectedTrack.identifier.id}.from`}
              label="From Scale"
              type="number"
              defaultValue={selectedTrack.properties.from}
              overrides={overrides}
              onOverrideChange={handleFieldChange}
              step={0.1}
              min={0}
            />
            <UnifiedPropertyField
              nodeId={nodeId}
              objectId={selectedObjectId}
              fieldPath={`track.${selectedTrack.identifier.id}.to`}
              label="To Scale"
              type="number"
              defaultValue={selectedTrack.properties.to}
              overrides={overrides}
              onOverrideChange={handleFieldChange}
              step={0.1}
              min={0}
            />
          </div>
        </div>
      )}

      {isFadeTrack(selectedTrack) && (
        <div className="space-y-[var(--space-3)]">
          <div className="text-sm font-medium text-[var(--text-primary)]">Fade Properties</div>
          <div className="grid grid-cols-2 gap-[var(--space-2)]">
            <UnifiedPropertyField
              nodeId={nodeId}
              objectId={selectedObjectId}
              fieldPath={`track.${selectedTrack.identifier.id}.from`}
              label="From Opacity"
              type="number"
              defaultValue={selectedTrack.properties.from}
              overrides={overrides}
              onOverrideChange={handleFieldChange}
              min={0}
              max={1}
              step={0.05}
            />
            <UnifiedPropertyField
              nodeId={nodeId}
              objectId={selectedObjectId}
              fieldPath={`track.${selectedTrack.identifier.id}.to`}
              label="To Opacity"
              type="number"
              defaultValue={selectedTrack.properties.to}
              overrides={overrides}
              onOverrideChange={handleFieldChange}
              min={0}
              max={1}
              step={0.05}
            />
          </div>
        </div>
      )}

      {isColorTrack(selectedTrack) && (
        <div className="space-y-[var(--space-3)]">
          <div className="text-sm font-medium text-[var(--text-primary)]">Color Properties</div>
          <UnifiedPropertyField
            nodeId={nodeId}
            objectId={selectedObjectId}
            fieldPath={`track.${selectedTrack.identifier.id}.property`}
            label="Property"
            type="select"
            defaultValue={selectedTrack.properties.property}
            overrides={overrides}
            onOverrideChange={handleFieldChange}
            options={[
              { value: "fill", label: "Fill" },
              { value: "stroke", label: "Stroke" },
            ]}
          />
          <div className="grid grid-cols-2 gap-[var(--space-2)]">
            <UnifiedPropertyField
              nodeId={nodeId}
              objectId={selectedObjectId}
              fieldPath={`track.${selectedTrack.identifier.id}.from`}
              label="From Color"
              type="color"
              defaultValue={selectedTrack.properties.from}
              overrides={overrides}
              onOverrideChange={handleFieldChange}
            />
            <UnifiedPropertyField
              nodeId={nodeId}
              objectId={selectedObjectId}
              fieldPath={`track.${selectedTrack.identifier.id}.to`}
              label="To Color"
              type="color"
              defaultValue={selectedTrack.properties.to}
              overrides={overrides}
              onOverrideChange={handleFieldChange}
            />
          </div>
        </div>
      )}

      {/* Clear Overrides Button for Per-Object Mode */}
      {isPerObjectMode && overrides && Object.keys(overrides).length > 0 && (
        <div className="pt-[var(--space-3)] border-t border-[var(--border-primary)]">
          <button
            className="text-sm text-[var(--danger-500)] hover:text-[var(--danger-600)] underline"
            onClick={() => propertyManager.clearAllOverrides(selectedObjectId)}
          >
            Clear all overrides for this object
          </button>
        </div>
      )}
    </div>
  );
}