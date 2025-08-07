// src/components/editor/property-panel.tsx - Registry-aware property panel
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
  FilterNodeData
} from "@/shared/types/nodes";
import type { PropertySchema } from "@/shared/types/properties";

interface PropertyPanelProps {
  node: Node<NodeData>;
  onChange: (data: Partial<NodeData>) => void;
  onDisplayNameChange: (nodeId: string, newDisplayName: string) => boolean;
  validateDisplayName: (newName: string, nodeId: string) => string | null;
  allNodes: Node<NodeData>[];
  allEdges: Edge[];
  flowTracker: FlowTracker;
}

// Type guard functions (unchanged)
function isAnimationNodeData(data: NodeData): data is AnimationNodeData {
  return 'duration' in data && 'tracks' in data;
}

function isSceneNodeData(data: NodeData): data is SceneNodeData {
  return 'width' in data && 'height' in data && 'fps' in data && 'backgroundColor' in data;
}

function isFilterNodeData(data: NodeData): data is FilterNodeData {
  return 'selectedObjectIds' in data;
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
    </div>
  );
}

interface SchemaBasedProps {
  properties: PropertySchema[];
  data: NodeData;
  onChange: (data: Partial<NodeData>) => void;
}

function SchemaBasedProperties({ 
  properties, 
  data, 
  onChange 
}: SchemaBasedProps) {
  const renderProperty = (schema: PropertySchema) => {
    const value = (data as unknown as Record<string, unknown>)[schema.key] ?? schema.defaultValue;

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
            defaultValue={schema.defaultValue as number}
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
            value={value as string}
            onChange={(newValue) => onChange({ [schema.key]: newValue } as Partial<NodeData>)}
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
              {schema.label} ({value})
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
          <div key={schema.key} className="text-gray-400 text-sm">
            Unsupported property type: {schema.type}
          </div>
        ) as React.ReactElement;
    }
  };

  return (
    <>
      {properties.map(renderProperty)}
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
                        backgroundColor: (objectNode.data as Record<string, unknown>).color as string || '#666'
                      }}
                    >
                      {nodeDefinition?.rendering.icon || '?'}
                    </div>
                    <span className="text-sm text-white truncate">
                      {objectNode.data.identifier.displayName}
                    </span>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {nodeDefinition?.label || objectNode.type}
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