// src/components/workspace/property-panel.tsx - Registry-aware property panel
"use client";

import { useState } from "react";
import type { Node, Edge } from "reactflow";
import { NumberField, ColorField, SelectField } from "@/components/ui/form-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getNodeDefinition } from "@/shared/registry/registry-utils";
import { RESOLUTION_PRESETS } from "@/shared/registry/registry-utils";
import type { FlowTracker } from "@/lib/flow/flow-tracking";
import type { 
  NodeData, 
  AnimationNodeData, 
  SceneNodeData,
  FilterNodeData,
  ConstantsNodeData,
  FrameNodeData,
  CanvasNodeData
} from "@/shared/types/nodes";
import type { PropertySchema } from "@/shared/types/properties";
import type { PerObjectAssignments, ObjectAssignments } from '@/shared/properties/assignments';

interface PropertyPanelProps {
  node: Node<NodeData>;
  onChange: (data: Partial<NodeData>) => void;
  onDisplayNameChange: (nodeId: string, newDisplayName: string) => boolean;
  validateDisplayName: (newName: string, nodeId: string) => string | null;
  allNodes: Node<NodeData>[];
  allEdges: Edge[];
  flowTracker: FlowTracker;
}

// Type guard functions
function isAnimationNodeData(data: NodeData): data is AnimationNodeData {
  return 'duration' in data && 'tracks' in data;
}

function isSceneNodeData(data: NodeData): data is SceneNodeData {
  return 'width' in data && 'height' in data && 'fps' in data && 'backgroundColor' in data;
}

function isFrameNodeData(data: NodeData): data is FrameNodeData {
  return 'width' in data && 'height' in data && 'format' in data && 'quality' in data;
}

function isCanvasNodeData(data: NodeData): data is CanvasNodeData {
  return 'position' in data && 'rotation' in data && 'scale' in data && 'opacity' in data;
}

function isFilterNodeData(data: NodeData): data is FilterNodeData {
  return 'selectedObjectIds' in data;
}

function isConstantsNodeData(data: NodeData): data is ConstantsNodeData {
  return 'valueType' in data;
}


export function PropertyPanel({ 
  node, 
  onChange, 
  onDisplayNameChange, 
  validateDisplayName,
  allNodes,
  allEdges,
  flowTracker
}: PropertyPanelProps) {
  const [editingName, setEditingName] = useState(false);
  const [tempDisplayName, setTempDisplayName] = useState(node.data.identifier.displayName);
  
  // Use registry to get node definition
  const nodeDefinition = getNodeDefinition(node.type!);
  
  if (!nodeDefinition) {
    return (
      <div className="text-gray-400 text-sm">
        Unknown node type: {node.type}
      </div>
    );
  }

  const handleSaveDisplayName = () => {
    const success = onDisplayNameChange(node.data.identifier.id, tempDisplayName);
    if (success) {
      setEditingName(false);
    }
  };

  const handleCancelEdit = () => {
    setTempDisplayName(node.data.identifier.displayName);
    setEditingName(false);
  };

  const currentError = editingName ? validateDisplayName(tempDisplayName, node.data.identifier.id) : null;

  return (
    <div className="space-y-4">
      {/* Node Identification Section */}
      <div className="space-y-3 pb-4 border-b border-gray-600">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Node Name
          </label>
          {editingName ? (
            <div className="space-y-2">
              <Input
                value={tempDisplayName}
                onChange={(e) => setTempDisplayName(e.target.value)}
                error={!!currentError}
                placeholder="Enter node name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !currentError) {
                    handleSaveDisplayName();
                  } else if (e.key === 'Escape') {
                    handleCancelEdit();
                  }
                }}
                autoFocus
              />
              {currentError && (
                <div className="text-xs text-red-400">{currentError}</div>
              )}
              <div className="flex gap-2">
                <Button
                  onClick={handleSaveDisplayName}
                  disabled={!!currentError}
                  variant="success"
                  size="sm"
                >
                  Save
                </Button>
                <Button
                  onClick={handleCancelEdit}
                  variant="secondary"
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-white font-medium">
                {node.data.identifier.displayName}
              </span>
              <Button
                onClick={() => setEditingName(true)}
                variant="ghost"
                size="sm"
              >
                Edit
              </Button>
            </div>
          )}
        </div>
        
        <div className="text-xs text-gray-400">
          {nodeDefinition.label} • #{node.data.identifier.sequence}
        </div>
        
        {nodeDefinition.description && (
          <div className="text-xs text-gray-500">
            {nodeDefinition.description}
          </div>
        )}
      </div>

      {/* Registry-driven Properties Section */}
      <SchemaBasedProperties 
        properties={nodeDefinition.properties.properties}
        data={node.data}
        onChange={onChange}
        nodeType={node.type!}
      />
      
      {/* Special handling for complex node types */}
      {nodeDefinition.execution.category === 'logic' && node.type === 'filter' && isFilterNodeData(node.data) && (
        <FilterSpecialProperties 
          data={node.data} 
          onChange={onChange}
          allNodes={allNodes}
          allEdges={allEdges}
          flowTracker={flowTracker}
          nodeId={node.data.identifier.id}
        />
      )}
      
      {nodeDefinition.execution.category === 'animation' && isAnimationNodeData(node.data) && (
        <AnimationSpecialProperties 
          data={node.data} 
          onChange={onChange} 
        />
      )}
      
      {nodeDefinition.execution.category === 'output' && isSceneNodeData(node.data) && (
        <SceneSpecialProperties 
          data={node.data} 
          onChange={onChange} 
        />
      )}

      {nodeDefinition.execution.category === 'output' && isFrameNodeData(node.data) && (
        <div className="space-y-2 text-xs text-gray-400">
          <div>Image output will be rendered as {node.data.format.toUpperCase()}.</div>
        </div>
      )}

      {nodeDefinition.execution.category === 'animation' && isCanvasNodeData(node.data) && (
        <div className="space-y-2 text-xs text-gray-400">
          <div>Static style overrides. No animation tracks.</div>
          <CanvasAssignmentsSection 
            node={node as Node<NodeData>} 
            onChange={onChange}
            allNodes={allNodes}
            allEdges={allEdges}
            flowTracker={flowTracker}
          />
        </div>
      )}
    </div>
  );
}

interface SchemaBasedProps {
  properties: PropertySchema[];
  data: NodeData;
  onChange: (data: Partial<NodeData>) => void;
  nodeType: string;
}

function SchemaBasedProperties({ 
  properties, 
  data, 
  onChange,
  nodeType
}: SchemaBasedProps) {
  const renderProperty = (schema: PropertySchema) => {
    const value = (data as unknown as Record<string, unknown>)[schema.key] ?? schema.defaultValue;

    // Special handling for Constants node - conditional property display
    if (nodeType === 'constants' && isConstantsNodeData(data)) {
      // Only show value properties that match the current valueType
      if (schema.key === 'numberValue' && data.valueType !== 'number') return null;
      if (schema.key === 'stringValue' && data.valueType !== 'string') return null;
      if (schema.key === 'booleanValue' && data.valueType !== 'boolean') return null;
      if (schema.key === 'colorValue' && data.valueType !== 'color') return null;
    }

    switch (schema.type) {
      case 'number':
        return (
          <NumberField
            key={schema.key}
            label={schema.label}
            value={value as number}
            onChange={(newValue) => onChange({ [schema.key]: newValue } as Partial<NodeData>)}
            min={schema.min}
            max={schema.max}
            step={schema.step}
            defaultValue={schema.defaultValue}
          />
        );

      case 'color':
        return (
          <ColorField
            key={schema.key}
            label={schema.label}
            value={value as string}
            onChange={(newValue) => onChange({ [schema.key]: newValue } as Partial<NodeData>)}
          />
        );

      case 'select':
        return (
          <SelectField
            key={schema.key}
            label={schema.label}
            value={String(value as string | number)}
            onChange={(newValue) => {
              const shouldBeNumber = typeof (data as unknown as Record<string, unknown>)[schema.key] === 'number' || typeof (schema as { defaultValue?: unknown }).defaultValue === 'number';
              const casted = shouldBeNumber ? Number(newValue) : newValue;
              onChange({ [schema.key]: casted } as Partial<NodeData>);
            }}
            options={schema.options}
          />
        );

      case 'point2d':
        const point = (value as { x: number; y: number }) ?? { x: 0, y: 0 };
        return (
          <div key={schema.key} className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
              {schema.label}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="X"
                value={point.x}
                onChange={(x) => onChange({ [schema.key]: { ...point, x } } as Partial<NodeData>)}
                defaultValue={0}
              />
              <NumberField
                label="Y"
                value={point.y}
                onChange={(y) => onChange({ [schema.key]: { ...point, y } } as Partial<NodeData>)}
                defaultValue={0}
              />
            </div>
          </div>
        );

      case 'range':
        return (
          <div key={schema.key} className="space-y-1">
            <label className="block text-xs text-gray-400">
              {schema.label} {typeof value === 'number' ? `(${value})` : ''}
            </label>
            <input
              type="range"
              min={schema.min}
              max={schema.max}
              step={schema.step}
              value={value as number}
              onChange={(e) => onChange({ [schema.key]: Number(e.target.value) } as Partial<NodeData>)}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Highest ({schema.min})</span>
              <span>Medium ({Math.round((schema.min + schema.max) / 2)})</span>
              <span>Lowest ({schema.max})</span>
            </div>
          </div>
        );

      case 'boolean':
        return (
          <div key={schema.key} className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={value as boolean}
              onChange={(e) => onChange({ [schema.key]: e.target.checked } as Partial<NodeData>)}
              className="rounded"
            />
            <label className="text-sm text-gray-300">{schema.label}</label>
          </div>
        );

      case 'string':
        return (
          <div key={schema.key} className="space-y-1">
            <label className="block text-sm font-medium text-gray-300">
              {schema.label}
            </label>
            <Input
              value={(value as string) || ''}
              onChange={(e) => onChange({ [schema.key]: e.target.value } as Partial<NodeData>)}
              placeholder={`Enter ${schema.label.toLowerCase()}`}
            />
          </div>
        );

      default:
        return (
          <div key={(schema as { key?: string }).key ?? 'unsupported'} className="text-gray-400 text-sm">
            Unsupported property type: {(schema as { type?: string }).type ?? 'unknown'}
          </div>
        );
    }
  };

  return (
    <>
      {properties.map(renderProperty).filter(Boolean)}
    </>
  );
}

interface FilterSpecialProps {
  data: FilterNodeData;
  onChange: (data: Partial<NodeData>) => void;
  allNodes: Node<NodeData>[];
  allEdges: Edge[];
  flowTracker: FlowTracker;
  nodeId: string;
}

function FilterSpecialProperties({ 
  data, 
  onChange, 
  allNodes, 
  allEdges, 
  flowTracker, 
  nodeId 
}: FilterSpecialProps) {
  // Use registry-aware flow tracking
  const upstreamObjects = flowTracker.getUpstreamGeometryObjects(nodeId, allNodes, allEdges);
  const selectedIds = new Set(data.selectedObjectIds);

  const handleToggleObject = (objectId: string) => {
    const currentSelected = new Set(data.selectedObjectIds);
    
    if (currentSelected.has(objectId)) {
      currentSelected.delete(objectId);
    } else {
      currentSelected.add(objectId);
    }
    
    onChange({ selectedObjectIds: Array.from(currentSelected) });
  };

  const handleSelectAll = () => {
    onChange({ selectedObjectIds: upstreamObjects.map(obj => obj.data.identifier.id) });
  };

  const handleSelectNone = () => {
    onChange({ selectedObjectIds: [] });
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-gray-300">
            Object Selection
          </label>
          <div className="flex gap-2">
            <Button 
              onClick={handleSelectAll} 
              variant="ghost" 
              size="sm"
              disabled={upstreamObjects.length === 0}
            >
              All
            </Button>
            <Button 
              onClick={handleSelectNone} 
              variant="ghost" 
              size="sm"
            >
              None
            </Button>
          </div>
        </div>

        {upstreamObjects.length === 0 ? (
          <div className="text-xs text-gray-500 text-center py-4 bg-gray-700 rounded border-2 border-dashed border-gray-600">
            No upstream objects available.
            <br />
            Connect geometry nodes to see filtering options.
          </div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto bg-gray-700 rounded p-3">
            {upstreamObjects.map((objectNode) => {
              const isSelected = selectedIds.has(objectNode.data.identifier.id);
              const nodeDefinition = getNodeDefinition(objectNode.type!);
              
              return (
                <div 
                  key={objectNode.data.identifier.id}
                  className="flex items-center space-x-3 py-1"
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleObject(objectNode.data.identifier.id)}
                    className="rounded"
                  />
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div 
                      className="w-4 h-4 rounded border border-gray-400 flex-shrink-0 flex items-center justify-center text-xs"
                      style={{ 
                        backgroundColor: ((objectNode.data as unknown as { color?: string })?.color) ?? '#666'
                      }}
                    >
                      {nodeDefinition?.rendering.icon ?? '?'}
                    </div>
                    <span className="text-sm text-white truncate">
                      {objectNode.data.identifier.displayName}
                    </span>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {nodeDefinition?.label ?? objectNode.type}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-gray-400 mt-2">
          <span>Selected: {data.selectedObjectIds.length}</span>
          <span>Available: {upstreamObjects.length}</span>
        </div>
      </div>
    </div>
  );
}

interface AnimationSpecialProps {
  data: AnimationNodeData;
  onChange: (data: Partial<NodeData>) => void;
}

function AnimationSpecialProperties({ data }: AnimationSpecialProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1">Tracks</label>
      <div className="text-xs text-gray-400">
        {data.tracks?.length ?? 0} animation tracks defined
      </div>
      <div className="text-xs text-blue-400 mt-2">
        Double-click the node to edit timeline
      </div>
    </div>
  );
}

interface SceneSpecialProps {
  data: SceneNodeData;
  onChange: (data: Partial<NodeData>) => void;
}

function SceneSpecialProperties({ onChange }: SceneSpecialProps) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-white mb-3">Resolution Presets</h4>
        <div className="flex gap-2 flex-wrap">
          {RESOLUTION_PRESETS.map(preset => (
            <Button
              key={preset.label}
              onClick={() => onChange({ 
                width: preset.width, 
                height: preset.height 
              } as Partial<NodeData>)}
              variant="ghost"
              size="sm"
              className="text-xs"
            >
              {preset.label} ({preset.width}×{preset.height})
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CanvasAssignmentsSection({ 
  node, 
  onChange, 
  allNodes, 
  allEdges, 
  flowTracker 
}: { 
  node: Node<NodeData>;
  onChange: (data: Partial<NodeData>) => void; 
  allNodes: Node<NodeData>[]; 
  allEdges: Edge[]; 
  flowTracker: FlowTracker; 
}) {
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

  const upstreamObjects = flowTracker.getUpstreamGeometryObjects(node.data.identifier.id, allNodes, allEdges);
  const assignments = (node.data as unknown as { perObjectAssignments?: PerObjectAssignments }).perObjectAssignments ?? {};

  const selectedOverrides = selectedObjectId ? assignments[selectedObjectId] : undefined;
  const initial = selectedOverrides?.initial ?? {};

  const handleUpdate = (updates: Partial<NonNullable<typeof initial>>) => {
    if (!selectedObjectId) return;
    const next: PerObjectAssignments = { ...assignments };
    const current: ObjectAssignments = { ...(next[selectedObjectId] ?? {}) } as ObjectAssignments;
    const currentInitial = { ...(current.initial ?? {}) } as NonNullable<typeof initial>;
    Object.assign(currentInitial, updates);
    const cleanedInitial = Object.fromEntries(Object.entries(currentInitial).filter(([_, v]) => v !== undefined)) as typeof currentInitial;
    current.initial = cleanedInitial;
    next[selectedObjectId] = current;
    onChange({ perObjectAssignments: next } as unknown as Partial<NodeData>);
  };

  const handleClear = () => {
    if (!selectedObjectId) return;
    const next: PerObjectAssignments = { ...assignments };
    delete next[selectedObjectId];
    onChange({ perObjectAssignments: next } as unknown as Partial<NodeData>);
  };

  return (
    <div className="space-y-3 mt-3 pt-3 border-t border-gray-700">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-300">Per-Object Assignments</span>
        <span className="text-xs text-gray-500">Canvas overrides</span>
      </div>

      <div className="space-y-2">
        <label className="block text-xs text-gray-400">Select Object</label>
        <select
          className="w-full bg-gray-800 text-white text-sm px-2 py-1 rounded border border-gray-700"
          value={selectedObjectId ?? ''}
          onChange={(e) => setSelectedObjectId(e.target.value || null)}
        >
          <option value="">—</option>
          {upstreamObjects.map((obj) => (
            <option key={obj.data.identifier.id} value={obj.data.identifier.id}>
              {obj.data.identifier.displayName}
            </option>
          ))}
        </select>
      </div>

      {selectedObjectId ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Editing overrides for</span>
            <button className="text-xs text-red-400 hover:text-red-300" onClick={handleClear}>Clear for this object</button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-400">Position X</label>
              <NumberField
                label=""
                value={(initial.position?.x as number) ?? NaN}
                onChange={(x) => handleUpdate({ position: { x, y: initial.position?.y ?? 0 } })}
                defaultValue={0}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400">Position Y</label>
              <NumberField
                label=""
                value={(initial.position?.y as number) ?? NaN}
                onChange={(y) => handleUpdate({ position: { x: initial.position?.x ?? 0, y } })}
                defaultValue={0}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-400">Scale X</label>
              <NumberField
                label=""
                value={(initial.scale?.x as number) ?? NaN}
                onChange={(x) => handleUpdate({ scale: { x, y: initial.scale?.y ?? 1 } })}
                defaultValue={1}
                min={0}
                step={0.1}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400">Scale Y</label>
              <NumberField
                label=""
                value={(initial.scale?.y as number) ?? NaN}
                onChange={(y) => handleUpdate({ scale: { x: initial.scale?.x ?? 1, y } })}
                defaultValue={1}
                min={0}
                step={0.1}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-400">Rotation</label>
              <NumberField
                label=""
                value={(initial.rotation as number) ?? NaN}
                onChange={(rotation) => handleUpdate({ rotation })}
                step={0.1}
                defaultValue={0}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400">Opacity</label>
              <NumberField
                label=""
                value={(initial.opacity as number) ?? NaN}
                onChange={(opacity) => handleUpdate({ opacity })}
                min={0}
                max={1}
                step={0.05}
                defaultValue={1}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 items-end">
            <div>
              <ColorField
                label="Fill"
                value={(initial.fillColor as string) ?? ''}
                onChange={(fillColor) => handleUpdate({ fillColor })}
              />
            </div>
            <div>
              <ColorField
                label="Stroke"
                value={(initial.strokeColor as string) ?? ''}
                onChange={(strokeColor) => handleUpdate({ strokeColor })}
              />
            </div>
            <div>
              <NumberField
                label="Stroke W"
                value={(initial.strokeWidth as number) ?? NaN}
                onChange={(strokeWidth) => handleUpdate({ strokeWidth })}
                min={0}
                step={0.5}
                defaultValue={1}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="text-xs text-gray-500">Select an object to assign canvas overrides</div>
      )}
    </div>
  );
}