import React, { useMemo } from 'react';
import type { Node } from 'reactflow';

import { NumberField, ColorField } from '@/components/ui/form-fields';
import { BindingAndBatchControls } from '@/components/workspace/batch/BindingAndBatchControls';
import { useWorkspace } from '@/components/workspace/workspace-context';
import { FlowTracker } from '@/lib/flow/flow-tracking';
import { getResolverFieldPath } from '@/shared/properties/field-paths';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { CanvasNodeData } from '@/shared/types/nodes';

import { CanvasBindingBadge } from './canvas-badges';

export function CanvasDefaultProperties({ nodeId }: { nodeId: string }) {
  const { state, updateFlow } = useWorkspace();
  const node = state.flow.nodes.find((n) => n.data?.identifier?.id === nodeId) as
    | Node<CanvasNodeData>
    | undefined;

  // EXISTING: All data resolution code unchanged
  const data = (node?.data ?? {}) as Record<string, unknown> & {
    position?: { x: number; y: number };
    scale?: { x: number; y: number };
    rotation?: number;
    opacity?: number;
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
    variableBindings?: Record<string, { target?: string; boundResultNodeId?: string }>;
  };
  const bindings = (data.variableBindings ?? {}) as Record<
    string,
    { target?: string; boundResultNodeId?: string }
  >;

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

  // EXISTING: All value resolution unchanged
  const posX = data.position?.x ?? def.position?.x ?? 0;
  const posY = data.position?.y ?? def.position?.y ?? 0;
  const scaleX = data.scale?.x ?? def.scale?.x ?? 1;
  const scaleY = data.scale?.y ?? def.scale?.y ?? 1;
  const rotation = data.rotation ?? def.rotation ?? 0;
  const opacity = data.opacity ?? def.opacity ?? 1;
  const fillColor = data.fillColor ?? def.fillColor ?? '';
  const strokeColor = data.strokeColor ?? def.strokeColor ?? '';
  const strokeWidth = data.strokeWidth ?? def.strokeWidth ?? 1;

  // ADD: Type detection for conditional rendering
  const upstreamObjectTypes = useMemo(() => {
    const tracker = new FlowTracker();
    const objectDescriptors = tracker.getUpstreamObjects(
      nodeId,
      state.flow.nodes,
      state.flow.edges
    );
    return {
      allText:
        objectDescriptors.length > 0 && objectDescriptors.every((obj) => obj.type === 'text'),
      isEmpty: objectDescriptors.length === 0,
    };
  }, [nodeId, state.flow.nodes, state.flow.edges]);

  // EXISTING: All helper functions unchanged
  const isBound = (key: string) => !!bindings?.[key]?.boundResultNodeId;
  const leftBorderClass = (key: string) =>
    isBound(key) ? 'border-l-2 border-[var(--accent-secondary)]' : '';

  return (
    <div className="space-y-[var(--space-3)]">
      <div className="grid grid-cols-2 gap-[var(--space-2)]">
        <div>
          <label className="block text-xs text-[var(--text-tertiary)]">Position X</label>
          <NumberField
            label=""
            value={posX}
            onChange={(x) =>
              updateFlow({
                nodes: state.flow.nodes.map((n) =>
                  n.data?.identifier?.id !== nodeId
                    ? n
                    : {
                        ...n,
                        data: {
                          ...(n.data as CanvasNodeData),
                          position: {
                            ...(n.data as CanvasNodeData)?.position,
                            x,
                          },
                        },
                      }
                ),
              })
            }
            defaultValue={0}
            bindAdornment={
              <BindingAndBatchControls
                bindProps={{ nodeId, bindingKey: 'position.x' }}
                batchProps={{
                  nodeId,
                  fieldPath: getResolverFieldPath('canvas', 'position.x')!,
                  valueType: 'number',
                }}
              />
            }
            disabled={isBound('position.x')}
            inputClassName={leftBorderClass('position.x')}
          />
          {/* Badge - Only show when bound */}
          {isBound('position.x') && (
            <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
              <div className="flex items-center gap-[var(--space-1)]">
                <CanvasBindingBadge nodeId={nodeId} keyName="position.x" />
              </div>
            </div>
          )}
        </div>
        <div>
          <label className="block text-xs text-[var(--text-tertiary)]">Position Y</label>
          <NumberField
            label=""
            value={posY}
            onChange={(y) =>
              updateFlow({
                nodes: state.flow.nodes.map((n) =>
                  n.data?.identifier?.id !== nodeId
                    ? n
                    : {
                        ...n,
                        data: {
                          ...(n.data as CanvasNodeData),
                          position: {
                            ...(n.data as CanvasNodeData)?.position,
                            y,
                          },
                        },
                      }
                ),
              })
            }
            defaultValue={0}
            bindAdornment={
              <BindingAndBatchControls
                bindProps={{ nodeId, bindingKey: 'position.y' }}
                batchProps={{
                  nodeId,
                  fieldPath: getResolverFieldPath('canvas', 'position.y')!,
                  valueType: 'number',
                }}
              />
            }
            disabled={isBound('position.y')}
            inputClassName={leftBorderClass('position.y')}
          />
          {/* Badge - Only show when bound */}
          {isBound('position.y') && (
            <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
              <div className="flex items-center gap-[var(--space-1)]">
                <CanvasBindingBadge nodeId={nodeId} keyName="position.y" />
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
            value={scaleX}
            onChange={(x) =>
              updateFlow({
                nodes: state.flow.nodes.map((n) =>
                  n.data?.identifier?.id !== nodeId
                    ? n
                    : {
                        ...n,
                        data: {
                          ...(n.data as CanvasNodeData),
                          scale: { ...(n.data as CanvasNodeData)?.scale, x },
                        },
                      }
                ),
              })
            }
            defaultValue={1}
            min={0}
            step={0.1}
            bindAdornment={
              <BindingAndBatchControls
                bindProps={{ nodeId, bindingKey: 'scale.x' }}
                batchProps={{
                  nodeId,
                  fieldPath: getResolverFieldPath('canvas', 'scale.x')!,
                  valueType: 'number',
                }}
              />
            }
            disabled={isBound('scale.x')}
            inputClassName={leftBorderClass('scale.x')}
          />
          {/* Badge - Only show when bound */}
          {isBound('scale.x') && (
            <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
              <div className="flex items-center gap-[var(--space-1)]">
                <CanvasBindingBadge nodeId={nodeId} keyName="scale.x" />
              </div>
            </div>
          )}
        </div>
        <div>
          <label className="block text-xs text-[var(--text-tertiary)]">Scale Y</label>
          <NumberField
            label=""
            value={scaleY}
            onChange={(y) =>
              updateFlow({
                nodes: state.flow.nodes.map((n) =>
                  n.data?.identifier?.id !== nodeId
                    ? n
                    : {
                        ...n,
                        data: {
                          ...(n.data as CanvasNodeData),
                          scale: { ...(n.data as CanvasNodeData)?.scale, y },
                        },
                      }
                ),
              })
            }
            defaultValue={1}
            min={0}
            step={0.1}
            bindAdornment={
              <BindingAndBatchControls
                bindProps={{ nodeId, bindingKey: 'scale.y' }}
                batchProps={{
                  nodeId,
                  fieldPath: getResolverFieldPath('canvas', 'scale.y')!,
                  valueType: 'number',
                }}
              />
            }
            disabled={isBound('scale.y')}
            inputClassName={leftBorderClass('scale.y')}
          />
          {/* Badge - Only show when bound */}
          {isBound('scale.y') && (
            <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
              <div className="flex items-center gap-[var(--space-1)]">
                <CanvasBindingBadge nodeId={nodeId} keyName="scale.y" />
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
            value={rotation}
            onChange={(rotation) =>
              updateFlow({
                nodes: state.flow.nodes.map((n) =>
                  n.data?.identifier?.id !== nodeId ? n : { ...n, data: { ...n.data, rotation } }
                ),
              })
            }
            step={0.1}
            defaultValue={0}
            bindAdornment={
              <BindingAndBatchControls
                bindProps={{ nodeId, bindingKey: 'rotation' }}
                batchProps={{
                  nodeId,
                  fieldPath: getResolverFieldPath('canvas', 'rotation')!,
                  valueType: 'number',
                }}
              />
            }
            disabled={isBound('rotation')}
            inputClassName={leftBorderClass('rotation')}
          />
          {/* Badge - Only show when bound */}
          {isBound('rotation') && (
            <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
              <div className="flex items-center gap-[var(--space-1)]">
                <CanvasBindingBadge nodeId={nodeId} keyName="rotation" />
              </div>
            </div>
          )}
        </div>
        <div>
          <label className="block text-xs text-[var(--text-tertiary)]">Opacity</label>
          <NumberField
            label=""
            value={opacity}
            onChange={(opacity) =>
              updateFlow({
                nodes: state.flow.nodes.map((n) =>
                  n.data?.identifier?.id !== nodeId ? n : { ...n, data: { ...n.data, opacity } }
                ),
              })
            }
            min={0}
            max={1}
            step={0.05}
            defaultValue={1}
            bindAdornment={
              <BindingAndBatchControls
                bindProps={{ nodeId, bindingKey: 'opacity' }}
                batchProps={{
                  nodeId,
                  fieldPath: getResolverFieldPath('canvas', 'opacity')!,
                  valueType: 'number',
                }}
              />
            }
            disabled={isBound('opacity')}
            inputClassName={leftBorderClass('opacity')}
          />
          {/* Badge - Only show when bound */}
          {isBound('opacity') && (
            <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
              <div className="flex items-center gap-[var(--space-1)]">
                <CanvasBindingBadge nodeId={nodeId} keyName="opacity" />
              </div>
            </div>
          )}
        </div>
      </div>
      {/* CHANGE: Wrap color properties with conditional rendering */}
      {!upstreamObjectTypes.allText && (
        <>
          <div className="grid grid-cols-3 items-end gap-[var(--space-2)]">
            <div>
              <ColorField
                label="Fill"
                value={fillColor}
                onChange={(fillColor) =>
                  updateFlow({
                    nodes: state.flow.nodes.map((n) =>
                      n.data?.identifier?.id !== nodeId
                        ? n
                        : { ...n, data: { ...n.data, fillColor } }
                    ),
                  })
                }
                bindAdornment={
                  <BindingAndBatchControls
                    bindProps={{ nodeId, bindingKey: 'fillColor' }}
                    batchProps={{
                      nodeId,
                      fieldPath: getResolverFieldPath('canvas', 'fillColor')!,
                      valueType: 'string',
                    }}
                  />
                }
                disabled={isBound('fillColor')}
                inputClassName={leftBorderClass('fillColor')}
              />
              {/* Badge - Only show when bound */}
              {isBound('fillColor') && (
                <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                  <div className="flex items-center gap-[var(--space-1)]">
                    <CanvasBindingBadge nodeId={nodeId} keyName="fillColor" />
                  </div>
                </div>
              )}
            </div>
            <div>
              <ColorField
                label="Stroke"
                value={strokeColor}
                onChange={(strokeColor) =>
                  updateFlow({
                    nodes: state.flow.nodes.map((n) =>
                      n.data?.identifier?.id !== nodeId
                        ? n
                        : { ...n, data: { ...n.data, strokeColor } }
                    ),
                  })
                }
                bindAdornment={
                  <BindingAndBatchControls
                    bindProps={{ nodeId, bindingKey: 'strokeColor' }}
                    batchProps={{
                      nodeId,
                      fieldPath: getResolverFieldPath('canvas', 'strokeColor')!,
                      valueType: 'string',
                    }}
                  />
                }
                disabled={isBound('strokeColor')}
                inputClassName={leftBorderClass('strokeColor')}
              />
              {/* Badge - Only show when bound */}
              {isBound('strokeColor') && (
                <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                  <div className="flex items-center gap-[var(--space-1)]">
                    <CanvasBindingBadge nodeId={nodeId} keyName="strokeColor" />
                  </div>
                </div>
              )}
            </div>
            <div>
              <NumberField
                label="Stroke W"
                value={strokeWidth}
                onChange={(strokeWidth) =>
                  updateFlow({
                    nodes: state.flow.nodes.map((n) =>
                      n.data?.identifier?.id !== nodeId
                        ? n
                        : { ...n, data: { ...n.data, strokeWidth } }
                    ),
                  })
                }
                min={0}
                step={0.5}
                defaultValue={1}
                bindAdornment={
                  <BindingAndBatchControls
                    bindProps={{ nodeId, bindingKey: 'strokeWidth' }}
                    batchProps={{
                      nodeId,
                      fieldPath: getResolverFieldPath('canvas', 'strokeWidth')!,
                      valueType: 'number',
                    }}
                  />
                }
                disabled={isBound('strokeWidth')}
                inputClassName={leftBorderClass('strokeWidth')}
              />
              {/* Badge - Only show when bound */}
              {isBound('strokeWidth') && (
                <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                  <div className="flex items-center gap-[var(--space-1)]">
                    <CanvasBindingBadge nodeId={nodeId} keyName="strokeWidth" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ADD: Message when color properties are hidden */}
      {upstreamObjectTypes.allText && (
        <div className="rounded border border-[var(--border-primary)] bg-[var(--surface-2)] p-3 text-xs text-[var(--text-tertiary)]">
          <div className="mb-1 font-medium">Color properties disabled</div>
          <div>Use Typography node for text color and stroke styling</div>
        </div>
      )}
    </div>
  );
}
