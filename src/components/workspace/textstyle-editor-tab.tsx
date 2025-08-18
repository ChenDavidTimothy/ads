"use client";

import React, { useMemo, useState, useCallback } from 'react';
import type { Node } from 'reactflow';
import { useWorkspace } from './workspace-context';
import { FlowTracker } from '@/lib/flow/flow-tracking';
import type { TextStyleNodeData } from '@/shared/types/nodes';
import type { PerObjectAssignments, ObjectAssignments } from '@/shared/properties/assignments';
import { SelectField, NumberField } from '@/components/ui/form-fields';
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



// Default Properties Component (Center Panel)
function TextStyleDefaultProperties({ nodeId }: { nodeId: string }) {
	const { state, updateFlow } = useWorkspace();
	const node = state.flow.nodes.find(n => n.data?.identifier?.id === nodeId) as Node<TextStyleNodeData> | undefined;
	const data = (node?.data ?? {}) as Record<string, unknown> & {
		fontFamily?: string;
		fontWeight?: string;
		textAlign?: string;
		lineHeight?: number;
		letterSpacing?: number;
		variableBindings?: Record<string, { target?: string; boundResultNodeId?: string }>;
	};
	const bindings = (data.variableBindings ?? {}) as Record<string, { target?: string; boundResultNodeId?: string }>;

	const def = (getNodeDefinition('textstyle')?.defaults as Record<string, unknown> & {
		fontFamily?: string;
		fontWeight?: string;
		textAlign?: string;
		lineHeight?: number;
		letterSpacing?: number;
	}) ?? {};

	const fontFamily = data.fontFamily ?? def.fontFamily ?? 'Arial';
	const fontWeight = data.fontWeight ?? def.fontWeight ?? 'normal';
	const textAlign = data.textAlign ?? def.textAlign ?? 'center';
	const lineHeight = data.lineHeight ?? def.lineHeight ?? 1.2;
	const letterSpacing = data.letterSpacing ?? def.letterSpacing ?? 0;

	const isBound = (key: string) => !!bindings[key]?.boundResultNodeId;
	const leftBorderClass = (key: string) => (
		isBound(key) ? 'border-l-2 border-[var(--accent-secondary)]' : ''
	);

	return (
		<div className="space-y-[var(--space-4)]">
			<div className="text-sm font-medium text-[var(--text-primary)] mb-[var(--space-3)]">
				Global Text Style Defaults
			</div>
			<div className="space-y-[var(--space-4)]">
				{/* Typography */}
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
					</div>
				</div>

				{/* Alignment and Spacing */}
				<div className="space-y-[var(--space-3)]">
					<div className="text-sm font-medium text-[var(--text-primary)]">Alignment & Spacing</div>
					<div className="grid grid-cols-1 gap-[var(--space-3)]">
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
							<NumberField
								label="Line Height"
								value={lineHeight}
								onChange={(lineHeight) => updateFlow({ nodes: state.flow.nodes.map(n => n.data?.identifier?.id !== nodeId ? n : ({ ...n, data: { ...n.data, lineHeight } })) })}
								min={0.5}
								max={5}
								step={0.1}
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
								min={-5}
								max={20}
								step={0.1}
								bindAdornment={<BindButton nodeId={nodeId} bindingKey="letterSpacing" />}
								disabled={isBound('letterSpacing')}
								inputClassName={leftBorderClass('letterSpacing')}
							/>
						</div>
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
					<TextStyleBindingBadge nodeId={nodeId} keyName="textAlign" />
				</div>
				<div className="flex items-center gap-[var(--space-1)]">
					<TextStyleBindingBadge nodeId={nodeId} keyName="lineHeight" />
				</div>
				<div className="flex items-center gap-[var(--space-1)]">
					<TextStyleBindingBadge nodeId={nodeId} keyName="letterSpacing" />
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
		fontFamily?: string;
		fontWeight?: string;
		textAlign?: string;
		lineHeight?: number;
		letterSpacing?: number;
	};

	const def = (getNodeDefinition('textstyle')?.defaults as Record<string, unknown> & {
		fontFamily?: string;
		fontWeight?: string;
		textAlign?: string;
		lineHeight?: number;
		letterSpacing?: number;
	}) ?? {};
	const base = (node?.data ?? {}) as Record<string, unknown> & {
		fontFamily?: string;
		fontWeight?: string;
		textAlign?: string;
		lineHeight?: number;
		letterSpacing?: number;
	};

	const isBound = (key: string) => {
		const vbAll = node?.data?.variableBindingsByObject ?? {};
		return !!vbAll?.[objectId]?.[key]?.boundResultNodeId;
	};

	const fontFamily = initial.fontFamily ?? base.fontFamily ?? def.fontFamily ?? 'Arial';
	const fontWeight = initial.fontWeight ?? base.fontWeight ?? def.fontWeight ?? 'normal';
	const textAlign = initial.textAlign ?? base.textAlign ?? def.textAlign ?? 'center';
	const lineHeight = initial.lineHeight ?? base.lineHeight ?? def.lineHeight ?? 1.2;
	const letterSpacing = initial.letterSpacing ?? base.letterSpacing ?? def.letterSpacing ?? 0;

	const leftBorderClass = (key: string) => (
		isBound(key) ? 'border-l-2 border-[var(--accent-secondary)]' : ''
	);

	return (
		<div className="space-y-[var(--space-4)]">
			<div className="text-sm font-medium text-[var(--text-primary)] mb-[var(--space-3)]">
				Per-Object Text Style Overrides
			</div>
			<div className="space-y-[var(--space-4)]">
				{/* Typography */}
				<div className="space-y-[var(--space-3)]">
					<div className="text-sm font-medium text-[var(--text-primary)]">Typography</div>
					<div className="grid grid-cols-2 gap-[var(--space-3)]">
						<div>
							<SelectField
								label="Font Family"
								value={fontFamily}
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
								value={fontWeight}
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
					</div>
				</div>

				{/* Alignment and Spacing */}
				<div className="space-y-[var(--space-3)]">
					<div className="text-sm font-medium text-[var(--text-primary)]">Alignment & Spacing</div>
					<div className="grid grid-cols-1 gap-[var(--space-3)]">
						<div>
							<SelectField
								label="Text Alignment"
								value={textAlign}
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
							<NumberField
								label="Line Height"
								value={lineHeight}
								onChange={(lineHeight) => onChange({ lineHeight })}
								min={0.5}
								max={5}
								step={0.1}
								bindAdornment={<BindButton nodeId={nodeId} bindingKey="lineHeight" objectId={objectId} />}
								disabled={isBound('lineHeight')}
								inputClassName={leftBorderClass('lineHeight')}
							/>
						</div>
						<div>
							<NumberField
								label="Letter Spacing (px)"
								value={letterSpacing}
								onChange={(letterSpacing) => onChange({ letterSpacing })}
								min={-5}
								max={20}
								step={0.1}
								bindAdornment={<BindButton nodeId={nodeId} bindingKey="letterSpacing" objectId={objectId} />}
								disabled={isBound('letterSpacing')}
								inputClassName={leftBorderClass('letterSpacing')}
							/>
						</div>
					</div>
				</div>
			</div>

			{/* Binding Status Badges */}
			<div className="grid grid-cols-2 gap-[var(--space-2)] text-[10px] text-[var(--text-tertiary)]">
				<div className="flex items-center gap-[var(--space-1)]">
					<TextStyleBindingBadge nodeId={nodeId} keyName="fontFamily" objectId={objectId} />
				</div>
				<div className="flex items-center gap-[var(--space-1)]">
					<TextStyleBindingBadge nodeId={nodeId} keyName="fontWeight" objectId={objectId} />
				</div>
				<div className="flex items-center gap-[var(--space-1)]">
					<TextStyleBindingBadge nodeId={nodeId} keyName="textAlign" objectId={objectId} />
				</div>
				<div className="flex items-center gap-[var(--space-1)]">
					<TextStyleBindingBadge nodeId={nodeId} keyName="lineHeight" objectId={objectId} />
				</div>
				<div className="flex items-center gap-[var(--space-1)]">
					<TextStyleBindingBadge nodeId={nodeId} keyName="letterSpacing" objectId={objectId} />
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
