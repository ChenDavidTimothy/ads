"use client";

import React, { useMemo, useState, useCallback } from 'react';
import type { Node, Edge } from 'reactflow';
import { useWorkspace } from './workspace-context';
import { FlowTracker } from '@/lib/flow/flow-tracking';
import type { NodeData } from '@/shared/types/nodes';
import type { PerObjectAssignments, ObjectAssignments } from '@/shared/properties/assignments';
import { NumberField, ColorField } from '@/components/ui/form-fields';
import { SelectionList } from '@/components/ui/selection';
import { Link as LinkIcon } from 'lucide-react';
import { BindButton, useVariableBinding } from '@/components/workspace/binding/bindings';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import { Badge } from '@/components/ui/badge';

function CanvasBindingBadge({ nodeId, keyName, objectId }: { nodeId: string; keyName: string; objectId?: string }) {
	const { state } = useWorkspace();
	const { resetToDefault } = useVariableBinding(nodeId, objectId);
	
	const node = state.flow.nodes.find(n => (n as any)?.data?.identifier?.id === nodeId) as any;
	if (!node) return null;
	let bound: string | undefined;
	if (objectId) {
		bound = (node?.data?.variableBindingsByObject?.[objectId]?.[keyName]?.boundResultNodeId) as string | undefined;
	} else {
		bound = (node?.data?.variableBindings?.[keyName]?.boundResultNodeId) as string | undefined;
	}
	if (!bound) return null;
	const name = state.flow.nodes.find(n => (n as any).data?.identifier?.id === bound)?.data?.identifier?.displayName as string | undefined;
	
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
	const canvasNode = useMemo(() => state.flow.nodes.find(n => (n as any)?.data?.identifier?.id === nodeId) as any, [state.flow.nodes, nodeId]);
	const assignments: PerObjectAssignments = (canvasNode?.data?.perObjectAssignments as PerObjectAssignments) ?? {};

	// NEW: Use enhanced object detection that understands duplication
	const upstreamObjects = useMemo(() => {
		const tracker = new FlowTracker();
		
		// Use new duplicate-aware method
		const objectDescriptors = tracker.getUpstreamObjects(nodeId, state.flow.nodes as unknown as any[], state.flow.edges as any[]);
		
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
		current.initial = cleanedInitial as any;
		next[selectedObjectId] = current;
		updateFlow({
			nodes: state.flow.nodes.map((n) => {
				if (((n as any)?.data?.identifier?.id) !== nodeId) return n;
				return { ...n, data: { ...(n as any).data, perObjectAssignments: next } } as unknown as typeof n;
			})
		});
	}, [assignments, selectedObjectId, state.flow.nodes, nodeId, updateFlow]);

	const handleClearAssignment = useCallback(() => {
		if (!selectedObjectId) return;
		const next: PerObjectAssignments = { ...assignments };
		delete next[selectedObjectId];
		updateFlow({
			nodes: state.flow.nodes.map((n) => {
				if (((n as any)?.data?.identifier?.id) !== nodeId) return n;
				return { ...n, data: { ...(n as any).data, perObjectAssignments: next } } as unknown as typeof n;
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
						onClear={handleClearAssignment}
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
	const node = state.flow.nodes.find(n => (n as any)?.data?.identifier?.id === nodeId) as any;
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
	const posX = (data.position?.x as number) ?? (def.position?.x as number) ?? 0;
	const posY = (data.position?.y as number) ?? (def.position?.y as number) ?? 0;
	const scaleX = (data.scale?.x as number) ?? (def.scale?.x as number) ?? 1;
	const scaleY = (data.scale?.y as number) ?? (def.scale?.y as number) ?? 1;
	const rotation = (data.rotation as number) ?? (def.rotation as number) ?? 0;
	const opacity = (data.opacity as number) ?? (def.opacity as number) ?? 1;
	const fillColor = (data.fillColor as string) ?? (def.fillColor as string) ?? '';
	const strokeColor = (data.strokeColor as string) ?? (def.strokeColor as string) ?? '';
	const strokeWidth = (data.strokeWidth as number) ?? (def.strokeWidth as number) ?? 1;

	const isBound = (key: string) => !!bindings?.[key]?.boundResultNodeId;
	const leftBorderClass = (key: string) => (isBound(key) ? 'border-l-2 border-[var(--accent-secondary)]' : '');

	return (
		<div className="space-y-[var(--space-3)]">
			<div className="grid grid-cols-2 gap-[var(--space-2)]">
				<div>
					<label className="block text-xs text-[var(--text-tertiary)]">Position X</label>
					<NumberField label="" value={posX} onChange={(x) => updateFlow({ nodes: state.flow.nodes.map(n => ((n as any).data?.identifier?.id) !== nodeId ? n : ({ ...n, data: { ...(n as any).data, position: { ...(n as any).data?.position, x } } } as any)) })} defaultValue={0} bindAdornment={<BindButton nodeId={nodeId} bindingKey="position.x" />} disabled={isBound('position.x')} inputClassName={leftBorderClass('position.x')} />
				</div>
				<div>
					<label className="block text-xs text-[var(--text-tertiary)]">Position Y</label>
					<NumberField label="" value={posY} onChange={(y) => updateFlow({ nodes: state.flow.nodes.map(n => ((n as any).data?.identifier?.id) !== nodeId ? n : ({ ...n, data: { ...(n as any).data, position: { ...(n as any).data?.position, y } } } as any)) })} defaultValue={0} bindAdornment={<BindButton nodeId={nodeId} bindingKey="position.y" />} disabled={isBound('position.y')} inputClassName={leftBorderClass('position.y')} />
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
					<NumberField label="" value={scaleX} onChange={(x) => updateFlow({ nodes: state.flow.nodes.map(n => ((n as any).data?.identifier?.id) !== nodeId ? n : ({ ...n, data: { ...(n as any).data, scale: { ...(n as any).data?.scale, x } } } as any)) })} defaultValue={1} min={0} step={0.1} bindAdornment={<BindButton nodeId={nodeId} bindingKey="scale.x" />} disabled={isBound('scale.x')} inputClassName={leftBorderClass('scale.x')} />
				</div>
				<div>
					<label className="block text-xs text-[var(--text-tertiary)]">Scale Y</label>
					<NumberField label="" value={scaleY} onChange={(y) => updateFlow({ nodes: state.flow.nodes.map(n => ((n as any).data?.identifier?.id) !== nodeId ? n : ({ ...n, data: { ...(n as any).data, scale: { ...(n as any).data?.scale, y } } } as any)) })} defaultValue={1} min={0} step={0.1} bindAdornment={<BindButton nodeId={nodeId} bindingKey="scale.y" />} disabled={isBound('scale.y')} inputClassName={leftBorderClass('scale.y')} />
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
					<NumberField label="" value={rotation} onChange={(rotation) => updateFlow({ nodes: state.flow.nodes.map(n => ((n as any).data?.identifier?.id) !== nodeId ? n : ({ ...n, data: { ...(n as any).data, rotation } } as any)) })} step={0.1} defaultValue={0} bindAdornment={<BindButton nodeId={nodeId} bindingKey="rotation" />} disabled={isBound('rotation')} inputClassName={leftBorderClass('rotation')} />
				</div>
				<div>
					<label className="block text-xs text-[var(--text-tertiary)]">Opacity</label>
					<NumberField label="" value={opacity} onChange={(opacity) => updateFlow({ nodes: state.flow.nodes.map(n => ((n as any).data?.identifier?.id) !== nodeId ? n : ({ ...n, data: { ...(n as any).data, opacity } } as any)) })} min={0} max={1} step={0.05} defaultValue={1} bindAdornment={<BindButton nodeId={nodeId} bindingKey="opacity" />} disabled={isBound('opacity')} inputClassName={leftBorderClass('opacity')} />
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
			<div className="grid grid-cols-3 gap-[var(--space-2)] items-end">
				<div>
					<ColorField label="Fill" value={fillColor} onChange={(fillColor) => updateFlow({ nodes: state.flow.nodes.map(n => ((n as any).data?.identifier?.id) !== nodeId ? n : ({ ...n, data: { ...(n as any).data, fillColor } } as any)) })} bindAdornment={<BindButton nodeId={nodeId} bindingKey="fillColor" />} disabled={isBound('fillColor')} inputClassName={leftBorderClass('fillColor')} />
				</div>
				<div>
					<ColorField label="Stroke" value={strokeColor} onChange={(strokeColor) => updateFlow({ nodes: state.flow.nodes.map(n => ((n as any).data?.identifier?.id) !== nodeId ? n : ({ ...n, data: { ...(n as any).data, strokeColor } } as any)) })} bindAdornment={<BindButton nodeId={nodeId} bindingKey="strokeColor" />} disabled={isBound('strokeColor')} inputClassName={leftBorderClass('strokeColor')} />
				</div>
				<div>
					<NumberField label="Stroke W" value={strokeWidth} onChange={(strokeWidth) => updateFlow({ nodes: state.flow.nodes.map(n => ((n as any).data?.identifier?.id) !== nodeId ? n : ({ ...n, data: { ...(n as any).data, strokeWidth } } as any)) })} min={0} step={0.5} defaultValue={1} bindAdornment={<BindButton nodeId={nodeId} bindingKey="strokeWidth" />} disabled={isBound('strokeWidth')} inputClassName={leftBorderClass('strokeWidth')} />
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
		</div>
	);
}

function CanvasPerObjectProperties({ nodeId, objectId, assignments, onChange, onClear }: {
	nodeId: string;
	objectId: string;
	assignments: PerObjectAssignments;
	onChange: (updates: Record<string, unknown>) => void;
	onClear: () => void;
}) {
	const { state } = useWorkspace();
	const node = state.flow.nodes.find(n => (n as any)?.data?.identifier?.id === nodeId) as any;
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
		const vbAll = (node?.data?.variableBindingsByObject ?? {}) as Record<string, Record<string, { boundResultNodeId?: string }>>;
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
			case 'position.x': return (initial.position?.x as number) ?? (base.position?.x as number) ?? (def.position?.x as number) ?? fallbackValue;
			case 'position.y': return (initial.position?.y as number) ?? (base.position?.y as number) ?? (def.position?.y as number) ?? fallbackValue;
			case 'scale.x': return (initial.scale?.x as number) ?? (base.scale?.x as number) ?? (def.scale?.x as number) ?? fallbackValue;
			case 'scale.y': return (initial.scale?.y as number) ?? (base.scale?.y as number) ?? (def.scale?.y as number) ?? fallbackValue;
			case 'rotation': return (initial.rotation as number) ?? (base.rotation as number) ?? (def.rotation as number) ?? fallbackValue;
			case 'opacity': return (initial.opacity as number) ?? (base.opacity as number) ?? (def.opacity as number) ?? fallbackValue;
			case 'fillColor': return (initial.fillColor as string) ?? (base.fillColor as string) ?? (def.fillColor as string) ?? fallbackValue;
			case 'strokeColor': return (initial.strokeColor as string) ?? (base.strokeColor as string) ?? (def.strokeColor as string) ?? fallbackValue;
			case 'strokeWidth': return (initial.strokeWidth as number) ?? (base.strokeWidth as number) ?? (def.strokeWidth as number) ?? fallbackValue;
			default: return fallbackValue;
		}
	};

	// Helper to get string value for color fields - empty string if bound
	const getStringValue = (key: string, fallbackValue: string) => {
		if (isBound(key)) return ''; // Empty string when bound
		
		switch (key) {
			case 'fillColor': return (initial.fillColor as string) ?? (base.fillColor as string) ?? (def.fillColor as string) ?? fallbackValue;
			case 'strokeColor': return (initial.strokeColor as string) ?? (base.strokeColor as string) ?? (def.strokeColor as string) ?? fallbackValue;
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
		</div>
	);
}