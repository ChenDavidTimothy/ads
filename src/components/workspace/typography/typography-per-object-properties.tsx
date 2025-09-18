import React from 'react';
import { TextareaField, SelectField, NumberField, ColorField } from '@/components/ui/form-fields';
import { BindingAndBatchControls } from '@/components/workspace/batch/BindingAndBatchControls';
import { useWorkspace } from '@/components/workspace/workspace-context';
import { getResolverFieldPath } from '@/shared/properties/field-paths';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { TypographyNodeData } from '@/shared/types/nodes';
import type { PerObjectAssignments } from '@/shared/properties/assignments';

import { TypographyBindingBadge, TypographyOverrideBadge } from './typography-badges';

export function TypographyPerObjectProperties({
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
  const node = state.flow.nodes.find((n) => n.data?.identifier?.id === nodeId) as
    | Node<TypographyNodeData>
    | undefined;
  const selectedOverrides = assignments[objectId];
  const initial = (selectedOverrides?.initial ?? {}) as Record<string, unknown> & {
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
  };

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
  const base = (node?.data ?? {}) as Record<string, unknown> & {
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
  };

  const isBound = (key: string) => {
    const vbAll = node?.data?.variableBindingsByObject ?? {};
    return !!vbAll?.[objectId]?.[key]?.boundResultNodeId;
  };
  const isOverridden = (key: string) => {
    switch (key) {
      case 'content':
        return initial.content !== undefined;
      case 'fontFamily':
        return initial.fontFamily !== undefined;
      case 'fontSize':
        return initial.fontSize !== undefined;
      case 'fontWeight':
        return initial.fontWeight !== undefined;
      case 'fontStyle':
        return initial.fontStyle !== undefined;
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

  // Property value resolution (same pattern as Canvas)
  const fontFamily = initial.fontFamily ?? base.fontFamily ?? def.fontFamily ?? 'Arial';
  const fontSize = initial.fontSize ?? base.fontSize ?? def.fontSize ?? 24;
  const fontWeight = initial.fontWeight ?? base.fontWeight ?? def.fontWeight ?? 'normal';
  const fontStyle = initial.fontStyle ?? base.fontStyle ?? def.fontStyle ?? 'normal';
  const fillColor = initial.fillColor ?? base.fillColor ?? def.fillColor ?? '#000000';
  const strokeColor = initial.strokeColor ?? base.strokeColor ?? def.strokeColor ?? '#ffffff';
  const strokeWidth = initial.strokeWidth ?? base.strokeWidth ?? def.strokeWidth ?? 0;

  const leftBorderClass = (key: string) =>
    isBound(key)
      ? 'border-l-2 border-[var(--accent-secondary)]'
      : isOverridden(key)
        ? 'border-l-2 border-[var(--warning-600)]'
        : '';

  // Helper functions for bound fields
  const getValue = (key: string, fallbackValue: number | string) => {
    if (isBound(key)) return undefined; // Blank when bound

    switch (key) {
      case 'content':
        return initial.content ?? base.content ?? def.content ?? fallbackValue;
      case 'fontFamily':
        return fontFamily;
      case 'fontSize':
        return fontSize;
      case 'fontWeight':
        return fontWeight;
      case 'fontStyle':
        return fontStyle;
      case 'fillColor':
        return fillColor;
      case 'strokeColor':
        return strokeColor;
      case 'strokeWidth':
        return strokeWidth;
      default:
        return fallbackValue;
    }
  };

  const getStringValue = (key: string, fallbackValue: string) => {
    switch (key) {
      case 'content':
        return initial.content ?? base.content ?? def.content ?? fallbackValue;
      case 'fontFamily':
        return initial.fontFamily ?? base.fontFamily ?? def.fontFamily ?? fallbackValue;
      case 'fontWeight':
        return initial.fontWeight ?? base.fontWeight ?? def.fontWeight ?? fallbackValue;
      case 'fontStyle':
        return initial.fontStyle ?? base.fontStyle ?? def.fontStyle ?? fallbackValue;
      case 'fillColor':
        return initial.fillColor ?? base.fillColor ?? def.fillColor ?? fallbackValue;
      case 'strokeColor':
        return initial.strokeColor ?? base.strokeColor ?? def.strokeColor ?? fallbackValue;
      default:
        return fallbackValue;
    }
  };

  // Removed UI: BatchOverridesFoldout

  return (
    <div className="space-y-[var(--space-4)]">
      <div className="mb-[var(--space-3)] text-sm font-medium text-[var(--text-primary)]">
        Per-Object Typography Overrides
      </div>

      {/* ADD Content Section as FIRST section */}
      <div className="space-y-[var(--space-3)]">
        <div className="text-sm font-medium text-[var(--text-primary)]">Content</div>
        <div>
          <TextareaField
            label="Content"
            value={getValue('content', 'Sample Text') as string}
            onChange={(content) => onChange({ content })}
            rows={4}
            bindAdornment={
              <BindingAndBatchControls
                bindProps={{ nodeId, bindingKey: 'content', objectId }}
                batchProps={{
                  nodeId,
                  fieldPath: getResolverFieldPath('typography', 'content')!,
                  objectId,
                  valueType: 'string',
                }}
              />
            }
            disabled={isBound('content')}
            inputClassName={leftBorderClass('content')}
          />

          {(isOverridden('content') || isBound('content')) && (
            <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
              <div className="flex items-center gap-[var(--space-1)]">
                {isOverridden('content') && !isBound('content') && (
                  <TypographyOverrideBadge nodeId={nodeId} keyName="content" objectId={objectId} />
                )}
                {isBound('content') && (
                  <TypographyBindingBadge nodeId={nodeId} keyName="content" objectId={objectId} />
                )}
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
            value={getStringValue('fontFamily', 'Arial')}
            onChange={(fontFamily) => onChange({ fontFamily })}
            options={[
              { value: 'Arial', label: 'Arial' },
              { value: 'Helvetica', label: 'Helvetica' },
              { value: 'Times New Roman', label: 'Times New Roman' },
              { value: 'Courier New', label: 'Courier New' },
              { value: 'Georgia', label: 'Georgia' },
              { value: 'Verdana', label: 'Verdana' },
            ]}
          />
          {/* Badge - Only show when overridden */}
          {isOverridden('fontFamily') && (
            <div className="text-[10px] text-[var(--space-1)]">
              <div className="flex items-center gap-[var(--space-1)]">
                <TypographyOverrideBadge nodeId={nodeId} keyName="fontFamily" objectId={objectId} />
              </div>
            </div>
          )}
        </div>

        {/* Typography Row 2 - Font Size */}
        <div>
          <NumberField
            label="Font Size (px)"
            value={getValue('fontSize', 24) as number}
            onChange={(fontSize) => onChange({ fontSize })}
            min={8}
            max={200}
            step={1}
            bindAdornment={
              <BindingAndBatchControls
                bindProps={{ nodeId, bindingKey: 'fontSize', objectId }}
                batchProps={{
                  nodeId,
                  fieldPath: getResolverFieldPath('typography', 'fontSize')!,
                  objectId,
                  valueType: 'number',
                }}
              />
            }
            disabled={isBound('fontSize')}
            inputClassName={leftBorderClass('fontSize')}
          />
          {/* Badge - Only show when overridden or bound */}
          {(isOverridden('fontSize') || isBound('fontSize')) && (
            <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
              <div className="flex items-center gap-[var(--space-1)]">
                {isOverridden('fontSize') && !isBound('fontSize') && (
                  <TypographyOverrideBadge nodeId={nodeId} keyName="fontSize" objectId={objectId} />
                )}
                {isBound('fontSize') && (
                  <TypographyBindingBadge nodeId={nodeId} keyName="fontSize" objectId={objectId} />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Typography Row 3 - Font Weight */}
        <div>
          <SelectField
            label="Font Weight"
            value={getStringValue('fontWeight', 'normal')}
            onChange={(fontWeight) => onChange({ fontWeight })}
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
          {/* Badge - Only show when overridden */}
          {isOverridden('fontWeight') && (
            <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
              <div className="flex items-center gap-[var(--space-1)]">
                <TypographyOverrideBadge nodeId={nodeId} keyName="fontWeight" objectId={objectId} />
              </div>
            </div>
          )}
        </div>

        {/* Typography Row 4 - Font Style */}
        <div>
          <SelectField
            label="Font Style"
            value={getStringValue('fontStyle', 'normal')}
            onChange={(fontStyle) => onChange({ fontStyle })}
            options={[
              { value: 'normal', label: 'Normal' },
              { value: 'italic', label: 'Italic' },
              { value: 'oblique', label: 'Oblique' },
            ]}
          />
          {/* Badge - Only show when overridden */}
          {isOverridden('fontStyle') && (
            <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
              <div className="flex items-center gap-[var(--space-1)]">
                <TypographyOverrideBadge nodeId={nodeId} keyName="fontStyle" objectId={objectId} />
              </div>
            </div>
          )}
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
              value={
                isBound('fillColor')
                  ? (base.fillColor ?? def.fillColor ?? '#000000')
                  : getStringValue('fillColor', '#000000')
              }
              onChange={(fillColor) => onChange({ fillColor })}
              bindAdornment={
                <BindingAndBatchControls
                  bindProps={{ nodeId, bindingKey: 'fillColor', objectId }}
                  batchProps={{
                    nodeId,
                    fieldPath: getResolverFieldPath('typography', 'fillColor')!,
                    objectId,
                    valueType: 'string',
                  }}
                />
              }
              disabled={isBound('fillColor')}
            />
            {/* Badge - Show when overridden or bound */}
            {(isOverridden('fillColor') || isBound('fillColor')) && (
              <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                <div className="flex items-center gap-[var(--space-1)]">
                  {isOverridden('fillColor') && !isBound('fillColor') && (
                    <TypographyOverrideBadge
                      nodeId={nodeId}
                      keyName="fillColor"
                      objectId={objectId}
                    />
                  )}
                  {isBound('fillColor') && (
                    <TypographyBindingBadge
                      nodeId={nodeId}
                      keyName="fillColor"
                      objectId={objectId}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
          <div>
            <ColorField
              label="Stroke Color"
              value={
                isBound('strokeColor')
                  ? (base.strokeColor ?? def.strokeColor ?? '#ffffff')
                  : getStringValue('strokeColor', '#ffffff')
              }
              onChange={(strokeColor) => onChange({ strokeColor })}
              bindAdornment={
                <BindingAndBatchControls
                  bindProps={{ nodeId, bindingKey: 'strokeColor', objectId }}
                  batchProps={{
                    nodeId,
                    fieldPath: getResolverFieldPath('typography', 'strokeColor')!,
                    objectId,
                    valueType: 'string',
                  }}
                />
              }
              disabled={isBound('strokeColor')}
            />
            {/* Badge - Show when overridden or bound */}
            {(isOverridden('strokeColor') || isBound('strokeColor')) && (
              <div className="mt-[var(--space-1)] text-[10px] text-[var(--text-tertiary)]">
                <div className="flex items-center gap-[var(--space-1)]">
                  {isOverridden('strokeColor') && !isBound('strokeColor') && (
                    <TypographyOverrideBadge
                      nodeId={nodeId}
                      keyName="strokeColor"
                      objectId={objectId}
                    />
                  )}
                  {isBound('strokeColor') && (
                    <TypographyBindingBadge
                      nodeId={nodeId}
                      keyName="strokeColor"
                      objectId={objectId}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Colors Row 2 - Single field for Stroke Width */}
        <div>
          <NumberField
            label="Stroke Width"
            value={getValue('strokeWidth', 0) as number}
            onChange={(strokeWidth) => onChange({ strokeWidth })}
            min={0}
            max={10}
            step={0.1}
            bindAdornment={
              <BindingAndBatchControls
                bindProps={{ nodeId, bindingKey: 'strokeWidth', objectId }}
                batchProps={{
                  nodeId,
                  fieldPath: getResolverFieldPath('typography', 'strokeWidth')!,
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
                  <TypographyOverrideBadge
                    nodeId={nodeId}
                    keyName="strokeWidth"
                    objectId={objectId}
                  />
                )}
                {isBound('strokeWidth') && (
                  <TypographyBindingBadge
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
    </div>
  );
}
