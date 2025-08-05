// src/components/editor/property-panel.tsx
"use client";

import type { Node } from "reactflow";
import { NumberField, ColorField, SelectField } from "@/components/ui/form-fields";
import { Button } from "@/components/ui/button";
import { getNodeDefinition } from "@/lib/types/node-definitions";
import { RESOLUTION_PRESETS } from "@/lib/constants/editor";
import type { NodeData } from "@/lib/types/nodes";
import type { PropertySchema } from "@/lib/types/property-schemas";

interface PropertyPanelProps {
  node: Node<NodeData>;
  onChange: (data: Partial<NodeData>) => void;
}

export function PropertyPanel({ node, onChange }: PropertyPanelProps) {
  const nodeDefinition = getNodeDefinition(node.type!);
  
  if (!nodeDefinition) {
    return (
      <div className="text-gray-400 text-sm">
        Unknown node type: {node.type}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SchemaBasedProperties 
        properties={nodeDefinition.properties.properties}
        data={node.data}
        onChange={onChange}
      />
      
      {/* Special handling for complex properties */}
      {node.type === 'animation' && (
        <AnimationSpecialProperties data={node.data as any} onChange={onChange} />
      )}
      
      {node.type === 'scene' && (
        <SceneSpecialProperties data={node.data as any} onChange={onChange} />
      )}
    </div>
  );
}

function SchemaBasedProperties({ 
  properties, 
  data, 
  onChange 
}: { 
  properties: PropertySchema[]; 
  data: any; 
  onChange: (data: any) => void; 
}) {
  const renderProperty = (schema: PropertySchema) => {
    const value = data[schema.key] ?? schema.defaultValue;

    switch (schema.type) {
      case 'number':
        return (
          <NumberField
            key={schema.key}
            label={schema.label}
            value={value}
            onChange={(newValue) => onChange({ [schema.key]: newValue })}
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
            value={value}
            onChange={(newValue) => onChange({ [schema.key]: newValue })}
          />
        );

      case 'select':
        return (
          <SelectField
            key={schema.key}
            label={schema.label}
            value={value}
            onChange={(newValue) => onChange({ [schema.key]: newValue })}
            options={schema.options}
          />
        );

      case 'point2d':
        const point = value || { x: 0, y: 0 };
        return (
          <div key={schema.key} className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
              {schema.label}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="X"
                value={point.x}
                onChange={(x) => onChange({ [schema.key]: { ...point, x } })}
                defaultValue={0}
              />
              <NumberField
                label="Y"
                value={point.y}
                onChange={(y) => onChange({ [schema.key]: { ...point, y } })}
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
              value={value}
              onChange={(e) => onChange({ [schema.key]: Number(e.target.value) })}
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
              checked={value}
              onChange={(e) => onChange({ [schema.key]: e.target.checked })}
              className="rounded"
            />
            <label className="text-sm text-gray-300">{schema.label}</label>
          </div>
        );

      default:
        return (
          <div key={schema.key} className="text-gray-400 text-sm">
            Unsupported property type: {schema.type}
          </div>
        );
    }
  };

  return (
    <>
      {properties.map(renderProperty)}
    </>
  );
}

function AnimationSpecialProperties({ data, onChange }: { data: any; onChange: (data: any) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1">Tracks</label>
      <div className="text-xs text-gray-400">
        {data.tracks?.length || 0} animation tracks defined
      </div>
      <div className="text-xs text-blue-400 mt-2">
        Double-click the node to edit timeline
      </div>
    </div>
  );
}

function SceneSpecialProperties({ data, onChange }: { data: any; onChange: (data: any) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-white mb-3">Resolution Presets</h4>
        <div className="flex gap-2 flex-wrap">
          {RESOLUTION_PRESETS.map(preset => (
            <Button
              key={preset.label}
              onClick={() => onChange({ width: preset.width, height: preset.height })}
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