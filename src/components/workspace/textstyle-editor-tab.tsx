"use client";

import React, { useState, useCallback } from 'react';
import type { Node } from 'reactflow';
import { useWorkspace } from './workspace-context';
import { FlowTracker } from '@/lib/flow/flow-tracking';
import type { TextStyleNodeData } from '@/shared/types/nodes';
import { SelectField, NumberField } from '@/components/ui/form-fields';
import { SelectionList } from '@/components/ui/selection';
import { BindButton, useVariableBinding } from '@/components/workspace/binding/bindings';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import { Badge } from '@/components/ui/badge';
import { Type } from 'lucide-react';

export function TextStyleEditorTab({ nodeId }: { nodeId: string }) {
  const { state, updateFlow } = useWorkspace();
  
  // Variable binding hooks - must be called before any early returns
  const { 
    variables,
    getBinding
  } = useVariableBinding(nodeId);
  
  // State for property editing - must be called before any early returns
  const [localData, setLocalData] = useState<TextStyleNodeData | null>(null);
  
  // Handle property changes - must be called before any early returns
  const handlePropertyChange = useCallback((key: string, value: unknown) => {
    if (!localData) return;
    
    const updated = { ...localData, [key]: value };
    setLocalData(updated);
    
    // Update the node in the flow
    const updatedNodes = state.flow.nodes.map(n => 
      n.data.identifier.id === nodeId 
        ? { ...n, data: updated }
        : n
    );
    updateFlow({ nodes: updatedNodes });
  }, [localData, nodeId, updateFlow, state.flow.nodes]);
  
  const node = state.flow.nodes.find(n => n.data.identifier.id === nodeId) as Node<TextStyleNodeData>;
  
  if (!node) {
    return <div className="h-full w-full flex items-center justify-center text-[var(--text-tertiary)]">Node not found</div>;
  }

  const data = node.data;
  const nodeDefinition = getNodeDefinition('textstyle');
  
  if (!nodeDefinition) {
    return <div className="h-full w-full flex items-center justify-center text-[var(--text-tertiary)]">Node definition not found</div>;
  }
  
  // Initialize local data if not set
  if (!localData) {
    setLocalData(data);
    return <div className="h-full w-full flex items-center justify-center text-[var(--text-tertiary)]">Loading...</div>;
  }

  // Get upstream objects for binding
  const tracker = new FlowTracker();
  const objectDescriptors = tracker.getUpstreamObjects(nodeId, state.flow.nodes, state.flow.edges);

  return (
    <div className="h-full flex">
      {/* Left Sidebar - Text Object Selection */}
      <div className="w-64 bg-[var(--surface-1)] border-r border-[var(--border-primary)] p-4">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Text Objects</h3>
          <div className="text-xs text-[var(--text-secondary)] mb-3">
            Select objects to apply individual text styling
          </div>
        </div>
        
        <SelectionList
          items={objectDescriptors.map(obj => ({
            id: obj.id,
            label: obj.displayName
          }))}
          mode="multi"
          selectedIds={[]}
          onToggle={() => { /* TODO: Implement selection handling */ }}
        />
      </div>

      {/* Main Content - Text Style Editor */}
      <div className="flex-1 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
              Text Style Configuration
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Configure typography settings for text objects
            </p>
          </div>

          {/* Global Text Style Properties */}
          <div className="space-y-4 mb-8">
            <h3 className="text-lg font-medium text-[var(--text-primary)] flex items-center gap-2">
              <Type size={16} />
              Global Text Style
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <SelectField
                label="Font Family"
                value={localData.fontFamily || 'Arial'}
                onChange={(value) => handlePropertyChange('fontFamily', value)}
                options={[
                  { value: 'Arial', label: 'Arial' },
                  { value: 'Helvetica', label: 'Helvetica' },
                  { value: 'Times New Roman', label: 'Times New Roman' },
                  { value: 'Courier New', label: 'Courier New' },
                  { value: 'Georgia', label: 'Georgia' },
                  { value: 'Verdana', label: 'Verdana' }
                ]}
                bindAdornment={
                  <BindButton 
                    nodeId={nodeId} 
                    bindingKey="fontFamily"
                  />
                }
              />

              <SelectField
                label="Font Weight"
                value={localData.fontWeight || 'normal'}
                onChange={(value) => handlePropertyChange('fontWeight', value)}
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
                bindAdornment={
                  <BindButton 
                    nodeId={nodeId} 
                    bindingKey="fontWeight"
                  />
                }
              />

              <SelectField
                label="Text Alignment"
                value={localData.textAlign || 'center'}
                onChange={(value) => handlePropertyChange('textAlign', value)}
                options={[
                  { value: 'left', label: 'Left' },
                  { value: 'center', label: 'Center' },
                  { value: 'right', label: 'Right' },
                  { value: 'justify', label: 'Justify' }
                ]}
                bindAdornment={
                  <BindButton 
                    nodeId={nodeId} 
                    bindingKey="textAlign"
                  />
                }
              />

              <NumberField
                label="Line Height"
                value={localData.lineHeight || 1.2}
                onChange={(value) => handlePropertyChange('lineHeight', value)}
                min={0.5}
                max={5}
                step={0.1}
                bindAdornment={
                  <BindButton 
                    nodeId={nodeId} 
                    bindingKey="lineHeight"
                  />
                }
              />

              <NumberField
                label="Letter Spacing (px)"
                value={localData.letterSpacing || 0}
                onChange={(value) => handlePropertyChange('letterSpacing', value)}
                min={-5}
                max={20}
                step={0.1}
                bindAdornment={
                  <BindButton 
                    nodeId={nodeId} 
                    bindingKey="letterSpacing"
                  />
                }
              />
            </div>
          </div>

          {/* Variable Binding Status */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-[var(--text-primary)] mb-3">Variable Bindings</h3>
            <div className="grid grid-cols-2 gap-4">
              {variables.map((variable) => (
                <div key={variable.id} className="flex items-center gap-2">
                  <Badge variant="default" className="text-xs">
                    {variable.name}: {getBinding(variable.name) ? 'Bound' : 'Unbound'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Object-Specific Overrides */}
      <div className="w-80 bg-[var(--surface-1)] border-l border-[var(--border-primary)] p-4">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Object Overrides</h3>
          <div className="text-xs text-[var(--text-secondary)]">
            Apply individual styling to specific text objects
          </div>
        </div>
        
        {/* TODO: Implement object-specific override UI */}
        <div className="text-xs text-[var(--text-tertiary)]">
          Object-specific overrides coming soon...
        </div>
      </div>
    </div>
  );
}
