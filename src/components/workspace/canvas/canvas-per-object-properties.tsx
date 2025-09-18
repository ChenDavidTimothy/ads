import React, { useMemo } from 'react';
import type { Node } from 'reactflow';

import { NumberField, ColorField } from '@/components/ui/form-fields';
import { BindingAndBatchControls } from '@/components/workspace/batch/BindingAndBatchControls';
import { useWorkspace } from '@/components/workspace/workspace-context';
import { FlowTracker } from '@/lib/flow/flow-tracking';
import { getResolverFieldPath } from '@/shared/properties/field-paths';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { CanvasNodeData } from '@/shared/types/nodes';
import type { PerObjectAssignments } from '@/shared/properties/assignments';

import { CanvasBindingBadge, CanvasOverrideBadge } from './canvas-badges';

export function CanvasPerObjectProperties({
  nodeId,
  objectId,
  assignments,
  onChange,
}: {
  nodeId: string;
  objectId: string;
  assignments: PerObjectAssignments;
  onChange: (updates: Record<string, unknown>) => void;
}) {
  const { state } = useWorkspace();

  // EXISTING: All data resolution unchanged
  const node = state.flow.nodes.find((n) => n.data?.identifier?.id === nodeId) as
    | Node<CanvasNodeData>
    | undefined;
  const selectedOverrides = assignments[objectId];
  const initial = (selectedOverrides?.initial ?? {}) as Record<string, unknown> & {
    position?: { x: number; y: number };
    scale?: { x: number; y: number };
    rotation?: number;
    opacity?: number;
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
  };

  // ADD: Get object type for conditional rendering
  const objectType = useMemo(() => {
    const tracker = new FlowTracker();
    const objectDescriptors = tracker.getUpstreamObjects(
      nodeId,
      state.flow.nodes,
      state.flow.edges
    );
    const objectDescriptor = objectDescriptors.find((obj) => obj.id === objectId);
    return objectDescriptor?.type;
  }, [nodeId, objectId, state.flow.nodes, state.flow.edges]);

  const isTextObject = objectType === 'text';

  // EXISTING: All other resolution logic unchanged
  const def =
    (getNodeDefinition('canvas')?.defaults as Record<string, unknown> & {
      position?: { x: number; y: number };
      scale?: { x: number; y: number };
      rotation?: number;
      opacity?: number;
      fillColor?: string;
      strokeColor?: string;
      strokeWidth?: number;
    }) ?? {};
  const base = (node?.data ?? {}) as Record<string, unknown> & {
    position?: { x: number; y: number };
    scale?: { x: number; y: number };
    rotation?: number;
    opacity?: number;
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
  };

  const isBound = (key: string) => {
    const vbAll = node?.data?.variableBindingsByObject ?? {};
    return !!vbAll?.[objectId]?.[key]?.boundResultNodeId;
  };
  // Removed unused isInheritedBound function
  const isOverridden = (key: string) => {
    switch (key) {
      case 'position.x':
        return initial.position?.x !== undefined;
      case 'position.y':
        return initial.position?.y !== undefined;
      case 'scale.x':
        return initial.scale?.x !== undefined;
      case 'scale.y':
        return initial.scale?.y !== undefined;
      case 'rotation':
        return initial.rotation !== undefined;
      case 'opacity':
        return initial.opacity !== undefined;
      case 'fillColor':
        return initial.fillColor !== undefined;
      case 'strokeColor':
        return initial.strokeColor !== undefined;
      case 'strokeWidth':
        return initial.strokeWidth !== undefined;
      default:
        return false;
    }
  };
  const leftBorderClass = (key: string) =>
    isBound(key)
      ? 'border-l-2 border-[var(--accent-secondary)]'
      : isOverridden(key)
        ? 'border-l-2 border-[var(--warning-600)]'
        : '';

  // Helper to get value for bound fields - proper precedence like geometry nodes
  const getValue = (key: string, fallbackValue: number | string) => {
    // Check per-object binding first (highest priority)
    if (isBound(key)) return undefined; // Blank when bound (like geometry nodes)

    // Check manual override second (if not bound) - this is the key fix
    switch (key) {
      case 'position.x':
        return initial.position?.x ?? base.position?.x ?? def.position?.x ?? fallbackValue;
      case 'position.y':
        return initial.position?.y ?? base.position?.y ?? def.position?.y ?? fallbackValue;
      case 'scale.x':
        return initial.scale?.x ?? base.scale?.x ?? def.scale?.x ?? fallbackValue;
      case 'scale.y':
        return initial.scale?.y ?? base.scale?.y ?? def.scale?.y ?? fallbackValue;
      case 'rotation':
        return initial.rotation ?? base.rotation ?? def.rotation ?? fallbackValue;
      case 'opacity':
        return initial.opacity ?? base.opacity ?? def.opacity ?? fallbackValue;
      case 'fillColor':
        return initial.fillColor ?? base.fillColor ?? def.fillColor ?? fallbackValue;
      case 'strokeColor':
        return initial.strokeColor ?? base.strokeColor ?? def.strokeColor ?? fallbackValue;
      case 'strokeWidth':
        return initial.strokeWidth ?? base.strokeWidth ?? def.strokeWidth ?? fallbackValue;
      default:
        return fallbackValue;
    }
  };

  // Helper to get string value for color fields - proper precedence like geometry nodes
  const getStringValue = (key: string, fallbackValue: string) => {
    // Check per-object binding first (highest priority)
    if (isBound(key)) return ''; // Empty string when bound (like geometry nodes)

    // Check manual override second (if not bound) - this is the key fix
    switch (key) {
      case 'fillColor':
        return initial.fillColor ?? base.fillColor ?? def.fillColor ?? fallbackValue;
      case 'strokeColor':
        return initial.strokeColor ?? base.strokeColor ?? def.strokeColor ?? fallbackValue;
      default:
        return fallbackValue;
    }
  };

  return (
    <div className="space-y-[var(--space-3)]">
      <div className="grid grid-cols-2 gap-[var(--space-2)]">
        <div>
          <label className="block text-xs text-[var(--text-tertiary)]">Position X</label>
          <NumberField
            label=""
            value={getValue('position.x', 0)}
            onChange={(x) => onChange({ position: { x } })}
            defaultValue={0}
            bindAdornment={
              <BindingAndBatchControls
                bindProps={{ nodeId, bindingKey: 'position.x', objectId }}
                batchProps={{
                  nodeId,
                  fieldPath: getResolverFieldPath('canvas', 'position.x')!,
                  objectId,
                  valueType: 'number',
                }}
              />
            }
            disabled={isBound('position.x')}
            inputClassName={leftBorderClass('position.x')}
          />
          {/* Badge - Only show when overridden or bound */}
          {(isOverridden('position.x') || isBound('position.x')) && (
            <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
              <div className="flex items-center gap-[var(--space-1)]">
                {isOverridden('position.x') && !isBound('position.x') && (
                  <CanvasOverrideBadge nodeId={nodeId} keyName="position.x" objectId={objectId} />
                )}
                {isBound('position.x') && (
                  <CanvasBindingBadge nodeId={nodeId} keyName="position.x" objectId={objectId} />
                )}
              </div>
            </div>
          )}
        </div>
        <div>
          <label className="block text-xs text-[var(--text-tertiary)]">Position Y</label>
          <NumberField
            label=""
            value={getValue('position.y', 0)}
            onChange={(y) => onChange({ position: { y } })}
            defaultValue={0}
            bindAdornment={
              <BindingAndBatchControls
                bindProps={{ nodeId, bindingKey: 'position.y', objectId }}
                batchProps={{
                  nodeId,
                  fieldPath: getResolverFieldPath('canvas', 'position.y')!,
                  objectId,
                  valueType: 'number',
                }}
              />
            }
            disabled={isBound('position.y')}
            inputClassName={leftBorderClass('position.y')}
          />
          {/* Badge - Only show when overridden or bound */}
          {(isOverridden('position.y') || isBound('position.y')) && (
            <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
              <div className="flex items-center gap-[var(--space-1)]">
                {isOverridden('position.y') && !isBound('position.y') && (
                  <CanvasOverrideBadge nodeId={nodeId} keyName="position.y" objectId={objectId} />
                )}
                {isBound('position.y') && (
                  <CanvasBindingBadge nodeId={nodeId} keyName="position.y" objectId={objectId} />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-[var(--space-2)]">
        <div>
          <label className="block text-xs text-[var(--text-tertiary)]">Scale X</label>
          <NumberField
            label=""
            value={getValue('scale.x', 1)}
            onChange={(x) => onChange({ scale: { x } })}
            defaultValue={1}
            min={0}
            step={0.1}
            bindAdornment={
              <BindingAndBatchControls
                bindProps={{ nodeId, bindingKey: 'scale.x', objectId }}
                batchProps={{
                  nodeId,
                  fieldPath: getResolverFieldPath('canvas', 'scale.x')!,
                  objectId,
                  valueType: 'number',
                }}
              />
            }
            disabled={isBound('scale.x')}
            inputClassName={leftBorderClass('scale.x')}
          />
          {/* Badge - Only show when overridden or bound */}
          {(isOverridden('scale.x') || isBound('scale.x')) && (
            <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
              <div className="flex items-center gap-[var(--space-1)]">
                {isOverridden('scale.x') && !isBound('scale.x') && (
                  <CanvasOverrideBadge nodeId={nodeId} keyName="scale.x" objectId={objectId} />
                )}
                {isBound('scale.x') && (
                  <CanvasBindingBadge nodeId={nodeId} keyName="scale.x" objectId={objectId} />
                )}
              </div>
            </div>
          )}
        </div>
        <div>
          <label className="block text-xs text-[var(--text-tertiary)]">Scale Y</label>
          <NumberField
            label=""
            value={getValue('scale.y', 1)}
            onChange={(y) => onChange({ scale: { y } })}
            defaultValue={1}
            min={0}
            step={0.1}
            bindAdornment={
              <BindingAndBatchControls
                bindProps={{ nodeId, bindingKey: 'scale.y', objectId }}
                batchProps={{
                  nodeId,
                  fieldPath: getResolverFieldPath('canvas', 'scale.y')!,
                  objectId,
                  valueType: 'number',
                }}
              />
            }
            disabled={isBound('scale.y')}
            inputClassName={leftBorderClass('scale.y')}
          />
          {/* Badge - Only show when overridden or bound */}
          {(isOverridden('scale.y') || isBound('scale.y')) && (
            <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
              <div className="flex items-center gap-[var(--space-1)]">
                {isOverridden('scale.y') && !isBound('scale.y') && (
                  <CanvasOverrideBadge nodeId={nodeId} keyName="scale.y" objectId={objectId} />
                )}
                {isBound('scale.y') && (
                  <CanvasBindingBadge nodeId={nodeId} keyName="scale.y" objectId={objectId} />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-[var(--space-2)]">
        <div>
          <label className="block text-xs text-[var(--text-tertiary)]">Rotation</label>
          <NumberField
            label=""
            value={getValue('rotation', 0)}
            onChange={(rotation) => onChange({ rotation })}
            step={0.1}
            defaultValue={0}
            bindAdornment={
              <BindingAndBatchControls
                bindProps={{ nodeId, bindingKey: 'rotation', objectId }}
                batchProps={{
                  nodeId,
                  fieldPath: getResolverFieldPath('canvas', 'rotation')!,
                  objectId,
                  valueType: 'number',
                }}
              />
            }
            disabled={isBound('rotation')}
            inputClassName={leftBorderClass('rotation')}
          />
          {/* Badge - Only show when overridden or bound */}
          {(isOverridden('rotation') || isBound('rotation')) && (
            <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
              <div className="flex items-center gap-[var(--space-1)]">
                {isOverridden('rotation') && !isBound('rotation') && (
                  <CanvasOverrideBadge nodeId={nodeId} keyName="rotation" objectId={objectId} />
                )}
                {isBound('rotation') && (
                  <CanvasBindingBadge nodeId={nodeId} keyName="rotation" objectId={objectId} />
                )}
              </div>
            </div>
          )}
        </div>
        <div>
          <label className="block text-xs text-[var(--text-tertiary)]">Opacity</label>
          <NumberField
            label=""
            value={getValue('opacity', 1)}
            onChange={(opacity) => onChange({ opacity })}
            min={0}
            max={1}
            step={0.05}
            defaultValue={1}
            bindAdornment={
              <BindingAndBatchControls
                bindProps={{ nodeId, bindingKey: 'opacity', objectId }}
                batchProps={{
                  nodeId,
                  fieldPath: getResolverFieldPath('canvas', 'opacity')!,
                  objectId,
                  valueType: 'number',
                }}
              />
            }
            disabled={isBound('opacity')}
            inputClassName={leftBorderClass('opacity')}
          />
          {/* Badge - Only show when overridden or bound */}
          {(isOverridden('opacity') || isBound('opacity')) && (
            <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
              <div className="flex items-center gap-[var(--space-1)]">
                {isOverridden('opacity') && !isBound('opacity') && (
                  <CanvasOverrideBadge nodeId={nodeId} keyName="opacity" objectId={objectId} />
                )}
                {isBound('opacity') && (
                  <CanvasBindingBadge nodeId={nodeId} keyName="opacity" objectId={objectId} />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CHANGE: Conditional color section rendering */}
      {!isTextObject && (
        <>
          <div className="grid grid-cols-3 items-end gap-[var(--space-2)]">
            <div>
              <ColorField
                label="Fill"
                value={getStringValue('fillColor', '')}
                onChange={(fillColor) => onChange({ fillColor })}
                bindAdornment={
                  <BindingAndBatchControls
                    bindProps={{ nodeId, bindingKey: 'fillColor', objectId }}
                    batchProps={{
                      nodeId,
                      fieldPath: getResolverFieldPath('canvas', 'fillColor')!,
                      objectId,
                      valueType: 'string',
                    }}
                  />
                }
                disabled={isBound('fillColor')}
                inputClassName={leftBorderClass('fillColor')}
              />
              {/* Badge - Only show when overridden or bound */}
              {(isOverridden('fillColor') || isBound('fillColor')) && (
                <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                  <div className="flex items-center gap-[var(--space-1)]">
                    {isOverridden('fillColor') && !isBound('fillColor') && (
                      <CanvasOverrideBadge nodeId={nodeId} keyName="fillColor" objectId={objectId} />
                    )}
                    {isBound('fillColor') && (
                      <CanvasBindingBadge nodeId={nodeId} keyName="fillColor" objectId={objectId} />
                    )}
                  </div>
                </div>
              )}
            </div>
            <div>
              <ColorField
                label="Stroke"
                value={getStringValue('strokeColor', '')}
                onChange={(strokeColor) => onChange({ strokeColor })}
                bindAdornment={
                  <BindingAndBatchControls
                    bindProps={{ nodeId, bindingKey: 'strokeColor', objectId }}
                    batchProps={{
                      nodeId,
                      fieldPath: getResolverFieldPath('canvas', 'strokeColor')!,
                      objectId,
                      valueType: 'string',
                    }}
                  />
                }
                disabled={isBound('strokeColor')}
                inputClassName={leftBorderClass('strokeColor')}
              />
              {/* Badge - Only show when overridden or bound */}
              {(isOverridden('strokeColor') || isBound('strokeColor')) && (
                <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                  <div className="flex items-center gap-[var(--space-1)]">
                    {isOverridden('strokeColor') && !isBound('strokeColor') && (
                      <CanvasOverrideBadge nodeId={nodeId} keyName="strokeColor" objectId={objectId} />
                    )}
                    {isBound('strokeColor') && (
                      <CanvasBindingBadge
                        nodeId={nodeId}
                        keyName="strokeColor"
                        objectId={objectId}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
            <div>
              <NumberField
                label="Stroke W"
                value={getValue('strokeWidth', 1)}
                onChange={(strokeWidth) => onChange({ strokeWidth })}
                min={0}
                step={0.5}
                defaultValue={1}
                bindAdornment={
                  <BindingAndBatchControls
                    bindProps={{ nodeId, bindingKey: 'strokeWidth', objectId }}
                    batchProps={{
                      nodeId,
                      fieldPath: getResolverFieldPath('canvas', 'strokeWidth')!,
                      objectId,
                      valueType: 'number',
                    }}
                  />
                }
                disabled={isBound('strokeWidth')}
                inputClassName={leftBorderClass('strokeWidth')}
              />
              {/* Badge - Only show when overridden or bound */}
              {(isOverridden('strokeWidth') || isBound('strokeWidth')) && (
                <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                  <div className="flex items-center gap-[var(--space-1)]">
                    {isOverridden('strokeWidth') && !isBound('strokeWidth') && (
                      <CanvasOverrideBadge nodeId={nodeId} keyName="strokeWidth" objectId={objectId} />
                    )}
                    {isBound('strokeWidth') && (
                      <CanvasBindingBadge
                        nodeId={nodeId}
                        keyName="strokeWidth"
                        objectId={objectId}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ADD: Message for text objects */}
      {isTextObject && (
        <div className="rounded border border-[var(--border-primary)] bg-[var(--surface-2)] p-3 text-xs text-[var(--text-tertiary)]">
          <div className="mb-1 font-medium">Color properties disabled for text</div>
          <div>Use Typography node for text color and stroke styling</div>
        </div>
      )}
    </div>
  );
}
