// src/components/editor/property-panel.tsx - River flow aware property panel
"use client";

import type { Node, Edge } from "reactflow";
import { NumberField, ColorField, SelectField } from "@/components/ui/form-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getNodeDefinition } from "@/lib/types/node-definitions";
import { RESOLUTION_PRESETS } from "@/lib/constants/editor";
import type { PathFilter } from "@/lib/types/ports";
import type { 
  NodeData, 
  AnimationNodeData, 
  SceneNodeData 
} from "@/lib/types/nodes";
import type { PropertySchema } from "@/lib/types/property-schemas";

interface NodePropertyPanelProps {
  node: Node<NodeData>;
  onChange: (data: Partial<NodeData>) => void;
}

interface EdgePropertyPanelProps {
  edge: Edge & { pathFilter?: PathFilter };
  nodes: Node<NodeData>[];
  edges: Edge[];
  onChange: (pathFilter: PathFilter) => void;
}

type PropertyPanelProps = NodePropertyPanelProps | EdgePropertyPanelProps;

function isNodePropertyPanel(props: PropertyPanelProps): props is NodePropertyPanelProps {
  return 'node' in props;
}

export function PropertyPanel(props: PropertyPanelProps) {
  if (isNodePropertyPanel(props)) {
    return <NodePropertyPanel {...props} />;
  } else {
    return <EdgePropertyPanel {...props} />;
  }
}

function NodePropertyPanel({ node, onChange }: NodePropertyPanelProps) {
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
      
      {node.type === 'animation' && (
        <AnimationSpecialProperties 
          data={node.data as AnimationNodeData} 
          onChange={onChange} 
        />
      )}
      
      {node.type === 'scene' && (
        <SceneSpecialProperties 
          data={node.data as SceneNodeData} 
          onChange={onChange} 
        />
      )}
    </div>
  );
}

function EdgePropertyPanel({ edge, nodes, edges, onChange }: EdgePropertyPanelProps) {
  const sourceNode = nodes.find(n => n.id === edge.source);
  const targetNode = nodes.find(n => n.id === edge.target);
  
  if (!sourceNode || !targetNode) {
    return (
      <div className="text-gray-400 text-sm">
        Invalid connection
      </div>
    );
  }

  const pathFilter = edge.pathFilter || { selectedObjectIds: [], filterEnabled: false };
  
  // Get available objects using river flow tracing
  const availableObjects = getAvailableObjectsForRiverFlow(
    sourceNode, 
    nodes, 
    edges, 
    edge.id
  );
  
  const handleFilterToggle = () => {
    onChange({
      ...pathFilter,
      filterEnabled: !pathFilter.filterEnabled
    });
  };

  const handleObjectSelection = (objectId: string, selected: boolean) => {
    const newSelectedIds = selected
      ? [...pathFilter.selectedObjectIds, objectId]
      : pathFilter.selectedObjectIds.filter(id => id !== objectId);
    
    onChange({
      ...pathFilter,
      selectedObjectIds: newSelectedIds
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-white mb-2">Connection Info</h4>
        <div className="text-xs text-gray-300 space-y-1">
          <div>From: {getNodeDisplayName(sourceNode)}</div>
          <div>To: {getNodeDisplayName(targetNode)}</div>
          <div>Port: {edge.sourceHandle} → {edge.targetHandle}</div>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-white mb-2">River Flow Control</h4>
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={pathFilter.filterEnabled}
              onChange={handleFilterToggle}
              className="rounded"
            />
            <label className="text-sm text-gray-300">
              Enable path filtering
            </label>
          </div>

          {pathFilter.filterEnabled && (
            <div className="space-y-2">
              <div className="text-xs text-gray-400">
                Select objects to flow through this path:
              </div>
              {availableObjects.length > 0 ? (
                availableObjects.map((obj) => (
                  <div key={obj.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={pathFilter.selectedObjectIds.includes(obj.id)}
                      onChange={(e) => handleObjectSelection(obj.id, e.target.checked)}
                      disabled={obj.claimed}
                      className="rounded"
                    />
                    <label className={`text-sm ${obj.claimed ? 'text-gray-500' : 'text-gray-300'}`}>
                      {obj.name}
                      {obj.claimed && <span className="ml-2 text-xs">(claimed by other path)</span>}
                    </label>
                  </div>
                ))
              ) : (
                <div className="text-xs text-gray-500">
                  No objects available from source
                </div>
              )}
            </div>
          )}

          {!pathFilter.filterEnabled && (
            <div className="text-xs text-gray-500">
              All unclaimed objects will flow through this connection
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 p-3 bg-gray-700 rounded text-xs text-gray-300">
        <div className="font-medium mb-1">River Flow Rules:</div>
        <div>• Objects can only flow down one path per branch</div>
        <div>• Claimed objects are automatically excluded from parallel paths</div>
        <div>• Downstream paths only see objects from upstream selections</div>
        <div>• Filtering is computed automatically during execution</div>
      </div>
    </div>
  );
}

// River flow object tracing
function getAvailableObjectsForRiverFlow(
  sourceNode: Node<NodeData>, 
  allNodes: Node<NodeData>[], 
  allEdges: Edge[],
  currentEdgeId: string
): Array<{ id: string; name: string; claimed: boolean }> {
  const visited = new Set<string>();
  const result: Array<{ id: string; name: string; claimed: boolean }> = [];
  
  // Find parallel paths from same source
  const parallelPaths = allEdges.filter(edge => 
    edge.source === sourceNode.id && 
    edge.sourceHandle === allEdges.find(e => e.id === currentEdgeId)?.sourceHandle &&
    edge.id !== currentEdgeId
  );
  
  // Get objects claimed by parallel paths
  const claimedObjects = new Set<string>();
  for (const parallelEdge of parallelPaths) {
    const filteredEdge = parallelEdge as Edge & { pathFilter?: PathFilter };
    if (filteredEdge.pathFilter?.filterEnabled && filteredEdge.pathFilter.selectedObjectIds.length > 0) {
      filteredEdge.pathFilter.selectedObjectIds.forEach(id => claimedObjects.add(id));
    }
  }
  
  function traceObjects(nodeId: string): Array<{ id: string; name: string }> {
    if (visited.has(nodeId)) return [];
    visited.add(nodeId);
    
    const node = allNodes.find(n => n.id === nodeId);
    if (!node) return [];
    
    // Geometry nodes create objects
    if (['triangle', 'circle', 'rectangle'].includes(node.type!)) {
      const userData = node.data as Record<string, unknown>;
      return [{
        id: node.id,
        name: (userData.objectName as string) || (userData.userDefinedName as string) || `${node.type} Object`
      }];
    }
    
    // Other nodes pass through objects from their inputs
    const incomingEdges = allEdges.filter(edge => edge.target === nodeId);
    const foundObjects: Array<{ id: string; name: string }> = [];
    
    for (const edge of incomingEdges) {
      foundObjects.push(...traceObjects(edge.source));
    }
    
    return foundObjects;
  }
  
  const availableObjects = traceObjects(sourceNode.id);
  
  return availableObjects.map(obj => ({
    ...obj,
    claimed: claimedObjects.has(obj.id)
  }));
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
      case 'string':
        return (
          <div key={schema.key} className="space-y-1">
            <label className="block text-sm font-medium text-gray-300">
              {schema.label}
            </label>
            <Input
              type="text"
              value={value as string || ''}
              onChange={(e) => onChange({ [schema.key]: e.target.value } as Partial<NodeData>)}
              placeholder={schema.defaultValue as string}
            />
          </div>
        );

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

function SceneSpecialProperties({ data, onChange }: SceneSpecialProps) {
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

function getNodeDisplayName(node: Node<NodeData>): string {
  const userData = node.data as Record<string, unknown>;
  return (userData.userDefinedName as string) || 
         `${node.type?.charAt(0).toUpperCase()}${node.type?.slice(1)}`;
}