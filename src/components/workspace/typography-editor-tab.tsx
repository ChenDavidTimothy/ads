"use client";

import React, { useMemo, useState, useCallback } from 'react';
import type { Node } from 'reactflow';
import { useWorkspace } from './workspace-context';
import { FlowTracker } from '@/lib/flow/flow-tracking';
import type { TypographyNodeData } from '@/shared/types/nodes';
import type { PerObjectAssignments, ObjectAssignments } from '@/shared/properties/assignments';
import { SelectField, NumberField, ColorField, TextareaField } from '@/components/ui/form-fields';
import { SelectionList } from '@/components/ui/selection';
import { BindButton, useVariableBinding } from '@/components/workspace/binding/bindings';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import { Badge } from '@/components/ui/badge';
import { Type } from 'lucide-react';

// Badge Components
function TypographyBindingBadge({ nodeId, keyName, objectId }: { nodeId: string; keyName: string; objectId?: string }) {
	const { state } = useWorkspace();
	const { resetToDefault } = useVariableBinding(nodeId, objectId);
	
	const node = state.flow.nodes.find(n => n.data?.identifier?.id === nodeId) as Node<TypographyNodeData> | undefined;
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

function TypographyOverrideBadge({ nodeId, keyName, objectId }: { nodeId: string; keyName: string; objectId?: string }) {
	const { resetToDefault } = useVariableBinding(nodeId, objectId);
	
	return <Badge variant="manual" onRemove={() => resetToDefault(keyName)}>Manual</Badge>;
}


// Default Properties Component (Center Panel)
function TypographyDefaultProperties({ nodeId }: { nodeId: string }) {
  const { state, updateFlow } = useWorkspace();
  const node = state.flow.nodes.find(n => n.data?.identifier?.id === nodeId) as Node<TypographyNodeData> | undefined;
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
  const bindings = (data.variableBindings ?? {}) as Record<string, { target?: string; boundResultNodeId?: string }>;

  const def = (getNodeDefinition('typography')?.defaults as Record<string, unknown> & {
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
  
  // Helper to get value for bound fields - blank if bound, normal value if not
  const getValue = function<T>(key: string, defaultValue: T): T | undefined {
    if (isBound(key)) return undefined; // Blank when bound
    return (data[key] as T) ?? defaultValue;
  };
  
  const leftBorderClass = (key: string) => (
    isBound(key) ? 'border-l-2 border-[var(--accent-secondary)]' : ''
  );

  return (
    <div className="space-y-[var(--space-4)]">
      <div className="text-sm font-medium text-[var(--text-primary)] mb-[var(--space-3)]">
        Global Typography Defaults
      </div>
      
      {/* ADD Content Section as FIRST section */}
      <div className="space-y-[var(--space-3)]">
        <div className="text-sm font-medium text-[var(--text-primary)]">Content</div>
        <div>
          <TextareaField
            label="Text Content"
            value={getValue('content', 'Sample Text') ?? 'Sample Text'} 
            onChange={(content) => updateFlow({ 
              nodes: state.flow.nodes.map(n => 
                n.data?.identifier?.id !== nodeId ? n : 
                ({ ...n, data: { ...n.data, content } })
              ) 
            })}
            rows={4}
            bindAdornment={<BindButton nodeId={nodeId} bindingKey="content" />}
            disabled={isBound('content')}
            inputClassName={leftBorderClass('content')}
          />
          {isBound('content') && (
            <div className="text-[10px] text-[var(--text-tertiary)] mt-[var(--space-1)]">
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
            value={data.fontFamily ?? 'Arial'}
            onChange={(fontFamily) => updateFlow({ nodes: state.flow.nodes.map(n => n.data?.identifier?.id !== nodeId ? n : ({ ...n, data: { ...n.data, fontFamily } })) })}
            options={[
              { value: 'Arial', label: 'Arial' },
              { value: 'Helvetica', label: 'Helvetica' },
              { value: 'Times New Roman', label: 'Times New Roman' },
              { value: 'Courier New', label: 'Courier New' },
              { value: 'Georgia', label: 'Georgia' },
              { value: 'Verdana', label: 'Verdana' }
            ]}
          />
        </div>

        {/* Typography Row 2 - Font Size */}
        <div>
          <NumberField
            label="Font Size (px)"
            value={getValue('fontSize', 24)}
            onChange={(fontSize) => updateFlow({ nodes: state.flow.nodes.map(n => n.data?.identifier?.id !== nodeId ? n : ({ ...n, data: { ...n.data, fontSize } })) })}
            min={8} max={200} step={1}
            bindAdornment={<BindButton nodeId={nodeId} bindingKey="fontSize" />}
            disabled={isBound('fontSize')}
            inputClassName={leftBorderClass('fontSize')}
          />
          {/* Badge - Only show when needed */}
          {isBound('fontSize') && (
            <div className="text-[10px] text-[var(--text-tertiary)] mt-[var(--space-1)]">
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
            value={data.fontWeight ?? 'normal'}
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
          />
        </div>

        {/* Typography Row 3 - Font Style */}
        <div>
          <SelectField
            label="Font Style"
            value={data.fontStyle ?? 'normal'}
            onChange={(fontStyle) => updateFlow({ nodes: state.flow.nodes.map(n => n.data?.identifier?.id !== nodeId ? n : ({ ...n, data: { ...n.data, fontStyle } })) })}
            options={[
              { value: 'normal', label: 'Normal' },
              { value: 'italic', label: 'Italic' },
              { value: 'oblique', label: 'Oblique' }
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
              value={getValue('fillColor', '#000000') ?? '#000000'} 
              onChange={(fillColor) => updateFlow({ nodes: state.flow.nodes.map(n => n.data?.identifier?.id !== nodeId ? n : ({ ...n, data: { ...n.data, fillColor } })) })}
              bindAdornment={<BindButton nodeId={nodeId} bindingKey="fillColor" />}
              disabled={isBound('fillColor')}
            />
            {/* Badge - Only show when bound */}
            {isBound('fillColor') && (
              <div className="text-[10px] text-[var(--text-tertiary)] mt-[var(--space-1)]">
                <div className="flex items-center gap-[var(--space-1)]">
                  <TypographyBindingBadge nodeId={nodeId} keyName="fillColor" />
                </div>
              </div>
            )}
          </div>
          <div>
            <ColorField 
              label="Stroke Color" 
              value={getValue('strokeColor', '#ffffff') ?? '#ffffff'} 
              onChange={(strokeColor) => updateFlow({ nodes: state.flow.nodes.map(n => n.data?.identifier?.id !== nodeId ? n : ({ ...n, data: { ...n.data, strokeColor } })) })}
              bindAdornment={<BindButton nodeId={nodeId} bindingKey="strokeColor" />}
              disabled={isBound('strokeColor')}
            />
            {/* Badge - Only show when bound */}
            {isBound('strokeColor') && (
              <div className="text-[10px] text-[var(--text-tertiary)] mt-[var(--space-1)]">
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
            value={getValue('strokeWidth', 0)} 
            onChange={(strokeWidth) => updateFlow({ nodes: state.flow.nodes.map(n => n.data?.identifier?.id !== nodeId ? n : ({ ...n, data: { ...n.data, strokeWidth } })) })}
            min={0} max={10} step={0.1}
            bindAdornment={<BindButton nodeId={nodeId} bindingKey="strokeWidth" />}
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

// Per-Object Properties Component (Right Panel)
function TypographyPerObjectProperties({ nodeId, objectId, assignments, onChange, _onClear }: {
  nodeId: string;
  objectId: string;
  assignments: PerObjectAssignments;
  onChange: (updates: Record<string, unknown>) => void;
  _onClear: () => void;
}) {
  const { state } = useWorkspace();
  const node = state.flow.nodes.find(n => n.data?.identifier?.id === nodeId) as Node<TypographyNodeData> | undefined;
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

  const def = (getNodeDefinition('typography')?.defaults as Record<string, unknown> & {
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
      case 'content': return initial.content !== undefined;
      case 'fontFamily': return initial.fontFamily !== undefined;
      case 'fontSize': return initial.fontSize !== undefined;
      case 'fontWeight': return initial.fontWeight !== undefined;
      case 'fontStyle': return initial.fontStyle !== undefined;
      case 'fillColor': return initial.fillColor !== undefined;
      case 'strokeColor': return initial.strokeColor !== undefined;
      case 'strokeWidth': return initial.strokeWidth !== undefined;
      default: return false;
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

  const leftBorderClass = (key: string) => (
    isBound(key) ? 'border-l-2 border-[var(--accent-secondary)]' : 
    (isOverridden(key) ? 'border-l-2 border-[var(--warning-600)]' : '')
  );

  // Helper functions for bound fields
  const getValue = (key: string, fallbackValue: number | string) => {
    if (isBound(key)) return undefined; // Blank when bound
    
    switch (key) {
      case 'content': return initial.content ?? base.content ?? def.content ?? fallbackValue;
      case 'fontFamily': return fontFamily;
      case 'fontSize': return fontSize;
      case 'fontWeight': return fontWeight;
      case 'fontStyle': return fontStyle;
      case 'fillColor': return fillColor;
      case 'strokeColor': return strokeColor;
      case 'strokeWidth': return strokeWidth;
      default: return fallbackValue;
    }
  };

  const getStringValue = (key: string, fallbackValue: string) => {
    switch (key) {
      case 'content': return initial.content ?? base.content ?? def.content ?? fallbackValue;
      case 'fontFamily': return initial.fontFamily ?? base.fontFamily ?? def.fontFamily ?? fallbackValue;
      case 'fontWeight': return initial.fontWeight ?? base.fontWeight ?? def.fontWeight ?? fallbackValue;
      case 'fontStyle': return initial.fontStyle ?? base.fontStyle ?? def.fontStyle ?? fallbackValue;
      case 'fillColor': return initial.fillColor ?? base.fillColor ?? def.fillColor ?? fallbackValue;
      case 'strokeColor': return initial.strokeColor ?? base.strokeColor ?? def.strokeColor ?? fallbackValue;
      default: return fallbackValue;
    }
  };

  return (
    <div className="space-y-[var(--space-4)]">
      <div className="text-sm font-medium text-[var(--text-primary)] mb-[var(--space-3)]">
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
            bindAdornment={<BindButton nodeId={nodeId} bindingKey="content" objectId={objectId} />}
            disabled={isBound('content')}
            inputClassName={leftBorderClass('content')}
          />
          {(isOverridden('content') || isBound('content')) && (
            <div className="text-[10px] text-[var(--text-tertiary)] mt-[var(--space-1)]">
              <div className="flex items-center gap-[var(--space-1)]">
                {isOverridden('content') && !isBound('content') && <TypographyOverrideBadge nodeId={nodeId} keyName="content" objectId={objectId} />}
                <TypographyBindingBadge nodeId={nodeId} keyName="content" objectId={objectId} />
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
              { value: 'Verdana', label: 'Verdana' }
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
            min={8} max={200} step={1}
            bindAdornment={<BindButton nodeId={nodeId} bindingKey="fontSize" objectId={objectId} />}
            disabled={isBound('fontSize')}
            inputClassName={leftBorderClass('fontSize')}
          />
          {/* Badge - Only show when needed */}
          {(isOverridden('fontSize') || isBound('fontSize')) && (
            <div className="text-[10px] text-[var(--text-tertiary)] mt-[var(--space-1)]">
              <div className="flex items-center gap-[var(--space-1)]">
                {isOverridden('fontSize') && !isBound('fontSize') && <TypographyOverrideBadge nodeId={nodeId} keyName="fontSize" objectId={objectId} />}
                <TypographyBindingBadge nodeId={nodeId} keyName="fontSize" objectId={objectId} />
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
              { value: '900', label: 'Black (900)' }
            ]}
          />
          {/* Badge - Only show when overridden */}
          {isOverridden('fontWeight') && (
            <div className="text-[10px] text-[var(--text-tertiary)] mt-[var(--space-1)]">
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
              { value: 'oblique', label: 'Oblique' }
            ]}
          />
          {/* Badge - Only show when overridden */}
          {isOverridden('fontStyle') && (
            <div className="text-[10px] text-[var(--text-tertiary)] mt-[var(--space-1)]">
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
              value={isBound('fillColor') ? (base.fillColor ?? def.fillColor ?? '#000000') : getStringValue('fillColor', '#000000')} 
              onChange={(fillColor) => onChange({ fillColor })}
              bindAdornment={<BindButton nodeId={nodeId} bindingKey="fillColor" objectId={objectId} />}
              disabled={isBound('fillColor')}
            />
            {/* Badge - Show when overridden or bound */}
            {(isOverridden('fillColor') || isBound('fillColor')) && (
              <div className="text-[10px] text-[var(--text-tertiary)] mt-[var(--space-1)]">
                <div className="flex items-center gap-[var(--space-1)]">
                  {isOverridden('fillColor') && !isBound('fillColor') && <TypographyOverrideBadge nodeId={nodeId} keyName="fillColor" objectId={objectId} />}
                  <TypographyBindingBadge nodeId={nodeId} keyName="fillColor" objectId={objectId} />
                </div>
              </div>
            )}
          </div>
          <div>
            <ColorField 
              label="Stroke Color" 
              value={isBound('strokeColor') ? (base.strokeColor ?? def.strokeColor ?? '#ffffff') : getStringValue('strokeColor', '#ffffff')} 
              onChange={(strokeColor) => onChange({ strokeColor })}
              bindAdornment={<BindButton nodeId={nodeId} bindingKey="strokeColor" objectId={objectId} />}
              disabled={isBound('strokeColor')}
            />
            {/* Badge - Show when overridden or bound */}
            {(isOverridden('strokeColor') || isBound('strokeColor')) && (
              <div className="text-[10px] text-[var(--text-tertiary)] mt-[var(--space-1)]">
                <div className="flex items-center gap-[var(--space-1)]">
                  {isOverridden('strokeColor') && !isBound('strokeColor') && <TypographyOverrideBadge nodeId={nodeId} keyName="strokeColor" objectId={objectId} />}
                  <TypographyBindingBadge nodeId={nodeId} keyName="strokeColor" objectId={objectId} />
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
            min={0} max={10} step={0.1}
            bindAdornment={<BindButton nodeId={nodeId} bindingKey="strokeWidth" objectId={objectId} />}
            disabled={isBound('strokeWidth')}
            inputClassName={leftBorderClass('strokeWidth')}
          />
          {/* Badge - Only show when needed */}
          {(isOverridden('strokeWidth') || isBound('strokeWidth')) && (
            <div className="text-[10px] text-[var(--text-tertiary)] mt-[var(--space-1)]">
              <div className="flex items-center gap-[var(--space-1)]">
                {isOverridden('strokeWidth') && !isBound('strokeWidth') && <TypographyOverrideBadge nodeId={nodeId} keyName="strokeWidth" objectId={objectId} />}
                <TypographyBindingBadge nodeId={nodeId} keyName="strokeWidth" objectId={objectId} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Main Editor Component
export function TypographyEditorTab({ nodeId }: { nodeId: string }) {
	const { state, updateUI, updateFlow } = useWorkspace();

	// Find the Typography node in the workspace and its current assignments
	const typographyNode = useMemo(() => state.flow.nodes.find(n => n.data?.identifier?.id === nodeId) as Node<TypographyNodeData> | undefined, [state.flow.nodes, nodeId]);
	const assignments: PerObjectAssignments = useMemo(() => typographyNode?.data?.perObjectAssignments ?? {}, [typographyNode]);

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
		console.log(`[Typography] Detected ${upstreamObjects.length} text objects for Typography node ${nodeId}:`, 
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
		
		// Deep-merge any nested objects if needed (Typography doesn't have nested objects like position/scale)
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
				<div className="h-[var(--header-height)] px-[var(--space-4)] border-b border-[var(--border-primary)] flex items-center justify-between bg-[var(--surface-1)]/60">
					<div className="flex items-center gap-3">
						<Type size={16} />
						<div className="text-[var(--text-primary)] font-medium">Typography</div>
					</div>
					<button className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]" onClick={() => updateUI({ activeTab: 'flow', selectedNodeId: undefined, selectedNodeType: undefined })}>
						Back to Workspace
					</button>
				</div>

				{/* Content */}
				<div className="flex-1 p-[var(--space-4)]">
					<div className="h-full w-full flex items-center justify-center text-[var(--text-tertiary)]">
						No timeline for Typography. Select Default or a text object on the left to edit its properties.
					</div>
				</div>
			</div>

			{/* Right Sidebar - Properties */}
			<div className="w-[var(--sidebar-width)] border-l border-[var(--border-primary)] p-[var(--space-4)] bg-[var(--surface-1)] overflow-y-auto">
				<h3 className="text-lg font-semibold text-[var(--text-primary)] mb-[var(--space-4)]">Properties</h3>
				{selectedObjectId ? (
					<TypographyPerObjectProperties
						nodeId={nodeId}
						objectId={selectedObjectId}
						assignments={assignments}
						onChange={handleUpdateAssignment}
						_onClear={handleClearAssignment}
					/>
				) : (
					<TypographyDefaultProperties nodeId={nodeId} />
				)}
			</div>
		</div>
	);
}
