"use client";

import React, { useMemo, useState, useCallback } from 'react';
import type { Node } from 'reactflow';
import { useWorkspace } from './workspace-context';
import { FlowTracker } from '@/lib/flow/flow-tracking';
import type { TextStyleNodeData } from '@/shared/types/nodes';
import type { PerObjectAssignments, ObjectAssignments } from '@/shared/properties/assignments';
import { SelectField, NumberField, ColorField } from '@/components/ui/form-fields';
import { SelectionList } from '@/components/ui/selection';
import { BindButton, useVariableBinding } from '@/components/workspace/binding/bindings';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import { Badge } from '@/components/ui/badge';
import { Type } from 'lucide-react';

// Badge Components
function TextStyleBindingBadge({ nodeId, keyName, objectId }: { nodeId: string; keyName: string; objectId?: string }) {
	const { state } = useWorkspace();
	const { resetToDefault } = useVariableBinding(nodeId, objectId);
	
	const node = state.flow.nodes.find(n => n.data?.identifier?.id === nodeId) as Node<TextStyleNodeData> | undefined;
	if (!node) return null;
	let bound: string | undefined;
	if (objectId) {
		bound = node.data?.variableBindingsByObject?.[objectId]?.[keyName]?.boundResultNodeId;
	} else {
		bound = node.data?.variableBindings?.[keyName]?.boundResultNodeId;
	}
	if (!bound) return null;
	const name = state.flow.nodes.find(n => n.data?.identifier?.id === bound)?.data?.identifier?.displayName;
	
	return (
		<Badge variant="bound" onRemove={() => resetToDefault(keyName)}>{name ? `Bound: ${name}` : 'Bound'}</Badge>
	);
}

function TextStyleOverrideBadge({ nodeId, keyName, objectId }: { nodeId: string; keyName: string; objectId?: string }) {
	const { resetToDefault } = useVariableBinding(nodeId, objectId);
	
	return <Badge variant="manual" onRemove={() => resetToDefault(keyName)}>Manual</Badge>;
}


// Default Properties Component (Center Panel)
function TextStyleDefaultProperties({ nodeId }: { nodeId: string }) {
  const { state, updateFlow } = useWorkspace();
  const node = state.flow.nodes.find(n => n.data?.identifier?.id === nodeId) as Node<TextStyleNodeData> | undefined;
  const data = (node?.data ?? {}) as Record<string, unknown> & {
    // Typography Core
    fontFamily?: string;
    fontWeight?: string;
    fontStyle?: string;
    // Text Layout
    textAlign?: string;
    textBaseline?: string;
    direction?: string;
    // Text Spacing
    lineHeight?: number;
    letterSpacing?: number;
    // ✅ REMOVE - Colors should come from Canvas/ObjectState
    // fillColor?: string;
    // strokeColor?: string;
    // strokeWidth?: number;
    // Text Effects
    shadowColor?: string;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
    shadowBlur?: number;
    textOpacity?: number;
    variableBindings?: Record<string, { target?: string; boundResultNodeId?: string }>;
  };
  const bindings = (data.variableBindings ?? {}) as Record<string, { target?: string; boundResultNodeId?: string }>;

  const def = (getNodeDefinition('textstyle')?.defaults as Record<string, unknown> & {
    fontFamily?: string;
    fontWeight?: string;
    fontStyle?: string;
    textAlign?: string;
    textBaseline?: string;
    direction?: string;
    lineHeight?: number;
    letterSpacing?: number;
    // ✅ REMOVE - Colors should come from Canvas/ObjectState
    // fillColor?: string;
    // strokeColor?: string;
    // strokeWidth?: number;
    shadowColor?: string;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
    shadowBlur?: number;
    textOpacity?: number;
  }) ?? {};

  // Value resolution with fallbacks
  const fontFamily = data.fontFamily ?? def.fontFamily ?? 'Arial';
  const fontWeight = data.fontWeight ?? def.fontWeight ?? 'normal';
  const fontStyle = data.fontStyle ?? def.fontStyle ?? 'normal';
  const textAlign = data.textAlign ?? def.textAlign ?? 'center';
  const textBaseline = data.textBaseline ?? def.textBaseline ?? 'middle';
  const direction = data.direction ?? def.direction ?? 'ltr';
  const lineHeight = data.lineHeight ?? def.lineHeight ?? 1.2;
  const letterSpacing = data.letterSpacing ?? def.letterSpacing ?? 0;
  // ✅ REMOVE - Colors should come from Canvas/ObjectState
  // const fillColor = data.fillColor ?? def.fillColor ?? '#000000';
  // const strokeColor = data.strokeColor ?? def.strokeColor ?? '#ffffff';
  // const strokeWidth = data.strokeWidth ?? def.strokeWidth ?? 0;
  const shadowColor = data.shadowColor ?? def.shadowColor ?? '#000000';
  const shadowOffsetX = data.shadowOffsetX ?? def.shadowOffsetX ?? 0;
  const shadowOffsetY = data.shadowOffsetY ?? def.shadowOffsetY ?? 0;
  const shadowBlur = data.shadowBlur ?? def.shadowBlur ?? 0;
  const textOpacity = data.textOpacity ?? def.textOpacity ?? 1;

  const isBound = (key: string) => !!bindings[key]?.boundResultNodeId;
  const leftBorderClass = (key: string) => (
    isBound(key) ? 'border-l-2 border-[var(--accent-secondary)]' : ''
  );

  return (
    <div className="space-y-[var(--space-4)]">
      <div className="text-sm font-medium text-[var(--text-primary)] mb-[var(--space-3)]">
        Global Text Style Defaults
      </div>
      
      {/* Typography Core */}
      <div className="space-y-[var(--space-3)]">
        <div className="text-sm font-medium text-[var(--text-primary)]">Typography</div>
        <div className="grid grid-cols-2 gap-[var(--space-3)]">
          <div>
            <SelectField
              label="Font Family"
              value={fontFamily}
              onChange={(fontFamily) => updateFlow({ nodes: state.flow.nodes.map(n => n.data?.identifier?.id !== nodeId ? n : ({ ...n, data: { ...n.data, fontFamily } })) })}
              options={[
                { value: 'Arial', label: 'Arial' },
                { value: 'Helvetica', label: 'Helvetica' },
                { value: 'Times New Roman', label: 'Times New Roman' },
                { value: 'Courier New', label: 'Courier New' },
                { value: 'Georgia', label: 'Georgia' },
                { value: 'Verdana', label: 'Verdana' }
              ]}
              bindAdornment={<BindButton nodeId={nodeId} bindingKey="fontFamily" />}
              disabled={isBound('fontFamily')}
              inputClassName={leftBorderClass('fontFamily')}
            />
          </div>
          <div>
            <SelectField
              label="Font Weight"
              value={fontWeight}
              onChange={(fontWeight) => updateFlow({ nodes: state.flow.nodes.map(n => n.data?.identifier?.id !== nodeId ? n : ({ ...n, data: { ...n.data, fontWeight } })) })}
              options={[
                { value: 'normal', label: 'Normal (400)' },
                { value: 'bold', label: 'Bold (700)' },
                { value: '100', label: 'Thin (100)' },
                { value: '300', label: 'Light (300)' },
                { value: '500', label: 'Medium (500)' },
                { value: '600', label: 'Semi Bold (600)' },
                { value: '800', label: 'Extra Bold (800)' },
                { value: '900', label: 'Black (900)' }
              ]}
              bindAdornment={<BindButton nodeId={nodeId} bindingKey="fontWeight" />}
              disabled={isBound('fontWeight')}
              inputClassName={leftBorderClass('fontWeight')}
            />
          </div>
          <div>
            <SelectField
              label="Font Style"
              value={fontStyle}
              onChange={(fontStyle) => updateFlow({ nodes: state.flow.nodes.map(n => n.data?.identifier?.id !== nodeId ? n : ({ ...n, data: { ...n.data, fontStyle } })) })}
              options={[
                { value: 'normal', label: 'Normal' },
                { value: 'italic', label: 'Italic' },
                { value: 'oblique', label: 'Oblique' }
              ]}
              bindAdornment={<BindButton nodeId={nodeId} bindingKey="fontStyle" />}
              disabled={isBound('fontStyle')}
              inputClassName={leftBorderClass('fontStyle')}
            />
          </div>
        </div>
      </div>

      {/* Text Layout */}
      <div className="space-y-[var(--space-3)]">
        <div className="text-sm font-medium text-[var(--text-primary)]">Layout & Spacing</div>
        <div className="grid grid-cols-2 gap-[var(--space-3)]">
          <div>
            <SelectField
              label="Text Alignment"
              value={textAlign}
              onChange={(textAlign) => updateFlow({ nodes: state.flow.nodes.map(n => n.data?.identifier?.id !== nodeId ? n : ({ ...n, data: { ...n.data, textAlign } })) })}
              options={[
                { value: 'left', label: 'Left' },
                { value: 'center', label: 'Center' },
                { value: 'right', label: 'Right' },
                { value: 'justify', label: 'Justify' }
              ]}
              bindAdornment={<BindButton nodeId={nodeId} bindingKey="textAlign" />}
              disabled={isBound('textAlign')}
              inputClassName={leftBorderClass('textAlign')}
            />
          </div>
          <div>
            <SelectField
              label="Text Baseline"
              value={textBaseline}
              onChange={(textBaseline) => updateFlow({ nodes: state.flow.nodes.map(n => n.data?.identifier?.id !== nodeId ? n : ({ ...n, data: { ...n.data, textBaseline } })) })}
              options={[
                { value: 'top', label: 'Top' },
                { value: 'hanging', label: 'Hanging' },
                { value: 'middle', label: 'Middle' },
                { value: 'alphabetic', label: 'Alphabetic' },
                { value: 'bottom', label: 'Bottom' }
              ]}
              bindAdornment={<BindButton nodeId={nodeId} bindingKey="textBaseline" />}
              disabled={isBound('textBaseline')}
              inputClassName={leftBorderClass('textBaseline')}
            />
          </div>
          <div>
            <SelectField
              label="Direction"
              value={direction}
              onChange={(direction) => updateFlow({ nodes: state.flow.nodes.map(n => n.data?.identifier?.id !== nodeId ? n : ({ ...n, data: { ...n.data, direction } })) })}
              options={[
                { value: 'ltr', label: 'Left to Right' },
                { value: 'rtl', label: 'Right to Left' }
              ]}
              bindAdornment={<BindButton nodeId={nodeId} bindingKey="direction" />}
              disabled={isBound('direction')}
              inputClassName={leftBorderClass('direction')}
            />
          </div>
          <div>
            <NumberField
              label="Line Height"
              value={lineHeight}
              onChange={(lineHeight) => updateFlow({ nodes: state.flow.nodes.map(n => n.data?.identifier?.id !== nodeId ? n : ({ ...n, data: { ...n.data, lineHeight } })) })}
              min={0.5} max={5} step={0.1}
              bindAdornment={<BindButton nodeId={nodeId} bindingKey="lineHeight" />}
              disabled={isBound('lineHeight')}
              inputClassName={leftBorderClass('lineHeight')}
            />
          </div>
          <div>
            <NumberField
              label="Letter Spacing (px)"
              value={letterSpacing}
              onChange={(letterSpacing) => updateFlow({ nodes: state.flow.nodes.map(n => n.data?.identifier?.id !== nodeId ? n : ({ ...n, data: { ...n.data, letterSpacing } })) })}
              min={-5} max={20} step={0.1}
              bindAdornment={<BindButton nodeId={nodeId} bindingKey="letterSpacing" />}
              disabled={isBound('letterSpacing')}
              inputClassName={leftBorderClass('letterSpacing')}
            />
          </div>
        </div>
      </div>

      {/* Text Effects */}
      <div className="space-y-[var(--space-3)]">
        <div className="text-sm font-medium text-[var(--text-primary)]">Text Effects</div>
        <div className="space-y-[var(--space-3)]">
          <div>
            <ColorField 
              label="Shadow Color" 
              value={shadowColor} 
              onChange={(shadowColor) => updateFlow({ nodes: state.flow.nodes.map(n => n.data?.identifier?.id !== nodeId ? n : ({ ...n, data: { ...n.data, shadowColor } })) })}
              bindAdornment={<BindButton nodeId={nodeId} bindingKey="shadowColor" />}
              disabled={isBound('shadowColor')}
              inputClassName={leftBorderClass('shadowColor')}
            />
          </div>
          <div className="grid grid-cols-3 gap-[var(--space-2)]">
            <div>
              <NumberField 
                label="Shadow X" 
                value={shadowOffsetX} 
                onChange={(shadowOffsetX) => updateFlow({ nodes: state.flow.nodes.map(n => n.data?.identifier?.id !== nodeId ? n : ({ ...n, data: { ...n.data, shadowOffsetX } })) })}
                min={-20} max={20} step={1}
                bindAdornment={<BindButton nodeId={nodeId} bindingKey="shadowOffsetX" />}
                disabled={isBound('shadowOffsetX')}
                inputClassName={leftBorderClass('shadowOffsetX')}
              />
            </div>
            <div>
              <NumberField 
                label="Shadow Y" 
                value={shadowOffsetY} 
                onChange={(shadowOffsetY) => updateFlow({ nodes: state.flow.nodes.map(n => n.data?.identifier?.id !== nodeId ? n : ({ ...n, data: { ...n.data, shadowOffsetY } })) })}
                min={-20} max={20} step={1}
                bindAdornment={<BindButton nodeId={nodeId} bindingKey="shadowOffsetY" />}
                disabled={isBound('shadowOffsetY')}
                inputClassName={leftBorderClass('shadowOffsetY')}
              />
            </div>
            <div>
              <NumberField 
                label="Shadow Blur" 
                value={shadowBlur} 
                onChange={(shadowBlur) => updateFlow({ nodes: state.flow.nodes.map(n => n.data?.identifier?.id !== nodeId ? n : ({ ...n, data: { ...n.data, shadowBlur } })) })}
                min={0} max={20} step={1}
                bindAdornment={<BindButton nodeId={nodeId} bindingKey="shadowBlur" />}
              disabled={isBound('shadowBlur')}
              inputClassName={leftBorderClass('shadowBlur')}
              />
            </div>
          </div>
          <div>
            <NumberField 
              label="Text Opacity" 
              value={textOpacity} 
              onChange={(textOpacity) => updateFlow({ nodes: state.flow.nodes.map(n => n.data?.identifier?.id !== nodeId ? n : ({ ...n, data: { ...n.data, textOpacity } })) })}
              min={0} max={1} step={0.05}
              bindAdornment={<BindButton nodeId={nodeId} bindingKey="textOpacity" />}
              disabled={isBound('textOpacity')}
              inputClassName={leftBorderClass('textOpacity')}
            />
          </div>
        </div>
      </div>

      {/* Binding Status Badges */}
      <div className="grid grid-cols-2 gap-[var(--space-2)] text-[10px] text-[var(--text-tertiary)]">
        <div className="flex items-center gap-[var(--space-1)]">
          <TextStyleBindingBadge nodeId={nodeId} keyName="fontFamily" />
        </div>
        <div className="flex items-center gap-[var(--space-1)]">
          <TextStyleBindingBadge nodeId={nodeId} keyName="fontWeight" />
        </div>
        <div className="flex items-center gap-[var(--space-1)]">
          <TextStyleBindingBadge nodeId={nodeId} keyName="fontStyle" />
        </div>
        <div className="flex items-center gap-[var(--space-1)]">
          <TextStyleBindingBadge nodeId={nodeId} keyName="textAlign" />
        </div>
        <div className="flex items-center gap-[var(--space-1)]">
          <TextStyleBindingBadge nodeId={nodeId} keyName="textBaseline" />
        </div>
        <div className="flex items-center gap-[var(--space-1)]">
          <TextStyleBindingBadge nodeId={nodeId} keyName="direction" />
        </div>
        <div className="flex items-center gap-[var(--space-1)]">
          <TextStyleBindingBadge nodeId={nodeId} keyName="lineHeight" />
        </div>
        <div className="flex items-center gap-[var(--space-1)]">
          <TextStyleBindingBadge nodeId={nodeId} keyName="letterSpacing" />
        </div>
        <div className="flex items-center gap-[var(--space-1)]">
          <TextStyleBindingBadge nodeId={nodeId} keyName="shadowColor" />
        </div>
        <div className="flex items-center gap-[var(--space-1)]">
          <TextStyleBindingBadge nodeId={nodeId} keyName="shadowOffsetX" />
        </div>
        <div className="flex items-center gap-[var(--space-1)]">
          <TextStyleBindingBadge nodeId={nodeId} keyName="shadowOffsetY" />
        </div>
        <div className="flex items-center gap-[var(--space-1)]">
          <TextStyleBindingBadge nodeId={nodeId} keyName="shadowBlur" />
        </div>
        <div className="flex items-center gap-[var(--space-1)]">
          <TextStyleBindingBadge nodeId={nodeId} keyName="textOpacity" />
        </div>
      </div>
    </div>
  );
}

// Per-Object Properties Component (Right Panel)
function TextStylePerObjectProperties({ nodeId, objectId, assignments, onChange, _onClear }: {
  nodeId: string;
  objectId: string;
  assignments: PerObjectAssignments;
  onChange: (updates: Record<string, unknown>) => void;
  _onClear: () => void;
}) {
  const { state } = useWorkspace();
  const node = state.flow.nodes.find(n => n.data?.identifier?.id === nodeId) as Node<TextStyleNodeData> | undefined;
  const selectedOverrides = assignments[objectId];
  const initial = (selectedOverrides?.initial ?? {}) as Record<string, unknown> & {
    // Typography Core  
    fontFamily?: string;
    fontWeight?: string;
    fontStyle?: string;
    // Text Layout
    textAlign?: string;
    textBaseline?: string;
    direction?: string;
    // Text Spacing
    lineHeight?: number;
    letterSpacing?: number;
    // ✅ REMOVE - Colors should come from Canvas/ObjectState
    // fillColor?: string;
    // strokeColor?: string;
    // strokeWidth?: number;
    // Text Effects
    shadowColor?: string;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
    shadowBlur?: number;
    textOpacity?: number;
  };

  const def = (getNodeDefinition('textstyle')?.defaults as Record<string, unknown> & {
    fontFamily?: string;
    fontWeight?: string;
    fontStyle?: string;
    textAlign?: string;
    textBaseline?: string;
    direction?: string;
    lineHeight?: number;
    letterSpacing?: number;
    // ✅ REMOVE - Colors should come from Canvas/ObjectState
    // fillColor?: string;
    // strokeColor?: string;
    // strokeWidth?: number;
    shadowColor?: string;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
    shadowBlur?: number;
    textOpacity?: number;
  }) ?? {};
  const base = (node?.data ?? {}) as Record<string, unknown> & {
    fontFamily?: string;
    fontWeight?: string;
    fontStyle?: string;
    textAlign?: string;
    textBaseline?: string;
    direction?: string;
    lineHeight?: number;
    letterSpacing?: number;
    // ✅ REMOVE - Colors should come from Canvas/ObjectState
    // fillColor?: string;
    // strokeColor?: string;
    // strokeWidth?: number;
    shadowColor?: string;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
    shadowBlur?: number;
    textOpacity?: number;
  };

  const isBound = (key: string) => {
    const vbAll = node?.data?.variableBindingsByObject ?? {};
    return !!vbAll?.[objectId]?.[key]?.boundResultNodeId;
  };

  const isOverridden = (key: string) => {
    switch (key) {
      case 'fontFamily': return initial.fontFamily !== undefined;
      case 'fontWeight': return initial.fontWeight !== undefined;
      case 'fontStyle': return initial.fontStyle !== undefined;
      case 'textAlign': return initial.textAlign !== undefined;
      case 'textBaseline': return initial.textBaseline !== undefined;
      case 'direction': return initial.direction !== undefined;
      case 'lineHeight': return initial.lineHeight !== undefined;
      case 'letterSpacing': return initial.letterSpacing !== undefined;
      case 'shadowColor': return initial.shadowColor !== undefined;
      case 'shadowOffsetX': return initial.shadowOffsetX !== undefined;
      case 'shadowOffsetY': return initial.shadowOffsetY !== undefined;
      case 'shadowBlur': return initial.shadowBlur !== undefined;
      case 'textOpacity': return initial.textOpacity !== undefined;
      default: return false;
    }
  };

  // Property value resolution (same pattern as Canvas)
  const fontFamily = initial.fontFamily ?? base.fontFamily ?? def.fontFamily ?? 'Arial';
  const fontWeight = initial.fontWeight ?? base.fontWeight ?? def.fontWeight ?? 'normal';
  const fontStyle = initial.fontStyle ?? base.fontStyle ?? def.fontStyle ?? 'normal';
  const textAlign = initial.textAlign ?? base.textAlign ?? def.textAlign ?? 'center';
  const textBaseline = initial.textBaseline ?? base.textBaseline ?? def.textBaseline ?? 'middle';
  const direction = initial.direction ?? base.direction ?? def.direction ?? 'ltr';
  const lineHeight = initial.lineHeight ?? base.lineHeight ?? def.lineHeight ?? 1.2;
  const letterSpacing = initial.letterSpacing ?? base.letterSpacing ?? def.letterSpacing ?? 0;
  // ✅ REMOVE - Colors should come from Canvas/ObjectState
  // const fillColor = initial.fillColor ?? base.fillColor ?? def.fillColor ?? '#000000';
  // const strokeColor = initial.strokeColor ?? base.strokeColor ?? def.strokeColor ?? '#ffffff';
  // const strokeWidth = initial.strokeWidth ?? base.strokeWidth ?? def.strokeWidth ?? 0;
  const shadowColor = initial.shadowColor ?? base.shadowColor ?? def.shadowColor ?? '#000000';
  const shadowOffsetX = initial.shadowOffsetX ?? base.shadowOffsetX ?? def.shadowOffsetX ?? 0;
  const shadowOffsetY = initial.shadowOffsetY ?? base.shadowOffsetY ?? def.shadowOffsetY ?? 0;
  const shadowBlur = initial.shadowBlur ?? base.shadowBlur ?? def.shadowBlur ?? 0;
  const textOpacity = initial.textOpacity ?? base.textOpacity ?? def.textOpacity ?? 1;

  const leftBorderClass = (key: string) => (
    isBound(key) ? 'border-l-2 border-[var(--accent-secondary)]' : 
    (isOverridden(key) ? 'border-l-2 border-[var(--warning-600)]' : '')
  );

  // Helper functions for bound fields
  const getValue = (key: string, fallbackValue: number | string) => {
    if (isBound(key)) return undefined; // Blank when bound
    
    switch (key) {
      case 'fontFamily': return fontFamily;
      case 'fontWeight': return fontWeight;
      case 'fontStyle': return fontStyle;
      case 'textAlign': return textAlign;
      case 'textBaseline': return textBaseline;
      case 'direction': return direction;
      case 'lineHeight': return lineHeight;
      case 'letterSpacing': return letterSpacing;
      case 'shadowColor': return shadowColor;
      case 'shadowOffsetX': return shadowOffsetX;
      case 'shadowOffsetY': return shadowOffsetY;
      case 'shadowBlur': return shadowBlur;
      case 'textOpacity': return textOpacity;
      default: return fallbackValue;
    }
  };

  const getStringValue = (key: string, fallbackValue: string) => {
    if (isBound(key)) return ''; // Empty string when bound
    return getValue(key, fallbackValue) as string;
  };

  return (
    <div className="space-y-[var(--space-4)]">
      <div className="text-sm font-medium text-[var(--text-primary)] mb-[var(--space-3)]">
        Per-Object Text Style Overrides
      </div>
      
      {/* Typography Core */}
      <div className="space-y-[var(--space-3)]">
        <div className="text-sm font-medium text-[var(--text-primary)]">Typography</div>
        <div className="grid grid-cols-2 gap-[var(--space-3)]">
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
                { value: 'Verdana', label: 'Verdana' }
              ]}
              bindAdornment={<BindButton nodeId={nodeId} bindingKey="fontFamily" objectId={objectId} />}
              disabled={isBound('fontFamily')}
              inputClassName={leftBorderClass('fontFamily')}
            />
          </div>
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
                { value: '900', label: 'Black (900)' }
              ]}
              bindAdornment={<BindButton nodeId={nodeId} bindingKey="fontWeight" objectId={objectId} />}
              disabled={isBound('fontWeight')}
              inputClassName={leftBorderClass('fontWeight')}
            />
          </div>
          <div>
            <SelectField
              label="Font Style"
              value={getStringValue('fontStyle', 'normal')}
              onChange={(fontStyle) => onChange({ fontStyle })}
              options={[
                { value: 'normal', label: 'Normal' },
                { value: 'italic', label: 'Italic' },
                { value: 'oblique', label: 'Oblique' }
              ]}
              bindAdornment={<BindButton nodeId={nodeId} bindingKey="fontStyle" objectId={objectId} />}
              disabled={isBound('fontStyle')}
              inputClassName={leftBorderClass('fontStyle')}
            />
          </div>
        </div>
        {/* Badges for Typography Row */}
        <div className="grid grid-cols-3 gap-[var(--space-3)] text-[10px] text-[var(--text-tertiary)]">
          <div className="flex items-center gap-[var(--space-1)]">
            {isOverridden('fontFamily') && !isBound('fontFamily') && <TextStyleOverrideBadge nodeId={nodeId} keyName="fontFamily" objectId={objectId} />}
            <TextStyleBindingBadge nodeId={nodeId} keyName="fontFamily" objectId={objectId} />
          </div>
          <div className="flex items-center gap-[var(--space-1)]">
            {isOverridden('fontWeight') && !isBound('fontWeight') && <TextStyleOverrideBadge nodeId={nodeId} keyName="fontWeight" objectId={objectId} />}
            <TextStyleBindingBadge nodeId={nodeId} keyName="fontWeight" objectId={objectId} />
          </div>
          <div className="flex items-center gap-[var(--space-1)]">
            {isOverridden('fontStyle') && !isBound('fontStyle') && <TextStyleOverrideBadge nodeId={nodeId} keyName="fontStyle" objectId={objectId} />}
            <TextStyleBindingBadge nodeId={nodeId} keyName="fontStyle" objectId={objectId} />
          </div>
        </div>
      </div>

      {/* Text Layout */}
      <div className="space-y-[var(--space-3)]">
        <div className="text-sm font-medium text-[var(--text-primary)]">Layout & Spacing</div>
        <div className="grid grid-cols-2 gap-[var(--space-3)]">
          <div>
            <SelectField
              label="Text Alignment"
              value={getStringValue('textAlign', 'center')}
              onChange={(textAlign) => onChange({ textAlign })}
              options={[
                { value: 'left', label: 'Left' },
                { value: 'center', label: 'Center' },
                { value: 'right', label: 'Right' },
                { value: 'justify', label: 'Justify' }
              ]}
              bindAdornment={<BindButton nodeId={nodeId} bindingKey="textAlign" objectId={objectId} />}
              disabled={isBound('textAlign')}
              inputClassName={leftBorderClass('textAlign')}
            />
          </div>
          <div>
            <SelectField
              label="Text Baseline"
              value={getStringValue('textBaseline', 'middle')}
              onChange={(textBaseline) => onChange({ textBaseline })}
              options={[
                { value: 'top', label: 'Top' },
                { value: 'hanging', label: 'Hanging' },
                { value: 'middle', label: 'Middle' },
                { value: 'alphabetic', label: 'Alphabetic' },
                { value: 'bottom', label: 'Bottom' }
              ]}
              bindAdornment={<BindButton nodeId={nodeId} bindingKey="textBaseline" objectId={objectId} />}
              disabled={isBound('textBaseline')}
              inputClassName={leftBorderClass('textBaseline')}
            />
          </div>
          <div>
            <SelectField
              label="Direction"
              value={getStringValue('direction', 'ltr')}
              onChange={(direction) => onChange({ direction })}
              options={[
                { value: 'ltr', label: 'Left to Right' },
                { value: 'rtl', label: 'Right to Left' }
              ]}
              bindAdornment={<BindButton nodeId={nodeId} bindingKey="direction" objectId={objectId} />}
              disabled={isBound('direction')}
              inputClassName={leftBorderClass('direction')}
            />
          </div>
          <div>
            <NumberField
              label="Line Height"
              value={getValue('lineHeight', 1.2) as number}
              onChange={(lineHeight) => onChange({ lineHeight })}
              min={0.5} max={5} step={0.1}
              bindAdornment={<BindButton nodeId={nodeId} bindingKey="lineHeight" objectId={objectId} />}
              disabled={isBound('lineHeight')}
              inputClassName={leftBorderClass('lineHeight')}
            />
          </div>
          <div>
            <NumberField
              label="Letter Spacing (px)"
              value={getValue('letterSpacing', 0) as number}
              onChange={(letterSpacing) => onChange({ letterSpacing })}
              min={-5} max={20} step={0.1}
              bindAdornment={<BindButton nodeId={nodeId} bindingKey="letterSpacing" objectId={objectId} />}
              disabled={isBound('letterSpacing')}
              inputClassName={leftBorderClass('letterSpacing')}
            />
          </div>
        </div>
        {/* Badges for Layout & Spacing Row */}
        <div className="grid grid-cols-2 gap-[var(--space-3)] text-[10px] text-[var(--text-tertiary)]">
          <div className="flex items-center gap-[var(--space-1)]">
            {isOverridden('textAlign') && !isBound('textAlign') && <TextStyleOverrideBadge nodeId={nodeId} keyName="textAlign" objectId={objectId} />}
            <TextStyleBindingBadge nodeId={nodeId} keyName="textAlign" objectId={objectId} />
          </div>
          <div className="flex items-center gap-[var(--space-1)]">
            {isOverridden('textBaseline') && !isBound('textBaseline') && <TextStyleOverrideBadge nodeId={nodeId} keyName="textBaseline" objectId={objectId} />}
            <TextStyleBindingBadge nodeId={nodeId} keyName="textBaseline" objectId={objectId} />
          </div>
          <div className="flex items-center gap-[var(--space-1)]">
            {isOverridden('direction') && !isBound('direction') && <TextStyleOverrideBadge nodeId={nodeId} keyName="direction" objectId={objectId} />}
            <TextStyleBindingBadge nodeId={nodeId} keyName="direction" objectId={objectId} />
          </div>
          <div className="flex items-center gap-[var(--space-1)]">
            {isOverridden('lineHeight') && !isBound('lineHeight') && <TextStyleOverrideBadge nodeId={nodeId} keyName="lineHeight" objectId={objectId} />}
            <TextStyleBindingBadge nodeId={nodeId} keyName="lineHeight" objectId={objectId} />
          </div>
          <div className="flex items-center gap-[var(--space-1)]">
            {isOverridden('letterSpacing') && !isBound('letterSpacing') && <TextStyleOverrideBadge nodeId={nodeId} keyName="letterSpacing" objectId={objectId} />}
            <TextStyleBindingBadge nodeId={nodeId} keyName="letterSpacing" objectId={objectId} />
          </div>
        </div>
      </div>

      {/* Text Effects */}
      <div className="space-y-[var(--space-3)]">
        <div className="text-sm font-medium text-[var(--text-primary)]">Text Effects</div>
        <div className="space-y-[var(--space-3)]">
          <div>
            <ColorField 
              label="Shadow Color" 
              value={getStringValue('shadowColor', '#000000')} 
              onChange={(shadowColor) => onChange({ shadowColor })}
              bindAdornment={<BindButton nodeId={nodeId} bindingKey="shadowColor" objectId={objectId} />}
              disabled={isBound('shadowColor')}
              inputClassName={leftBorderClass('shadowColor')}
            />
          </div>
          <div className="grid grid-cols-3 gap-[var(--space-2)]">
            <div>
              <NumberField 
                label="Shadow X" 
                value={getValue('shadowOffsetX', 0) as number} 
                onChange={(shadowOffsetX) => onChange({ shadowOffsetX })}
                min={-20} max={20} step={1}
                bindAdornment={<BindButton nodeId={nodeId} bindingKey="shadowOffsetX" objectId={objectId} />}
                disabled={isBound('shadowOffsetX')}
                inputClassName={leftBorderClass('shadowOffsetX')}
              />
            </div>
            <div>
              <NumberField 
                label="Shadow Y" 
                value={getValue('shadowOffsetY', 0) as number} 
                onChange={(shadowOffsetY) => onChange({ shadowOffsetY })}
                min={-20} max={20} step={1}
                bindAdornment={<BindButton nodeId={nodeId} bindingKey="shadowOffsetY" objectId={objectId} />}
                disabled={isBound('shadowOffsetY')}
                inputClassName={leftBorderClass('shadowOffsetY')}
              />
            </div>
            <div>
              <NumberField 
                label="Shadow Blur" 
                value={getValue('shadowBlur', 0) as number} 
                onChange={(shadowBlur) => onChange({ shadowBlur })}
                min={0} max={20} step={1}
                bindAdornment={<BindButton nodeId={nodeId} bindingKey="shadowBlur" objectId={objectId} />}
                disabled={isBound('shadowBlur')}
                inputClassName={leftBorderClass('shadowBlur')}
              />
            </div>
          </div>
          <div>
            <NumberField 
              label="Text Opacity" 
              value={getValue('textOpacity', 1) as number} 
              onChange={(textOpacity) => onChange({ textOpacity })}
              min={0} max={1} step={0.05}
              bindAdornment={<BindButton nodeId={nodeId} bindingKey="textOpacity" objectId={objectId} />}
              disabled={isBound('textOpacity')}
              inputClassName={leftBorderClass('textOpacity')}
            />
          </div>
        </div>
        {/* Badges for Text Effects Row */}
        <div className="grid grid-cols-2 gap-[var(--space-2)] text-[10px] text-[var(--text-tertiary)]">
          <div className="flex items-center gap-[var(--space-1)]">
            {isOverridden('shadowColor') && !isBound('shadowColor') && <TextStyleOverrideBadge nodeId={nodeId} keyName="shadowColor" objectId={objectId} />}
            <TextStyleBindingBadge nodeId={nodeId} keyName="shadowColor" objectId={objectId} />
          </div>
          <div className="flex items-center gap-[var(--space-1)]">
            {isOverridden('shadowOffsetX') && !isBound('shadowOffsetX') && <TextStyleOverrideBadge nodeId={nodeId} keyName="shadowOffsetX" objectId={objectId} />}
            <TextStyleBindingBadge nodeId={nodeId} keyName="shadowOffsetX" objectId={objectId} />
          </div>
          <div className="flex items-center gap-[var(--space-1)]">
            {isOverridden('shadowOffsetY') && !isBound('shadowOffsetY') && <TextStyleOverrideBadge nodeId={nodeId} keyName="shadowOffsetY" objectId={objectId} />}
            <TextStyleBindingBadge nodeId={nodeId} keyName="shadowOffsetY" objectId={objectId} />
          </div>
          <div className="flex items-center gap-[var(--space-1)]">
            {isOverridden('shadowBlur') && !isBound('shadowBlur') && <TextStyleOverrideBadge nodeId={nodeId} keyName="shadowBlur" objectId={objectId} />}
            <TextStyleBindingBadge nodeId={nodeId} keyName="shadowBlur" objectId={objectId} />
          </div>
          <div className="flex items-center gap-[var(--space-1)]">
            {isOverridden('textOpacity') && !isBound('textOpacity') && <TextStyleOverrideBadge nodeId={nodeId} keyName="textOpacity" objectId={objectId} />}
            <TextStyleBindingBadge nodeId={nodeId} keyName="textOpacity" objectId={objectId} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Main Editor Component
export function TextStyleEditorTab({ nodeId }: { nodeId: string }) {
	const { state, updateUI, updateFlow } = useWorkspace();

	// Find the TextStyle node in the workspace and its current assignments
	const textStyleNode = useMemo(() => state.flow.nodes.find(n => n.data?.identifier?.id === nodeId) as Node<TextStyleNodeData> | undefined, [state.flow.nodes, nodeId]);
	const assignments: PerObjectAssignments = useMemo(() => textStyleNode?.data?.perObjectAssignments ?? {}, [textStyleNode]);

	// Use enhanced object detection that understands duplication
	const upstreamObjects = useMemo(() => {
		const tracker = new FlowTracker();
		
		// Use duplicate-aware method to find all text objects
		const objectDescriptors = tracker.getUpstreamObjects(nodeId, state.flow.nodes, state.flow.edges);
		
		// Filter for text objects only and convert to display format expected by SelectionList
		return objectDescriptors
			.filter(obj => obj.type === 'text')
			.map(obj => ({
				data: {
					identifier: {
						id: obj.id,
						displayName: obj.displayName,
						type: obj.type
					}
				},
				type: obj.type
			}));
	}, [nodeId, state.flow.nodes, state.flow.edges]);

	// Log for debugging
	React.useEffect(() => {
		console.log(`[TextStyle] Detected ${upstreamObjects.length} text objects for TextStyle node ${nodeId}:`, 
			upstreamObjects.map(o => ({
				id: o.data.identifier.id,
				name: o.data.identifier.displayName,
				type: o.data.identifier.type
			}))
		);
	}, [upstreamObjects, nodeId]);

	const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

	const handleUpdateAssignment = useCallback((updates: Record<string, unknown>) => {
		if (!selectedObjectId) return;
		const next: PerObjectAssignments = { ...assignments };
		const current: ObjectAssignments = { ...(next[selectedObjectId] ?? {}) } as ObjectAssignments;
		const baseInitial = (current.initial ?? {}) as Record<string, unknown>;
		const mergedInitial: Record<string, unknown> = { ...baseInitial, ...updates };
		
		// Deep-merge any nested objects if needed (TextStyle doesn't have nested objects like position/scale)
		const cleanedInitial = Object.fromEntries(Object.entries(mergedInitial).filter(([_, v]) => v !== undefined));
		current.initial = cleanedInitial;
		next[selectedObjectId] = current;
		updateFlow({
			nodes: state.flow.nodes.map((n) => {
				if (n.data?.identifier?.id !== nodeId) return n;
				return { ...n, data: { ...n.data, perObjectAssignments: next } };
			})
		});
	}, [assignments, selectedObjectId, state.flow.nodes, nodeId, updateFlow]);

	const handleClearAssignment = useCallback(() => {
		if (!selectedObjectId) return;
		const next: PerObjectAssignments = { ...assignments };
		delete next[selectedObjectId];
		updateFlow({
			nodes: state.flow.nodes.map((n) => {
				if (n.data?.identifier?.id !== nodeId) return n;
				return { ...n, data: { ...n.data, perObjectAssignments: next } };
			})
		});
	}, [assignments, selectedObjectId, state.flow.nodes, nodeId, updateFlow]);

	return (
		<div className="h-full flex">
			{/* Left Sidebar - Text Object Selection */}
			<div className="w-[var(--sidebar-width)] border-r border-[var(--border-primary)] p-[var(--space-3)] bg-[var(--surface-1)]">
				<div className="space-y-[var(--space-3)]">
					<SelectionList
						mode="single"
						items={upstreamObjects.map(o => ({ 
							id: o.data.identifier.id, 
							label: o.data.identifier.displayName 
						}))}
						selectedId={selectedObjectId}
						onSelect={setSelectedObjectId}
						showDefault={true}
						defaultLabel="Default"
						emptyLabel="No text objects detected"
					/>
					
					{/* Show object count for debugging */}
					<div className="text-xs text-[var(--text-tertiary)] border-t border-[var(--border-primary)] pt-[var(--space-2)]">
						Detected: {upstreamObjects.length} text object{upstreamObjects.length !== 1 ? 's' : ''}
					</div>
				</div>
			</div>

			{/* Main Content Area */}
			<div className="flex-1 flex flex-col">
				{/* Header */}
				<div className="h-12 px-4 border-b border-[var(--border-primary)] flex items-center justify-between bg-[var(--surface-1)]/60">
					<div className="flex items-center gap-3">
						<Type size={16} />
						<div className="text-[var(--text-primary)] font-medium">Text Style</div>
					</div>
					<button className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]" onClick={() => updateUI({ activeTab: 'flow', selectedNodeId: undefined, selectedNodeType: undefined })}>
						Back to Workspace
					</button>
				</div>

				{/* Content */}
				<div className="flex-1 p-[var(--space-4)]">
					<div className="h-full w-full flex items-center justify-center text-[var(--text-tertiary)]">
						No timeline for TextStyle. Select Default or a text object on the left to edit its properties.
					</div>
				</div>
			</div>

			{/* Right Sidebar - Properties */}
			<div className="w-[var(--sidebar-width)] border-l border-[var(--border-primary)] p-[var(--space-4)] bg-[var(--surface-1)] overflow-y-auto">
				<h3 className="text-lg font-semibold text-[var(--text-primary)] mb-[var(--space-4)]">Properties</h3>
				{selectedObjectId ? (
					<TextStylePerObjectProperties
						nodeId={nodeId}
						objectId={selectedObjectId}
						assignments={assignments}
						onChange={handleUpdateAssignment}
						_onClear={handleClearAssignment}
					/>
				) : (
					<TextStyleDefaultProperties nodeId={nodeId} />
				)}
			</div>
		</div>
	);
}
