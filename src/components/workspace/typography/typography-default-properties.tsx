import React from 'react';
import type { Node } from 'reactflow';
import { useWorkspace } from '@/components/workspace/workspace-context';
import { BindingAndBatchControls } from '@/components/workspace/batch/BindingAndBatchControls';
import { TextareaField, SelectField, NumberField, ColorField } from '@/components/ui/form-fields';
import { getResolverFieldPath } from '@/shared/properties/field-paths';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { TypographyNodeData } from '@/shared/types/nodes';

import { TypographyBindingBadge } from './typography-badges';

export function TypographyDefaultProperties({ nodeId }: { nodeId: string }) {
  const { state, updateFlow } = useWorkspace();
  const node = state.flow.nodes.find((n) => n.data?.identifier?.id === nodeId) as
    | Node<TypographyNodeData>
    | undefined;
  const data = (node?.data ?? {}) as Record<string, unknown> & {
    content?: string;
    // Typography Core
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: string;
    fontStyle?: string;
    // Colors
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
    (getNodeDefinition('typography')?.defaults as Record<string, unknown> & {
      content?: string;
      fontFamily?: string;
      fontSize?: number;
      fontWeight?: string;
      fontStyle?: string;
      textAlign?: string;
      textBaseline?: string;
      direction?: string;
      lineHeight?: number;
      letterSpacing?: number;
      // RESTORE: Uncomment color value resolution
      fillColor?: string;
      strokeColor?: string;
      strokeWidth?: number;
      shadowColor?: string;
      shadowOffsetX?: number;
      shadowOffsetY?: number;
      shadowBlur?: number;
      textOpacity?: number;
    }) ?? {};

  // ADD content to value resolution
  const content = data.content ?? def.content ?? 'Sample Text';

  // Value resolution with fallbacks
  const fontFamily = data.fontFamily ?? def.fontFamily ?? 'Arial';
  const fontSize = data.fontSize ?? def.fontSize ?? 24;
  const fontWeight = data.fontWeight ?? def.fontWeight ?? 'normal';
  const fontStyle = data.fontStyle ?? def.fontStyle ?? 'normal';
  const fillColor = data.fillColor ?? def.fillColor ?? '#000000';
  const strokeColor = data.strokeColor ?? def.strokeColor ?? '#ffffff';
  const strokeWidth = data.strokeWidth ?? def.strokeWidth ?? 0;

  const isBound = (key: string) => !!bindings[key]?.boundResultNodeId;

  const leftBorderClass = (key: string) =>
    isBound(key) ? 'border-l-2 border-[var(--accent-secondary)]' : '';

  return (
    <div className="space-y-[var(--space-4)]">
      <div className="mb-[var(--space-3)] text-sm font-medium text-[var(--text-primary)]">
        Global Typography Defaults
      </div>

      {/* ADD Content Section as FIRST section */}
      <div className="space-y-[var(--space-3)]">
        <div className="text-sm font-medium text-[var(--text-primary)]">Content</div>
        <div>
          <TextareaField
            label="Text Content"
            value={content}
            onChange={(content) =>
              updateFlow({
                nodes: state.flow.nodes.map((n) =>
                  n.data?.identifier?.id !== nodeId ? n : { ...n, data: { ...n.data, content } }
                ),
              })
            }
            rows={4}
            bindAdornment={
              <BindingAndBatchControls
                bindProps={{ nodeId, bindingKey: 'content' }}
                batchProps={{
                  nodeId,
                  fieldPath: getResolverFieldPath('typography', 'content')!,
                  valueType: 'string',
                }}
              />
            }
            disabled={isBound('content')}
            inputClassName={leftBorderClass('content')}
          />
          {isBound('content') && (
            <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
              <div className="flex items-center gap-[var(--space-1)]">
                <TypographyBindingBadge nodeId={nodeId} keyName="content" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Typography Core */}
      <div className="space-y-[var(--space-3)]">
        <div className="text-sm font-medium text-[var(--text-primary)]">Typography</div>

        {/* Typography Row 1 - Font Family */}
        <div>
          <SelectField
            label="Font Family"
            value={fontFamily}
            onChange={(fontFamily) =>
              updateFlow({
                nodes: state.flow.nodes.map((n) =>
                  n.data?.identifier?.id !== nodeId ? n : { ...n, data: { ...n.data, fontFamily } }
                ),
              })
            }
            options={[
              { value: 'Arial', label: 'Arial' },
              { value: 'Helvetica', label: 'Helvetica' },
              { value: 'Times New Roman', label: 'Times New Roman' },
              { value: 'Courier New', label: 'Courier New' },
              { value: 'Georgia', label: 'Georgia' },
              { value: 'Verdana', label: 'Verdana' },
            ]}
          />
        </div>

        {/* Typography Row 2 - Font Size */}
        <div>
          <NumberField
            label="Font Size (px)"
            value={fontSize}
            onChange={(fontSize) =>
              updateFlow({
                nodes: state.flow.nodes.map((n) =>
                  n.data?.identifier?.id !== nodeId ? n : { ...n, data: { ...n.data, fontSize } }
                ),
              })
            }
            min={8}
            max={200}
            step={1}
            bindAdornment={
              <BindingAndBatchControls
                bindProps={{ nodeId, bindingKey: 'fontSize' }}
                batchProps={{
                  nodeId,
                  fieldPath: getResolverFieldPath('typography', 'fontSize')!,
                  valueType: 'number',
                }}
              />
            }
            disabled={isBound('fontSize')}
            inputClassName={leftBorderClass('fontSize')}
          />
          {/* Badge - Only show when needed */}
          {isBound('fontSize') && (
            <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
              <div className="flex items-center gap-[var(--space-1)]">
                <TypographyBindingBadge nodeId={nodeId} keyName="fontSize" />
              </div>
            </div>
          )}
        </div>

        {/* Typography Row 2 - Font Weight */}
        <div>
          <SelectField
            label="Font Weight"
            value={fontWeight}
            onChange={(fontWeight) =>
              updateFlow({
                nodes: state.flow.nodes.map((n) =>
                  n.data?.identifier?.id !== nodeId ? n : { ...n, data: { ...n.data, fontWeight } }
                ),
              })
            }
            options={[
              { value: 'normal', label: 'Normal (400)' },
              { value: 'bold', label: 'Bold (700)' },
              { value: '100', label: 'Thin (100)' },
              { value: '300', label: 'Light (300)' },
              { value: '500', label: 'Medium (500)' },
              { value: '600', label: 'Semi Bold (600)' },
              { value: '800', label: 'Extra Bold (800)' },
              { value: '900', label: 'Black (900)' },
            ]}
          />
        </div>

        {/* Typography Row 3 - Font Style */}
        <div>
          <SelectField
            label="Font Style"
            value={fontStyle}
            onChange={(fontStyle) =>
              updateFlow({
                nodes: state.flow.nodes.map((n) =>
                  n.data?.identifier?.id !== nodeId ? n : { ...n, data: { ...n.data, fontStyle } }
                ),
              })
            }
            options={[
              { value: 'normal', label: 'Normal' },
              { value: 'italic', label: 'Italic' },
              { value: 'oblique', label: 'Oblique' },
            ]}
          />
        </div>
      </div>

      {/* Colors */}
      <div className="space-y-[var(--space-3)]">
        <div className="text-sm font-medium text-[var(--text-primary)]">Colors</div>

        {/* Colors Row 1 - 2x2 grid for Fill and Stroke Color */}
        <div className="grid grid-cols-2 gap-[var(--space-2)]">
          <div>
            <ColorField
              label="Fill Color"
              value={fillColor}
              onChange={(fillColor) =>
                updateFlow({
                  nodes: state.flow.nodes.map((n) =>
                    n.data?.identifier?.id !== nodeId ? n : { ...n, data: { ...n.data, fillColor } }
                  ),
                })
              }
              bindAdornment={
                <BindingAndBatchControls
                  bindProps={{ nodeId, bindingKey: 'fillColor' }}
                  batchProps={{
                    nodeId,
                    fieldPath: getResolverFieldPath('typography', 'fillColor')!,
                    valueType: 'string',
                  }}
                />
              }
              disabled={isBound('fillColor')}
            />
            {/* Badge - Only show when bound */}
            {isBound('fillColor') && (
              <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                <div className="flex items-center gap-[var(--space-1)]">
                  <TypographyBindingBadge nodeId={nodeId} keyName="fillColor" />
                </div>
              </div>
            )}
          </div>
          <div>
            <ColorField
              label="Stroke Color"
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
                    fieldPath: getResolverFieldPath('typography', 'strokeColor')!,
                    valueType: 'string',
                  }}
                />
              }
              disabled={isBound('strokeColor')}
            />
            {/* Badge - Only show when bound */}
            {isBound('strokeColor') && (
              <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                <div className="flex items-center gap-[var(--space-1)]">
                  <TypographyBindingBadge nodeId={nodeId} keyName="strokeColor" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Colors Row 2 - Single field for Stroke Width */}
        <div>
          <NumberField
            label="Stroke Width"
            value={strokeWidth}
            onChange={(strokeWidth) =>
              updateFlow({
                nodes: state.flow.nodes.map((n) =>
                  n.data?.identifier?.id !== nodeId ? n : { ...n, data: { ...n.data, strokeWidth } }
                ),
              })
            }
            min={0}
            max={10}
            step={0.1}
            bindAdornment={
              <BindingAndBatchControls
                bindProps={{ nodeId, bindingKey: 'strokeWidth' }}
                batchProps={{
                  nodeId,
                  fieldPath: getResolverFieldPath('typography', 'strokeWidth')!,
                  valueType: 'number',
                }}
              />
            }
            disabled={isBound('strokeWidth')}
            inputClassName={leftBorderClass('strokeWidth')}
          />
          {/* Badge - Only show when needed */}
          {isBound('strokeWidth') && (
            <div className="text-[10px] text-[var(--space-1)]">
              <div className="flex items-center gap-[var(--space-1)]">
                <TypographyBindingBadge nodeId={nodeId} keyName="strokeWidth" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
