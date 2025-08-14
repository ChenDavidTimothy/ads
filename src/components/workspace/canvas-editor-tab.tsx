"use client";

import React, { useMemo, useState, useCallback } from 'react';
import { useWorkspace } from './workspace-context';
import { FlowTracker } from '@/lib/flow/flow-tracking';
import { EditorShell } from './common/editor-shell';
import { ObjectSelectionPanel } from './common/object-selection-panel';
import { useUnifiedProperties } from './properties/use-unified-properties';
import { 
  UnifiedPropertyField,
  PositionFields,
  ScaleFields
} from './properties/unified-property-field';

export function CanvasEditorTab({ nodeId }: { nodeId: string }) {
  const { state, updateUI } = useWorkspace();
  const propertyManager = useUnifiedProperties(nodeId);

  // Find the canvas node
  const canvasNode = useMemo(() => 
    state.flow.nodes.find(n => (n as any)?.data?.identifier?.id === nodeId) as any, 
    [state.flow.nodes, nodeId]
  );

  // Compute upstream objects
  const upstreamObjects = useMemo(() => {
    const tracker = new FlowTracker();
    return tracker.getUpstreamGeometryObjects(nodeId, state.flow.nodes as unknown as any[], state.flow.edges as any[]);
  }, [nodeId, state.flow.nodes, state.flow.edges]);

  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

  const handleFieldChange = useCallback((fieldPath: string, value: any) => {
    propertyManager.updateFieldOverride(fieldPath, value, selectedObjectId || undefined);
  }, [propertyManager, selectedObjectId]);

  const handleClearAllOverrides = useCallback(() => {
    if (selectedObjectId) {
      propertyManager.clearAllOverrides(selectedObjectId);
    }
  }, [propertyManager, selectedObjectId]);

  return (
    <EditorShell
      title="Canvas"
      left={(
        <div className="w-[var(--sidebar-width)] border-r border-[var(--border-primary)] p-[var(--space-3)] bg-[var(--surface-1)]">
          <div className="space-y-[var(--space-3)]">
            <div>
              <div className="text-xs text-[var(--text-tertiary)] mb-[var(--space-2)]">Default</div>
              <DefaultSelector onClick={() => setSelectedObjectId(null)} active={selectedObjectId === null} />
            </div>
            <div className="pt-[var(--space-3)] border-t border-[var(--border-primary)]">
              <ObjectSelectionPanel
                items={upstreamObjects.map(o => ({ id: o.data.identifier.id, label: o.data.identifier.displayName }))}
                selectedId={selectedObjectId}
                onSelect={(id) => setSelectedObjectId(id)}
                emptyLabel="No upstream objects"
                title="Objects"
              />
            </div>
          </div>
        </div>
      )}
      center={(
        <div className="flex-1 p-[var(--space-4)]">
          <div className="h-full w-full flex items-center justify-center text-[var(--text-tertiary)]">
            No timeline for Canvas. Select Default or an object on the left to edit its properties.
          </div>
        </div>
      )}
      right={(
        selectedObjectId ? (
          <CanvasPerObjectProperties
            nodeId={nodeId}
            objectId={selectedObjectId}
            propertyManager={propertyManager}
            onClear={handleClearAllOverrides}
          />
        ) : (
          <CanvasDefaultProperties
            nodeId={nodeId}
            canvasNode={canvasNode}
            propertyManager={propertyManager}
          />
        )
      )}
      rightHeader={<h3 className="text-lg font-semibold text-[var(--text-primary)] mb-[var(--space-4)]">Properties</h3>}
      onBack={() => updateUI({ activeTab: 'flow', selectedNodeId: undefined, selectedNodeType: undefined })}
      headerExtras={(
        <div className="flex items-center gap-[var(--space-2)]">
          <span className="text-xs text-[var(--text-tertiary)]">Selection:</span>
          <select
            className="bg-[var(--surface-1)] text-[var(--text-primary)] text-xs px-[var(--space-2)] py-[var(--space-1)] rounded border border-[var(--border-primary)]"
            value={selectedObjectId ?? ''}
            onChange={(e) => setSelectedObjectId(e.target.value || null)}
          >
            <option value="">Default</option>
            {upstreamObjects.map((obj) => (
              <option key={obj.data.identifier.id} value={obj.data.identifier.id}>
                {obj.data.identifier.displayName}
              </option>
            ))}
          </select>
        </div>
      )}
    />
  );
}

function DefaultSelector({ onClick, active }: { onClick: () => void; active: boolean }) {
  return (
    <div
      className={`flex items-center space-x-3 py-[var(--space-1)] px-[var(--space-2)] rounded-[var(--radius-sm)] cursor-pointer ${active ? 'bg-[color:rgba(59,130,246,0.2)]' : 'hover:bg-[var(--surface-interactive)]'}`}
      onClick={onClick}
    >
      <input type="radio" checked={active} readOnly className="rounded" />
      <span className="text-sm text-[var(--text-primary)] truncate flex-1">Default</span>
    </div>
  );
}

interface CanvasDefaultPropertiesProps {
  nodeId: string;
  canvasNode: any;
  propertyManager: any;
}

function CanvasDefaultProperties({ nodeId, canvasNode, propertyManager }: CanvasDefaultPropertiesProps) {
  const data = canvasNode?.data ?? {};
  
  // Get default values from node data
  const defaults = {
    position: data.position ?? { x: 0, y: 0 },
    rotation: data.rotation ?? 0,
    scale: data.scale ?? { x: 1, y: 1 },
    opacity: data.opacity ?? 1,
    fillColor: data.fillColor ?? '#ff0000',
    strokeColor: data.strokeColor ?? '#000000',
    strokeWidth: data.strokeWidth ?? 1
  };

  const globalOverrides = propertyManager.getOverrides();

  return (
    <div className="space-y-[var(--space-2)]">
      <PositionFields
        nodeId={nodeId}
        overrides={globalOverrides}
        onOverrideChange={propertyManager.updateFieldOverride}
        defaultX={defaults.position.x}
        defaultY={defaults.position.y}
      />
      
      <ScaleFields
        nodeId={nodeId}
        overrides={globalOverrides}
        onOverrideChange={propertyManager.updateFieldOverride}
        defaultX={defaults.scale.x}
        defaultY={defaults.scale.y}
      />
      
      <div className="grid grid-cols-2 gap-[var(--space-2)]">
        <UnifiedPropertyField
          nodeId={nodeId}
          fieldPath="rotation"
          label="Rotation"
          type="number"
          defaultValue={defaults.rotation}
          overrides={globalOverrides}
          onOverrideChange={propertyManager.updateFieldOverride}
          step={0.1}
        />
        <UnifiedPropertyField
          nodeId={nodeId}
          fieldPath="opacity"
          label="Opacity"
          type="number"
          defaultValue={defaults.opacity}
          overrides={globalOverrides}
          onOverrideChange={propertyManager.updateFieldOverride}
          min={0}
          max={1}
          step={0.05}
        />
      </div>
      
      <div className="grid grid-cols-3 gap-[var(--space-2)] items-end">
        <UnifiedPropertyField
          nodeId={nodeId}
          fieldPath="fillColor"
          label="Fill"
          type="color"
          defaultValue={defaults.fillColor}
          overrides={globalOverrides}
          onOverrideChange={propertyManager.updateFieldOverride}
        />
        <UnifiedPropertyField
          nodeId={nodeId}
          fieldPath="strokeColor"
          label="Stroke"
          type="color"
          defaultValue={defaults.strokeColor}
          overrides={globalOverrides}
          onOverrideChange={propertyManager.updateFieldOverride}
        />
        <UnifiedPropertyField
          nodeId={nodeId}
          fieldPath="strokeWidth"
          label="Stroke W"
          type="number"
          defaultValue={defaults.strokeWidth}
          overrides={globalOverrides}
          onOverrideChange={propertyManager.updateFieldOverride}
          min={0}
          step={0.5}
        />
      </div>
    </div>
  );
}

interface CanvasPerObjectPropertiesProps {
  nodeId: string;
  objectId: string;
  propertyManager: any;
  onClear: () => void;
}

function CanvasPerObjectProperties({ nodeId, objectId, propertyManager, onClear }: CanvasPerObjectPropertiesProps) {
  const overrides = propertyManager.getOverrides(objectId);
  
  // Default values for per-object properties
  const defaults = {
    position: { x: 0, y: 0 },
    rotation: 0,
    scale: { x: 1, y: 1 },
    opacity: 1,
    fillColor: '#ff0000',
    strokeColor: '#000000',
    strokeWidth: 1
  };

  return (
    <div className="space-y-[var(--space-3)]">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--text-tertiary)]">Editing overrides for</span>
        <button 
          className="text-xs text-[var(--danger-500)] hover:text-[var(--danger-600)]" 
          onClick={onClear}
        >
          Clear for this object
        </button>
      </div>

      <PositionFields
        nodeId={nodeId}
        objectId={objectId}
        overrides={overrides}
        onOverrideChange={propertyManager.updateFieldOverride}
        defaultX={defaults.position.x}
        defaultY={defaults.position.y}
      />

      <ScaleFields
        nodeId={nodeId}
        objectId={objectId}
        overrides={overrides}
        onOverrideChange={propertyManager.updateFieldOverride}
        defaultX={defaults.scale.x}
        defaultY={defaults.scale.y}
      />

      <div className="grid grid-cols-2 gap-[var(--space-2)]">
        <UnifiedPropertyField
          nodeId={nodeId}
          objectId={objectId}
          fieldPath="rotation"
          label="Rotation"
          type="number"
          defaultValue={defaults.rotation}
          overrides={overrides}
          onOverrideChange={propertyManager.updateFieldOverride}
          step={0.1}
        />
        <UnifiedPropertyField
          nodeId={nodeId}
          objectId={objectId}
          fieldPath="opacity"
          label="Opacity"
          type="number"
          defaultValue={defaults.opacity}
          overrides={overrides}
          onOverrideChange={propertyManager.updateFieldOverride}
          min={0}
          max={1}
          step={0.05}
        />
      </div>

      <div className="grid grid-cols-3 gap-[var(--space-2)] items-end">
        <UnifiedPropertyField
          nodeId={nodeId}
          objectId={objectId}
          fieldPath="fillColor"
          label="Fill"
          type="color"
          defaultValue={defaults.fillColor}
          overrides={overrides}
          onOverrideChange={propertyManager.updateFieldOverride}
        />
        <UnifiedPropertyField
          nodeId={nodeId}
          objectId={objectId}
          fieldPath="strokeColor"
          label="Stroke"
          type="color"
          defaultValue={defaults.strokeColor}
          overrides={overrides}
          onOverrideChange={propertyManager.updateFieldOverride}
        />
        <UnifiedPropertyField
          nodeId={nodeId}
          objectId={objectId}
          fieldPath="strokeWidth"
          label="Stroke W"
          type="number"
          defaultValue={defaults.strokeWidth}
          overrides={overrides}
          onOverrideChange={propertyManager.updateFieldOverride}
          min={0}
          step={0.5}
        />
      </div>
    </div>
  );
}