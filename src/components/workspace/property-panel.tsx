// src/components/workspace/property-panel.tsx - Registry-aware property panel
"use client";

import React, { useState } from "react";
import type { Node, Edge } from "reactflow";
import {
  NumberField,
  ColorField,
  SelectField,
  TextField,
  RangeField,
  BooleanField,
  TextareaField,
} from "@/components/ui/form-fields";
import { SelectionList } from "@/components/ui/selection";
import { Button } from "@/components/ui/button";
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
  CanvasNodeData,
} from "@/shared/types/nodes";
import type { PropertySchema } from "@/shared/types/properties";

import { BindButton } from "@/components/workspace/binding/bindings";

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
  return "duration" in data && "tracks" in data;
}

function isSceneNodeData(data: NodeData): data is SceneNodeData {
  return (
    "width" in data &&
    "height" in data &&
    "fps" in data &&
    "backgroundColor" in data
  );
}

function isFrameNodeData(data: NodeData): data is FrameNodeData {
  return (
    "width" in data && "height" in data && "format" in data && "quality" in data
  );
}

function isCanvasNodeData(data: NodeData): data is CanvasNodeData {
  return (
    "position" in data &&
    "rotation" in data &&
    "scale" in data &&
    "opacity" in data
  );
}

function isFilterNodeData(data: NodeData): data is FilterNodeData {
  return "selectedObjectIds" in data;
}

function isConstantsNodeData(data: NodeData): data is ConstantsNodeData {
  return "valueType" in data;
}

export function PropertyPanel({
  node,
  onChange,
  onDisplayNameChange,
  validateDisplayName,
  allNodes,
  allEdges,
  flowTracker,
}: PropertyPanelProps) {
  const [editingName, setEditingName] = useState(false);
  const [tempDisplayName, setTempDisplayName] = useState(
    node.data.identifier.displayName,
  );

  // Use registry to get node definition
  const nodeDefinition = getNodeDefinition(node.type!);

  if (!nodeDefinition) {
    return (
      <div className="text-sm text-gray-400">
        Unknown node type: {node.type}
      </div>
    );
  }

  // Minimal UX for Batch node: hide properties and show a simple hint
  if (node.type === "batch") {
    return (
      <div className="space-y-[var(--space-3)] text-xs text-gray-400">
        <div className="text-sm text-white">Batch</div>
        <div>Double-click the Batch node to set keys.</div>
      </div>
    );
  }

  const handleSaveDisplayName = () => {
    const success = onDisplayNameChange(
      node.data.identifier.id,
      tempDisplayName,
    );
    if (success) {
      setEditingName(false);
    }
  };

  const handleCancelEdit = () => {
    setTempDisplayName(node.data.identifier.displayName);
    setEditingName(false);
  };

  const currentError = editingName
    ? validateDisplayName(tempDisplayName, node.data.identifier.id)
    : null;

  return (
    <div className="space-y-[var(--space-4)]">
      {/* Node Identification Section */}
      <div className="space-y-[var(--space-3)] border-b border-gray-600 pb-[var(--space-4)]">
        <div>
          {editingName ? (
            <div className="space-y-[var(--space-2)]">
              <TextField
                label="Node Name"
                value={tempDisplayName}
                onChange={setTempDisplayName}
                placeholder="Enter node name"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !currentError) {
                    handleSaveDisplayName();
                  } else if (e.key === "Escape") {
                    handleCancelEdit();
                  }
                }}
                autoFocus
              />
              {currentError && (
                <div className="text-xs text-red-400">{currentError}</div>
              )}
              <div className="flex gap-[var(--space-2)]">
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
              <span className="font-medium text-white">
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

        <div className="text-xs text-gray-400">{nodeDefinition.label}</div>

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
      {nodeDefinition.execution.category === "logic" &&
        node.type === "filter" &&
        isFilterNodeData(node.data) && (
          <FilterSpecialProperties
            data={node.data}
            onChange={onChange}
            allNodes={allNodes}
            allEdges={allEdges}
            flowTracker={flowTracker}
            nodeId={node.data.identifier.id}
          />
        )}

      {nodeDefinition.execution.category === "animation" &&
        isAnimationNodeData(node.data) && (
          <AnimationSpecialProperties data={node.data} onChange={onChange} />
        )}

      {nodeDefinition.execution.category === "output" &&
        isSceneNodeData(node.data) && (
          <SceneSpecialProperties data={node.data} onChange={onChange} />
        )}

      {nodeDefinition.execution.category === "output" &&
        isFrameNodeData(node.data) && (
          <div className="space-y-[var(--space-2)] text-xs text-gray-400">
            <div>
              Image output will be rendered as {node.data.format.toUpperCase()}.
            </div>
          </div>
        )}

      {nodeDefinition.execution.category === "animation" &&
        isCanvasNodeData(node.data) && (
          <div className="space-y-[var(--space-2)] text-xs text-gray-400">
            <div>
              Double-click the Canvas node to edit in its dedicated tab.
            </div>
          </div>
        )}

      {/* Typography special handling */}
      {node.type === "typography" && (
        <div className="space-y-[var(--space-2)] text-xs text-gray-400">
          <div>
            Double-click the Typography node to edit typography in its dedicated
            tab.
          </div>
        </div>
      )}

      {/* Media special handling */}
      {node.type === "media" && (
        <div className="space-y-[var(--space-2)] text-xs text-gray-400">
          <div>
            Double-click the Media node to edit media in its dedicated tab.
          </div>
        </div>
      )}

      {/* Image special handling - only show asset selection */}
      {node.type === "image" && (
        <div className="space-y-[var(--space-4)]">
          <div className="space-y-[var(--space-2)]">
            <label className="block text-sm font-medium text-gray-300">
              Image Asset
            </label>
            <div className="text-xs text-gray-400">
              Select an image from your assets. Transform properties (position,
              scale, rotation, opacity) are controlled in the animation system.
            </div>
          </div>
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
  nodeType,
}: SchemaBasedProps) {
  // Skip rendering properties for nodes with dedicated editor tabs - they should only be edited in the dedicated tab
  if (
    nodeType === "canvas" ||
    nodeType === "typography" ||
    nodeType === "image" ||
    nodeType === "media"
  ) {
    return null;
  }

  const renderProperty = (schema: PropertySchema) => {
    const value =
      (data as unknown as Record<string, unknown>)[schema.key] ??
      schema.defaultValue;

    // Special handling for Constants node - conditional property display
    if (nodeType === "constants" && isConstantsNodeData(data)) {
      // Only show value properties that match the current valueType
      if (schema.key === "numberValue" && data.valueType !== "number")
        return null;
      if (schema.key === "stringValue" && data.valueType !== "string")
        return null;
      if (schema.key === "booleanValue" && data.valueType !== "boolean")
        return null;
      if (schema.key === "colorValue" && data.valueType !== "color")
        return null;
    }

    // Only nodes that support variableBindings get the bind adornment (animation, canvas)
    const supportsBinding =
      nodeType === "animation" ||
      nodeType === "canvas" ||
      nodeType === "typography";
    const nodeId = data.identifier.id;

    switch (schema.type) {
      case "number":
        return (
          <NumberField
            key={schema.key}
            label={schema.label}
            value={value as number}
            onChange={(newValue) =>
              onChange({ [schema.key]: newValue } as Partial<NodeData>)
            }
            min={schema.min}
            max={schema.max}
            step={schema.step}
            defaultValue={schema.defaultValue}
            bindAdornment={
              supportsBinding && nodeId ? (
                <BindButton nodeId={nodeId} bindingKey={schema.key} />
              ) : undefined
            }
          />
        );

      case "color":
        return (
          <ColorField
            key={schema.key}
            label={schema.label}
            value={value as string}
            onChange={(newValue) =>
              onChange({ [schema.key]: newValue } as Partial<NodeData>)
            }
            bindAdornment={
              supportsBinding && nodeId ? (
                <BindButton nodeId={nodeId} bindingKey={schema.key} />
              ) : undefined
            }
          />
        );

      case "select":
        return (
          <SelectField
            key={schema.key}
            label={schema.label}
            value={String(value as string | number)}
            onChange={(newValue) => {
              const shouldBeNumber =
                typeof (data as unknown as Record<string, unknown>)[
                  schema.key
                ] === "number" ||
                typeof (schema as { defaultValue?: unknown }).defaultValue ===
                  "number";
              const casted = shouldBeNumber ? Number(newValue) : newValue;
              onChange({ [schema.key]: casted } as Partial<NodeData>);
            }}
            options={schema.options}
          />
        );

      case "point2d":
        const point = (value as { x: number; y: number }) ?? { x: 0, y: 0 };
        return (
          <div key={schema.key} className="space-y-[var(--space-2)]">
            <label className="block text-sm font-medium text-gray-300">
              {schema.label}
            </label>
            <div className="grid grid-cols-2 gap-[var(--space-2)]">
              <NumberField
                label="X"
                value={point.x}
                onChange={(x) =>
                  onChange({
                    [schema.key]: { ...point, x },
                  } as Partial<NodeData>)
                }
                defaultValue={0}
                bindAdornment={
                  supportsBinding && nodeId ? (
                    <BindButton
                      nodeId={nodeId}
                      bindingKey={`${schema.key}.x`}
                    />
                  ) : undefined
                }
              />
              <NumberField
                label="Y"
                value={point.y}
                onChange={(y) =>
                  onChange({
                    [schema.key]: { ...point, y },
                  } as Partial<NodeData>)
                }
                defaultValue={0}
                bindAdornment={
                  supportsBinding && nodeId ? (
                    <BindButton
                      nodeId={nodeId}
                      bindingKey={`${schema.key}.y`}
                    />
                  ) : undefined
                }
              />
            </div>
          </div>
        );

      case "range":
        return (
          <RangeField
            key={schema.key}
            label={schema.label}
            value={value as number}
            onChange={(newValue) =>
              onChange({ [schema.key]: newValue } as Partial<NodeData>)
            }
            min={schema.min}
            max={schema.max}
            step={schema.step}
          />
        );

      case "boolean":
        return (
          <BooleanField
            key={schema.key}
            label={schema.label}
            value={value as boolean}
            onChange={(newValue) =>
              onChange({ [schema.key]: newValue } as Partial<NodeData>)
            }
          />
        );

      case "string":
        return (
          <TextField
            key={schema.key}
            label={schema.label}
            value={(value as string) || ""}
            onChange={(newValue) =>
              onChange({ [schema.key]: newValue } as Partial<NodeData>)
            }
            placeholder={`Enter ${schema.label.toLowerCase()}`}
          />
        );

      case "textarea":
        return (
          <TextareaField
            key={schema.key}
            label={schema.label}
            value={(value as string) || ""}
            onChange={(newValue) =>
              onChange({ [schema.key]: newValue } as Partial<NodeData>)
            }
            placeholder={`Enter ${schema.label.toLowerCase()}`}
            rows={schema.rows}
            bindAdornment={
              supportsBinding && nodeId ? (
                <BindButton nodeId={nodeId} bindingKey={schema.key} />
              ) : undefined
            }
          />
        );

      default:
        return (
          <div
            key={(schema as { key?: string }).key ?? "unsupported"}
            className="text-sm text-gray-400"
          >
            Unsupported property type:{" "}
            {(schema as { type?: string }).type ?? "unknown"}
          </div>
        );
    }
  };

  return <>{properties.map(renderProperty).filter(Boolean)}</>;
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
  nodeId,
}: FilterSpecialProps) {
  // NEW: Use enhanced object detection for filter node
  const upstreamObjects = React.useMemo(() => {
    // Get actual objects including duplicates
    const objectDescriptors = flowTracker.getUpstreamObjects(
      nodeId,
      allNodes,
      allEdges,
    );

    // Convert to format expected by SelectionList
    return objectDescriptors.map((obj) => ({
      data: {
        identifier: {
          id: obj.id,
          displayName: obj.displayName,
          type: obj.type,
        },
      },
      type: obj.type,
    }));
  }, [nodeId, allNodes, allEdges, flowTracker]);

  // Log for debugging
  React.useEffect(() => {
    console.log(
      `[Filter] Detected ${upstreamObjects.length} objects for filter node ${nodeId}:`,
      upstreamObjects.map((o) => ({
        id: o.data.identifier.id,
        name: o.data.identifier.displayName,
        type: o.data.identifier.type,
      })),
    );
  }, [upstreamObjects, nodeId]);

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
    onChange({
      selectedObjectIds: upstreamObjects.map((obj) => obj.data.identifier.id),
    });
  };

  const handleSelectNone = () => {
    onChange({ selectedObjectIds: [] });
  };

  return (
    <div className="space-y-[var(--space-4)]">
      <div>
        <div className="mb-[var(--space-3)]">
          <label className="mb-[var(--space-2)] block text-sm font-medium text-gray-300">
            Object Selection
          </label>
          <SelectionList
            mode="multi"
            items={upstreamObjects.map((obj) => ({
              id: obj.data.identifier.id,
              label: obj.data.identifier.displayName,
              icon: getNodeDefinition(obj.type)?.rendering.icon,
              color:
                "color" in obj.data
                  ? (obj.data as { color?: string }).color
                  : undefined,
            }))}
            selectedIds={data.selectedObjectIds}
            onToggle={handleToggleObject}
            onSelectAll={handleSelectAll}
            onSelectNone={handleSelectNone}
            emptyLabel="No upstream objects available. Connect geometry nodes to see filtering options."
          />
        </div>

        <div className="mt-[var(--space-2)] flex items-center justify-between text-xs text-gray-400">
          <span>Selected: {data.selectedObjectIds.length}</span>
          <span>Available: {upstreamObjects.length}</span>
        </div>

        {/* NEW: Debug info */}
        <div className="mt-[var(--space-1)] border-t border-[var(--border-primary)] pt-[var(--space-2)] text-xs text-[var(--text-tertiary)]">
          Including duplicated objects from upstream duplicate nodes
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
      <label className="mb-[var(--space-1)] block text-sm font-medium text-gray-300">
        Tracks
      </label>
      <div className="text-xs text-gray-400">
        {data.tracks?.length ?? 0} animation tracks defined
      </div>
      <div className="mt-[var(--space-2)] text-xs text-blue-400">
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
    <div className="space-y-[var(--space-4)]">
      <div>
        <h4 className="mb-[var(--space-3)] text-sm font-semibold text-white">
          Resolution Presets
        </h4>
        <div className="flex flex-wrap gap-[var(--space-2)]">
          {RESOLUTION_PRESETS.map((preset) => (
            <Button
              key={preset.label}
              onClick={() =>
                onChange({
                  width: preset.width,
                  height: preset.height,
                } as Partial<NodeData>)
              }
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

// Canvas per-object editing has moved into the dedicated Canvas editor tab
