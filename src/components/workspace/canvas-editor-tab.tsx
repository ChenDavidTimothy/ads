"use client";

import React, { useMemo, useState, useCallback } from 'react';
import type { Node } from 'reactflow';
import { useWorkspace } from './workspace-context';
import { FlowTracker } from '@/lib/flow/flow-tracking';
import type { CanvasNodeData } from '@/shared/types/nodes';
import type { PerObjectAssignments, ObjectAssignments } from '@/shared/properties/assignments';
import { NumberField, ColorField } from '@/components/ui/form-fields';
import { SelectionList } from '@/components/ui/selection';
import { BindButton, useVariableBinding } from '@/components/workspace/binding/bindings';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import { Badge } from '@/components/ui/badge';

function CanvasBindingBadge({ nodeId, keyName, objectId }: { nodeId: string; keyName: string; objectId?: string }) {
	const { state } = useWorkspace();
	const { resetToDefault } = useVariableBinding(nodeId, objectId);
	
	const node = state.flow.nodes.find(n => n.data?.identifier?.id === nodeId) as Node<CanvasNodeData> | undefined;
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

function OverrideBadge({ nodeId, keyName, objectId }: { nodeId: string; keyName: string; objectId?: string }) {
	const { resetToDefault } = useVariableBinding(nodeId, objectId);
	
	return <Badge variant="manual" onRemove={() => resetToDefault(keyName)}>Manual</Badge>;
}

export function CanvasEditorTab({ nodeId }: { nodeId: string }) {
	const { state, updateUI, updateFlow } = useWorkspace();

	// Find the canvas node in the workspace and its current assignments
	const canvasNode = useMemo(() => state.flow.nodes.find(n => n.data?.identifier?.id === nodeId) as Node<CanvasNodeData> | undefined, [state.flow.nodes, nodeId]);
	const assignments: PerObjectAssignments = useMemo(() => canvasNode?.data?.perObjectAssignments ?? {}, [canvasNode]);

	// NEW: Use enhanced object detection that understands duplication
	const upstreamObjects = useMemo(() => {
		const tracker = new FlowTracker();
		
		// Use new duplicate-aware method
		const objectDescriptors = tracker.getUpstreamObjects(nodeId, state.flow.nodes, state.flow.edges);
		
		// Convert to display format expected by SelectionList
		return objectDescriptors.map(obj => ({
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

	// ADD: Type composition detection using existing FlowTracker pattern
	// const upstreamObjectTypes = useMemo(() => {
	// 	const tracker = new FlowTracker();
	// 	const objectDescriptors = tracker.getUpstreamObjects(nodeId, state.flow.nodes, state.flow.edges);
	// 	return {
	// 		hasText: objectDescriptors.some(obj => obj.type === 'text'),
	// 		hasGeometry: objectDescriptors.some(obj => ['triangle', 'circle', 'rectangle'].includes(obj.type)),
	// 		allText: objectDescriptors.length > 0 && objectDescriptors.every(obj => obj.type === 'text'),
	// 		isEmpty: objectDescriptors.length === 0,
	// 		objectTypes: objectDescriptors.map(obj => obj.type)
	// 	};
	// }, [nodeId, state.flow.nodes, state.flow.edges]);

	// Log for debugging
	React.useEffect(() => {
		console.log(`[Canvas] Detected ${upstreamObjects.length} objects for canvas node ${nodeId}:`, 
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
		// Deep-merge position/scale if both sides provide partials
		if (typeof baseInitial.position === 'object' && baseInitial.position !== null && typeof updates.position === 'object' && updates.position !== null) {
			mergedInitial.position = { ...(baseInitial.position as Record<string, unknown>), ...(updates.position as Record<string, unknown>) };
		}
		if (typeof baseInitial.scale === 'object' && baseInitial.scale !== null && typeof updates.scale === 'object' && updates.scale !== null) {
			mergedInitial.scale = { ...(baseInitial.scale as Record<string, unknown>), ...(updates.scale as Record<string, unknown>) };
		}
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
			{/* Left Sidebar - Object Selection */}
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
						emptyLabel="No upstream objects detected"
					/>
					
					{/* NEW: Show object count for debugging */}
					<div className="text-xs text-[var(--text-tertiary)] border-t border-[var(--border-primary)] pt-[var(--space-2)]">
						Detected: {upstreamObjects.length} object{upstreamObjects.length !== 1 ? 's' : ''}
					</div>
				</div>
			</div>

			{/* Main Content Area */}
			<div className="flex-1 flex flex-col">
				{/* Header */}
				<div className="h-12 px-4 border-b border-[var(--border-primary)] flex items-center justify-between bg-[var(--surface-1)]/60">
					<div className="flex items-center gap-3">
						<div className="text-[var(--text-primary)] font-medium">Canvas</div>
					</div>
					<button className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]" onClick={() => updateUI({ activeTab: 'flow', selectedNodeId: undefined, selectedNodeType: undefined })}>
						Back to Workspace
					</button>
				</div>

				{/* Canvas Content */}
				<div className="flex-1 p-[var(--space-4)]">
					<div className="h-full w-full flex items-center justify-center text-[var(--text-tertiary)]">
						No timeline for Canvas. Select Default or an object on the left to edit its properties.
					</div>
				</div>
			</div>

			{/* Right Sidebar - Properties */}
			<div className="w-[var(--sidebar-width)] border-l border-[var(--border-primary)] p-[var(--space-4)] bg-[var(--surface-1)] overflow-y-auto">
				<h3 className="text-lg font-semibold text-[var(--text-primary)] mb-[var(--space-4)]">Properties</h3>
				{selectedObjectId ? (
					<CanvasPerObjectProperties
						nodeId={nodeId}
						objectId={selectedObjectId}
						assignments={assignments}
						onChange={handleUpdateAssignment}
						_onClear={handleClearAssignment}
					/>
				) : (
					<CanvasDefaultProperties nodeId={nodeId} />
				)}
			</div>
		</div>
	);
}

function CanvasDefaultProperties({ nodeId }: { nodeId: string }) {
	const { state, updateFlow } = useWorkspace();
	const node = state.flow.nodes.find(n => n.data?.identifier?.id === nodeId) as Node<CanvasNodeData> | undefined;
	
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
	const bindings = (data.variableBindings ?? {}) as Record<string, { target?: string; boundResultNodeId?: string }>;

	const def = (getNodeDefinition('canvas')?.defaults as Record<string, unknown> & {
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
		const objectDescriptors = tracker.getUpstreamObjects(nodeId, state.flow.nodes, state.flow.edges);
		return {
			allText: objectDescriptors.length > 0 && objectDescriptors.every(obj => obj.type === 'text'),
			isEmpty: objectDescriptors.length === 0
		};
	}, [nodeId, state.flow.nodes, state.flow.edges]);

	// EXISTING: All helper functions unchanged
	const isBound = (key: string) => !!bindings?.[key]?.boundResultNodeId;
	const leftBorderClass = (key: string) => (isBound(key) ? 'border-l-2 border-[var(--accent-secondary)]' : '');

	return (
		<div className="space-y-[var(--space-3)]">
			<div className="grid grid-cols-2 gap-[var(--space-2)]">
				<div>
					<label className="block text-xs text-[var(--text-tertiary)]">Position X</label>
					<NumberField label="" value={posX} onChange={(x) => updateFlow({ nodes: state.flow.nodes.map(n => n.data?.identifier?.id !== nodeId ? n : ({ ...n, data: { ...(n.data as CanvasNodeData), position: { ...(n.data as CanvasNodeData)?.position, x } } })) })} defaultValue={0} bindAdornment={<BindButton nodeId={nodeId} bindingKey="position.x" />} disabled={isBound('position.x')} inputClassName={leftBorderClass('position.x')} />
				</div>
				<div>
					<label className="block text-xs text-[var(--text-tertiary)]">Position Y</label>
					<NumberField label="" value={posY} onChange={(y) => updateFlow({ nodes: state.flow.nodes.map(n => n.data?.identifier?.id !== nodeId ? n : ({ ...n, data: { ...(n.data as CanvasNodeData), position: { ...(n.data as CanvasNodeData)?.position, y } } })) })} defaultValue={0} bindAdornment={<BindButton nodeId={nodeId} bindingKey="position.y" />} disabled={isBound('position.y')} inputClassName={leftBorderClass('position.y')} />
				</div>
			</div>
			<div className="grid grid-cols-2 gap-[var(--space-2)] text-[10px] text-[var(--text-tertiary)]">
				<div className="flex items-center gap-[var(--space-1)]">
					<CanvasBindingBadge nodeId={nodeId} keyName="position.x" />
				</div>
				<div className="flex items-center gap-[var(--space-1)]">
					<CanvasBindingBadge nodeId={nodeId} keyName="position.y" />
				</div>
			</div>
			<div className="grid grid-cols-2 gap-[var(--space-2)]">
				<div>
					<label className="block text-xs text-[var(--text-tertiary)]">Scale X</label>
					<NumberField label="" value={scaleX} onChange={(x) => updateFlow({ nodes: state.flow.nodes.map(n => n.data?.identifier?.id !== nodeId ? n : ({ ...n, data: { ...(n.data as CanvasNodeData), scale: { ...(n.data as CanvasNodeData)?.scale, x } } })) })} defaultValue={1} min={0} step={0.1} bindAdornment={<BindButton nodeId={nodeId} bindingKey="scale.x" />} disabled={isBound('scale.x')} inputClassName={leftBorderClass('scale.x')} />
				</div>
				<div>
					<label className="block text-xs text-[var(--text-tertiary)]">Scale Y</label>
					<NumberField label="" value={scaleY} onChange={(y) => updateFlow({ nodes: state.flow.nodes.map(n => n.data?.identifier?.id !== nodeId ? n : ({ ...n, data: { ...(n.data as CanvasNodeData), scale: { ...(n.data as CanvasNodeData)?.scale, y } } })) })} defaultValue={1} min={0} step={0.1} bindAdornment={<BindButton nodeId={nodeId} bindingKey="scale.y" />} disabled={isBound('scale.y')} inputClassName={leftBorderClass('scale.y')} />
				</div>
			</div>
			<div className="grid grid-cols-2 gap-[var(--space-2)] text-[10px] text-[var(--text-tertiary)]">
				<div className="flex items-center gap-[var(--space-1)]">
					<CanvasBindingBadge nodeId={nodeId} keyName="scale.x" />
				</div>
				<div className="flex items-center gap-[var(--space-1)]">
					<CanvasBindingBadge nodeId={nodeId} keyName="scale.y" />
				</div>
			</div>
			<div className="grid grid-cols-2 gap-[var(--space-2)]">
				<div>
					<label className="block text-xs text-[var(--text-tertiary)]">Rotation</label>
					<NumberField label="" value={rotation} onChange={(rotation) => updateFlow({ nodes: state.flow.nodes.map(n => n.data?.identifier?.id !== nodeId ? n : ({ ...n, data: { ...n.data, rotation } })) })} step={0.1} defaultValue={0} bindAdornment={<BindButton nodeId={nodeId} bindingKey="rotation" />} disabled={isBound('rotation')} inputClassName={leftBorderClass('rotation')} />
				</div>
				<div>
					<label className="block text-xs text-[var(--text-tertiary)]">Opacity</label>
					<NumberField label="" value={opacity} onChange={(opacity) => updateFlow({ nodes: state.flow.nodes.map(n => n.data?.identifier?.id !== nodeId ? n : ({ ...n, data: { ...n.data, opacity } })) })} min={0} max={1} step={0.05} defaultValue={1} bindAdornment={<BindButton nodeId={nodeId} bindingKey="opacity" />} disabled={isBound('opacity')} inputClassName={leftBorderClass('opacity')} />
				</div>
			</div>
			<div className="grid grid-cols-2 gap-[var(--space-2)] text-[10px] text-[var(--text-tertiary)]">
				<div className="flex items-center gap-[var(--space-1)]">
					<CanvasBindingBadge nodeId={nodeId} keyName="rotation" />
				</div>
				<div className="flex items-center gap-[var(--space-1)]">
					<CanvasBindingBadge nodeId={nodeId} keyName="opacity" />
				</div>
			</div>
			{/* CHANGE: Wrap color properties with conditional rendering */}
			{!upstreamObjectTypes.allText && (
				<>
					<div className="grid grid-cols-3 gap-[var(--space-2)] items-end">
						<div>
							<ColorField label="Fill" value={fillColor} onChange={(fillColor) => updateFlow({ nodes: state.flow.nodes.map(n => n.data?.identifier?.id !== nodeId ? n : ({ ...n, data: { ...n.data, fillColor } })) })} bindAdornment={<BindButton nodeId={nodeId} bindingKey="fillColor" />} disabled={isBound('fillColor')} inputClassName={leftBorderClass('fillColor')} />
						</div>
						<div>
							<ColorField label="Stroke" value={strokeColor} onChange={(strokeColor) => updateFlow({ nodes: state.flow.nodes.map(n => n.data?.identifier?.id !== nodeId ? n : ({ ...n, data: { ...n.data, strokeColor } })) })} bindAdornment={<BindButton nodeId={nodeId} bindingKey="strokeColor" />} disabled={isBound('strokeColor')} inputClassName={leftBorderClass('strokeColor')} />
						</div>
						<div>
							<NumberField label="Stroke W" value={strokeWidth} onChange={(strokeWidth) => updateFlow({ nodes: state.flow.nodes.map(n => n.data?.identifier?.id !== nodeId ? n : ({ ...n, data: { ...n.data, strokeWidth } })) })} min={0} step={0.5} defaultValue={1} bindAdornment={<BindButton nodeId={nodeId} bindingKey="strokeWidth" />} disabled={isBound('strokeWidth')} inputClassName={leftBorderClass('strokeWidth')} />
						</div>
					</div>
					<div className="grid grid-cols-3 gap-[var(--space-2)] text-[10px] text-[var(--text-tertiary)]">
						<div className="flex items-center gap-[var(--space-1)]">
							<CanvasBindingBadge nodeId={nodeId} keyName="fillColor" />
						</div>
						<div className="flex items-center gap-[var(--space-1)]">
							<CanvasBindingBadge nodeId={nodeId} keyName="strokeColor" />
						</div>
						<div className="flex items-center gap-[var(--space-1)]">
							<CanvasBindingBadge nodeId={nodeId} keyName="strokeWidth" />
						</div>
					</div>
				</>
			)}

			{/* ADD: Message when color properties are hidden */}
			{upstreamObjectTypes.allText && (
				<div className="text-xs text-[var(--text-tertiary)] p-3 bg-[var(--surface-2)] rounded border border-[var(--border-primary)]">
					<div className="font-medium mb-1">Color properties disabled</div>
					<div>Use Typography node for text color and stroke styling</div>
				</div>
			)}
		</div>
	);
}

function CanvasPerObjectProperties({ nodeId, objectId, assignments, onChange, _onClear }: {
	nodeId: string;
	objectId: string;
	assignments: PerObjectAssignments;
	onChange: (updates: Record<string, unknown>) => void;
	_onClear: () => void;
}) {
	const { state } = useWorkspace();
	
	// EXISTING: All data resolution unchanged
	const node = state.flow.nodes.find(n => n.data?.identifier?.id === nodeId) as Node<CanvasNodeData> | undefined;
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
		const objectDescriptors = tracker.getUpstreamObjects(nodeId, state.flow.nodes, state.flow.edges);
		const objectDescriptor = objectDescriptors.find(obj => obj.id === objectId);
		return objectDescriptor?.type;
	}, [nodeId, objectId, state.flow.nodes, state.flow.edges]);

	const isTextObject = objectType === 'text';

	// EXISTING: All other resolution logic unchanged
	const def = (getNodeDefinition('canvas')?.defaults as Record<string, unknown> & {
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
	const isOverridden = (key: string) => {
		switch (key) {
			case 'position.x': return initial.position?.x !== undefined;
			case 'position.y': return initial.position?.y !== undefined;
			case 'scale.x': return initial.scale?.x !== undefined;
			case 'scale.y': return initial.scale?.y !== undefined;
			case 'rotation': return initial.rotation !== undefined;
			case 'opacity': return initial.opacity !== undefined;
			case 'fillColor': return initial.fillColor !== undefined;
			case 'strokeColor': return initial.strokeColor !== undefined;
			case 'strokeWidth': return initial.strokeWidth !== undefined;
			default: return false;
		}
	};
	const leftBorderClass = (key: string) => (
		isBound(key) ? 'border-l-2 border-[var(--accent-secondary)]' : (isOverridden(key) ? 'border-l-2 border-[var(--warning-600)]' : '')
	);

	// Helper to get value for bound fields - blank if bound
	const getValue = (key: string, fallbackValue: number | string) => {
		if (isBound(key)) return undefined; // Blank when bound
		
		switch (key) {
			case 'position.x': return initial.position?.x ?? base.position?.x ?? def.position?.x ?? fallbackValue;
			case 'position.y': return initial.position?.y ?? base.position?.y ?? def.position?.y ?? fallbackValue;
			case 'scale.x': return initial.scale?.x ?? base.scale?.x ?? def.scale?.x ?? fallbackValue;
			case 'scale.y': return initial.scale?.y ?? base.scale?.y ?? def.scale?.y ?? fallbackValue;
			case 'rotation': return initial.rotation ?? base.rotation ?? def.rotation ?? fallbackValue;
			case 'opacity': return initial.opacity ?? base.opacity ?? def.opacity ?? fallbackValue;
			case 'fillColor': return initial.fillColor ?? base.fillColor ?? def.fillColor ?? fallbackValue;
			case 'strokeColor': return initial.strokeColor ?? base.strokeColor ?? def.strokeColor ?? fallbackValue;
			case 'strokeWidth': return initial.strokeWidth ?? base.strokeWidth ?? def.strokeWidth ?? fallbackValue;
			default: return fallbackValue;
		}
	};

	// Helper to get string value for color fields - empty string if bound
	const getStringValue = (key: string, fallbackValue: string) => {
		if (isBound(key)) return ''; // Empty string when bound
		
		switch (key) {
			case 'fillColor': return initial.fillColor ?? base.fillColor ?? def.fillColor ?? fallbackValue;
			case 'strokeColor': return initial.strokeColor ?? base.strokeColor ?? def.strokeColor ?? fallbackValue;
			default: return fallbackValue;
		}
	};

	return (
		<div className="space-y-[var(--space-3)]">
			<div className="grid grid-cols-2 gap-[var(--space-2)]">
				<div>
					<label className="block text-xs text-[var(--text-tertiary)]">Position X</label>
					<NumberField label="" value={getValue('position.x', 0)} onChange={(x) => onChange({ position: { x } })} defaultValue={0} 
						bindAdornment={<BindButton nodeId={nodeId} bindingKey="position.x" objectId={objectId} />} disabled={isBound('position.x')} inputClassName={leftBorderClass('position.x')} />
				</div>
				<div>
					<label className="block text-xs text-[var(--text-tertiary)]">Position Y</label>
					<NumberField label="" value={getValue('position.y', 0)} onChange={(y) => onChange({ position: { y } })} defaultValue={0} 
						bindAdornment={<BindButton nodeId={nodeId} bindingKey="position.y" objectId={objectId} />} disabled={isBound('position.y')} inputClassName={leftBorderClass('position.y')} />
				</div>
			</div>
			<div className="grid grid-cols-2 gap-[var(--space-2)] text-[10px] text-[var(--text-tertiary)]">
				<div className="flex items-center gap-[var(--space-1)]">
					{isOverridden('position.x') && !isBound('position.x') && <OverrideBadge nodeId={nodeId} keyName="position.x" objectId={objectId} />}
					<CanvasBindingBadge nodeId={nodeId} keyName="position.x" objectId={objectId} />
				</div>
				<div className="flex items-center gap-[var(--space-1)]">
					{isOverridden('position.y') && !isBound('position.y') && <OverrideBadge nodeId={nodeId} keyName="position.y" objectId={objectId} />}
					<CanvasBindingBadge nodeId={nodeId} keyName="position.y" objectId={objectId} />
				</div>
			</div>

			<div className="grid grid-cols-2 gap-[var(--space-2)]">
				<div>
					<label className="block text-xs text-[var(--text-tertiary)]">Scale X</label>
					<NumberField label="" value={getValue('scale.x', 1)} onChange={(x) => onChange({ scale: { x } })} defaultValue={1} min={0} step={0.1} 
						bindAdornment={<BindButton nodeId={nodeId} bindingKey="scale.x" objectId={objectId} />} disabled={isBound('scale.x')} inputClassName={leftBorderClass('scale.x')} />
				</div>
				<div>
					<label className="block text-xs text-[var(--text-tertiary)]">Scale Y</label>
					<NumberField label="" value={getValue('scale.y', 1)} onChange={(y) => onChange({ scale: { y } })} defaultValue={1} min={0} step={0.1} 
						bindAdornment={<BindButton nodeId={nodeId} bindingKey="scale.y" objectId={objectId} />} disabled={isBound('scale.y')} inputClassName={leftBorderClass('scale.y')} />
				</div>
			</div>
			<div className="grid grid-cols-2 gap-[var(--space-2)] text-[10px] text-[var(--text-tertiary)]">
				<div className="flex items-center gap-[var(--space-1)]">
					{isOverridden('scale.x') && !isBound('scale.x') && <OverrideBadge nodeId={nodeId} keyName="scale.x" objectId={objectId} />}
					<CanvasBindingBadge nodeId={nodeId} keyName="scale.x" objectId={objectId} />
				</div>
				<div className="flex items-center gap-[var(--space-1)]">
					{isOverridden('scale.y') && !isBound('scale.y') && <OverrideBadge nodeId={nodeId} keyName="scale.y" objectId={objectId} />}
					<CanvasBindingBadge nodeId={nodeId} keyName="scale.y" objectId={objectId} />
				</div>
			</div>

			<div className="grid grid-cols-2 gap-[var(--space-2)]">
				<div>
					<label className="block text-xs text-[var(--text-tertiary)]">Rotation</label>
					<NumberField label="" value={getValue('rotation', 0)} onChange={(rotation) => onChange({ rotation })} step={0.1} defaultValue={0} 
						bindAdornment={<BindButton nodeId={nodeId} bindingKey="rotation" objectId={objectId} />} disabled={isBound('rotation')} inputClassName={leftBorderClass('rotation')} />
				</div>
				<div>
					<label className="block text-xs text-[var(--text-tertiary)]">Opacity</label>
					<NumberField label="" value={getValue('opacity', 1)} onChange={(opacity) => onChange({ opacity })} min={0} max={1} step={0.05} defaultValue={1} 
						bindAdornment={<BindButton nodeId={nodeId} bindingKey="opacity" objectId={objectId} />} disabled={isBound('opacity')} inputClassName={leftBorderClass('opacity')} />
				</div>
			</div>
			<div className="grid grid-cols-2 gap-[var(--space-2)] text-[10px] text-[var(--text-tertiary)]">
				<div className="flex items-center gap-[var(--space-1)]">
					{isOverridden('rotation') && !isBound('rotation') && <OverrideBadge nodeId={nodeId} keyName="rotation" objectId={objectId} />}
					<CanvasBindingBadge nodeId={nodeId} keyName="rotation" objectId={objectId} />
				</div>
				<div className="flex items-center gap-[var(--space-1)]">
					{isOverridden('opacity') && !isBound('opacity') && <OverrideBadge nodeId={nodeId} keyName="opacity" objectId={objectId} />}
					<CanvasBindingBadge nodeId={nodeId} keyName="opacity" objectId={objectId} />
				</div>
			</div>

			{/* CHANGE: Conditional color section rendering */}
			{!isTextObject && (
				<>
					<div className="grid grid-cols-3 gap-[var(--space-2)] items-end">
						<div>
							<ColorField label="Fill" value={getStringValue('fillColor', '')} onChange={(fillColor) => onChange({ fillColor })} 
								bindAdornment={<BindButton nodeId={nodeId} bindingKey="fillColor" objectId={objectId} />} disabled={isBound('fillColor')} inputClassName={leftBorderClass('fillColor')} />
						</div>
						<div>
							<ColorField label="Stroke" value={getStringValue('strokeColor', '')} onChange={(strokeColor) => onChange({ strokeColor })} 
								bindAdornment={<BindButton nodeId={nodeId} bindingKey="strokeColor" objectId={objectId} />} disabled={isBound('strokeColor')} inputClassName={leftBorderClass('strokeColor')} />
						</div>
						<div>
							<NumberField label="Stroke W" value={getValue('strokeWidth', 1)} onChange={(strokeWidth) => onChange({ strokeWidth })} min={0} step={0.5} defaultValue={1} 
								bindAdornment={<BindButton nodeId={nodeId} bindingKey="strokeWidth" objectId={objectId} />} disabled={isBound('strokeWidth')} inputClassName={leftBorderClass('strokeWidth')} />
						</div>
					</div>
					<div className="grid grid-cols-3 gap-[var(--space-2)] text-[10px] text-[var(--text-tertiary)]">
						<div className="flex items-center gap-[var(--space-1)]">
							{isOverridden('fillColor') && !isBound('fillColor') && <OverrideBadge nodeId={nodeId} keyName="fillColor" objectId={objectId} />}
							<CanvasBindingBadge nodeId={nodeId} keyName="fillColor" objectId={objectId} />
						</div>
						<div className="flex items-center gap-[var(--space-1)]">
							{isOverridden('strokeColor') && !isBound('strokeColor') && <OverrideBadge nodeId={nodeId} keyName="strokeColor" objectId={objectId} />}
							<CanvasBindingBadge nodeId={nodeId} keyName="strokeColor" objectId={objectId} />
						</div>
						<div className="flex items-center gap-[var(--space-1)]">
							{isOverridden('strokeWidth') && !isBound('strokeWidth') && <OverrideBadge nodeId={nodeId} keyName="strokeWidth" objectId={objectId} />}
							<CanvasBindingBadge nodeId={nodeId} keyName="strokeWidth" objectId={objectId} />
						</div>
					</div>
				</>
			)}

			{/* ADD: Message for text objects */}
			{isTextObject && (
				<div className="text-xs text-[var(--text-tertiary)] p-3 bg-[var(--surface-2)] rounded border border-[var(--border-primary)]">
					<div className="font-medium mb-1">Color properties disabled for text</div>
					<div>Use Typography node for text color and stroke styling</div>
				</div>
			)}
		</div>
	);
}