"use client";

import React, { useMemo } from 'react';
import { NumberField, ColorField, SelectField } from '@/components/ui/form-fields';
import { BindButton } from '@/components/workspace/binding/bindings';
import { useWorkspace } from '@/components/workspace/workspace-context';
import { 
  isFieldOverridden, 
  isFieldBound, 
  getEffectiveValue, 
  type GranularOverrides 
} from '@/shared/properties/granular-assignments';

interface UnifiedPropertyFieldProps {
  nodeId: string;
  objectId?: string;
  fieldPath: string;
  label: string;
  type: 'number' | 'color' | 'select';
  defaultValue: any;
  overrides?: GranularOverrides;
  onOverrideChange: (fieldPath: string, value: any) => void;
  // Number field specific
  min?: number;
  max?: number;
  step?: number;
  // Select field specific
  options?: Array<{ value: string; label: string }>;
  className?: string;
}

interface BindingInfo {
  isBound: boolean;
  boundNodeName?: string;
  boundValue?: any;
}

function useBindingInfo(nodeId: string, objectId: string | undefined, fieldPath: string): BindingInfo {
  const { state } = useWorkspace();
  
  return useMemo(() => {
    const node = state.flow.nodes.find(n => (n as any).data?.identifier?.id === nodeId) as any;
    if (!node) return { isBound: false };
    
    const bindings = objectId 
      ? (node?.data?.variableBindingsByObject?.[objectId] ?? {})
      : (node?.data?.variableBindings ?? {});
      
    const boundNodeId = bindings[fieldPath]?.boundResultNodeId;
    if (!boundNodeId) return { isBound: false };
    
    const boundNode = state.flow.nodes.find(n => (n as any).data?.identifier?.id === boundNodeId) as any;
    const boundNodeName = boundNode?.data?.identifier?.displayName;
    
    // TODO: Get actual bound value from execution context
    const boundValue = undefined; // Will be implemented when we have execution context
    
    return {
      isBound: true,
      boundNodeName,
      boundValue
    };
  }, [state.flow.nodes, nodeId, objectId, fieldPath]);
}

export function UnifiedPropertyField({
  nodeId,
  objectId,
  fieldPath,
  label,
  type,
  defaultValue,
  overrides,
  onOverrideChange,
  min,
  max,
  step,
  options,
  className
}: UnifiedPropertyFieldProps) {
  const bindingInfo = useBindingInfo(nodeId, objectId, fieldPath);
  const isOverridden = isFieldOverridden(overrides, fieldPath);
  const effectiveValue = getEffectiveValue(fieldPath, overrides, undefined, undefined, defaultValue);
  
  // Create display label with override/binding indicators
  const displayLabel = useMemo(() => {
    const indicators = [];
    if (bindingInfo.isBound) indicators.push('bound');
    if (isOverridden) indicators.push('override');
    
    return indicators.length > 0 ? `${label} (${indicators.join(', ')})` : label;
  }, [label, bindingInfo.isBound, isOverridden]);
  
  const handleChange = (value: any) => {
    onOverrideChange(fieldPath, value);
  };
  
  const bindAdornment = (
    <BindButton 
      nodeId={nodeId} 
      bindingKey={fieldPath} 
      objectId={objectId}
    />
  );
  
  const commonProps = {
    label: displayLabel,
    value: effectiveValue,
    onChange: handleChange,
    bindAdornment,
    className
  };
  
  // Render binding info
  const bindingTag = bindingInfo.isBound && bindingInfo.boundNodeName && (
    <div className="text-[10px] text-[var(--text-tertiary)] mt-1">
      Bound to: {bindingInfo.boundNodeName}
    </div>
  );
  
  const fieldComponent = (() => {
    switch (type) {
      case 'number':
        return (
          <NumberField
            {...commonProps}
            defaultValue={defaultValue}
            min={min}
            max={max}
            step={step}
          />
        );
      case 'color':
        return (
          <ColorField
            {...commonProps}
          />
        );
      case 'select':
        return (
          <SelectField
            {...commonProps}
            options={options || []}
          />
        );
      default:
        return null;
    }
  })();
  
  return (
    <div>
      {fieldComponent}
      {bindingTag}
    </div>
  );
}

// Specialized components for common property groups
interface PositionFieldsProps {
  nodeId: string;
  objectId?: string;
  overrides?: GranularOverrides;
  onOverrideChange: (fieldPath: string, value: any) => void;
  defaultX?: number;
  defaultY?: number;
}

export function PositionFields({ 
  nodeId, 
  objectId, 
  overrides, 
  onOverrideChange, 
  defaultX = 0, 
  defaultY = 0 
}: PositionFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-[var(--space-2)]">
      <UnifiedPropertyField
        nodeId={nodeId}
        objectId={objectId}
        fieldPath="position.x"
        label="Position X"
        type="number"
        defaultValue={defaultX}
        overrides={overrides}
        onOverrideChange={onOverrideChange}
      />
      <UnifiedPropertyField
        nodeId={nodeId}
        objectId={objectId}
        fieldPath="position.y"
        label="Position Y"
        type="number"
        defaultValue={defaultY}
        overrides={overrides}
        onOverrideChange={onOverrideChange}
      />
    </div>
  );
}

interface ScaleFieldsProps {
  nodeId: string;
  objectId?: string;
  overrides?: GranularOverrides;
  onOverrideChange: (fieldPath: string, value: any) => void;
  defaultX?: number;
  defaultY?: number;
}

export function ScaleFields({ 
  nodeId, 
  objectId, 
  overrides, 
  onOverrideChange, 
  defaultX = 1, 
  defaultY = 1 
}: ScaleFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-[var(--space-2)]">
      <UnifiedPropertyField
        nodeId={nodeId}
        objectId={objectId}
        fieldPath="scale.x"
        label="Scale X"
        type="number"
        defaultValue={defaultX}
        overrides={overrides}
        onOverrideChange={onOverrideChange}
        min={0}
        step={0.1}
      />
      <UnifiedPropertyField
        nodeId={nodeId}
        objectId={objectId}
        fieldPath="scale.y"
        label="Scale Y"
        type="number"
        defaultValue={defaultY}
        overrides={overrides}
        onOverrideChange={onOverrideChange}
        min={0}
        step={0.1}
      />
    </div>
  );
}

interface MoveTrackFieldsProps {
  nodeId: string;
  objectId?: string;
  trackId: string;
  overrides?: GranularOverrides;
  onOverrideChange: (fieldPath: string, value: any) => void;
  defaultFromX?: number;
  defaultFromY?: number;
  defaultToX?: number;
  defaultToY?: number;
}

export function MoveTrackFields({ 
  nodeId, 
  objectId, 
  trackId, 
  overrides, 
  onOverrideChange,
  defaultFromX = 0,
  defaultFromY = 0,
  defaultToX = 100,
  defaultToY = 100
}: MoveTrackFieldsProps) {
  return (
    <div className="space-y-[var(--space-3)]">
      <div className="text-sm font-medium text-[var(--text-primary)]">Move Properties</div>
      <div className="grid grid-cols-2 gap-[var(--space-2)]">
        <UnifiedPropertyField
          nodeId={nodeId}
          objectId={objectId}
          fieldPath={`track.${trackId}.from.x`}
          label="From X"
          type="number"
          defaultValue={defaultFromX}
          overrides={overrides}
          onOverrideChange={onOverrideChange}
        />
        <UnifiedPropertyField
          nodeId={nodeId}
          objectId={objectId}
          fieldPath={`track.${trackId}.from.y`}
          label="From Y"
          type="number"
          defaultValue={defaultFromY}
          overrides={overrides}
          onOverrideChange={onOverrideChange}
        />
        <UnifiedPropertyField
          nodeId={nodeId}
          objectId={objectId}
          fieldPath={`track.${trackId}.to.x`}
          label="To X"
          type="number"
          defaultValue={defaultToX}
          overrides={overrides}
          onOverrideChange={onOverrideChange}
        />
        <UnifiedPropertyField
          nodeId={nodeId}
          objectId={objectId}
          fieldPath={`track.${trackId}.to.y`}
          label="To Y"
          type="number"
          defaultValue={defaultToY}
          overrides={overrides}
          onOverrideChange={onOverrideChange}
        />
      </div>
    </div>
  );
}