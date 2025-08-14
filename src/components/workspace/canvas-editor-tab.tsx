"use client";

import React, { useMemo, useState, useCallback } from 'react';
import type { Node, Edge } from 'reactflow';
import { useWorkspace } from './workspace-context';
import { FlowTracker } from '@/lib/flow/flow-tracking';
import type { NodeData } from '@/shared/types/nodes';
import type { PerObjectAssignments, ObjectAssignments } from '@/shared/properties/assignments';
import { NumberField, ColorField } from '@/components/ui/form-fields';
import { EditorShell } from './common/editor-shell';
import { ObjectSelectionPanel } from './common/object-selection-panel';
import { Link as LinkIcon } from 'lucide-react';
import { BindButton } from '@/components/workspace/binding/bindings';

export function CanvasEditorTab({ nodeId }: { nodeId: string }) {
	const { state, updateUI, updateFlow } = useWorkspace();

	// Find the canvas node in the flow and its current assignments
	const canvasNode = useMemo(() => state.flow.nodes.find(n => (n as any)?.data?.identifier?.id === nodeId) as any, [state.flow.nodes, nodeId]);
	const assignments: PerObjectAssignments = (canvasNode?.data?.perObjectAssignments as PerObjectAssignments) ?? {};

	// Compute upstream objects
	const upstreamObjects = useMemo(() => {
		const tracker = new FlowTracker();
		return tracker.getUpstreamGeometryObjects(nodeId, state.flow.nodes as unknown as any[], state.flow.edges as any[]);
	}, [nodeId, state.flow.nodes, state.flow.edges]);

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
		<EditorShell
			title="Canvas"
			left={(
				<div className="w-[var(--sidebar-width)] border-r border-[var(--border-primary)] p-[var(--space-3)] bg-[var(--surface-1)]">
					<div className="space-y-[var(--space-3)]">
						<div>
							<div className="text-xs text-[var(--text-tertiary)] mb-[var(--space-2)]">Default</div>
							<DefaultSelector onClick={() => setSelectedObjectId(null)} active={selectedObjectId === null} />
						</div>
						<div className="pt-[var(--space-3)] border-t border-[var(--border-primary)]">
							<ObjectSelectionPanel
								items={upstreamObjects.map(o => ({ id: o.data.identifier.id, label: o.data.identifier.displayName }))}
								selectedId={selectedObjectId}
								onSelect={(id) => setSelectedObjectId(id)}
								emptyLabel="No upstream objects"
								title="Objects"
							/>
						</div>
					</div>
				</div>
			)}
			center={(
				<div className="flex-1 p-[var(--space-4)]">
					<div className="h-full w-full flex items-center justify-center text-[var(--text-tertiary)]">
						No timeline for Canvas. Select Default or an object on the left to edit its properties.
					</div>
				</div>
			)}
			right={(
				selectedObjectId ? (
					<CanvasPerObjectProperties
						nodeId={nodeId}
						objectId={selectedObjectId}
						assignments={assignments}
						onChange={handleUpdateAssignment}
						onClear={handleClearAssignment}
					/>
				) : (
					<CanvasDefaultProperties nodeId={nodeId} />
				)
			)}
			rightHeader={<h3 className="text-lg font-semibold text-[var(--text-primary)] mb-[var(--space-4)]">Properties</h3>}
			onBack={() => updateUI({ activeTab: 'flow', selectedNodeId: undefined, selectedNodeType: undefined })}
			headerExtras={(
				<div className="flex items-center gap-[var(--space-2)]">
					<span className="text-xs text-[var(--text-tertiary)]">Selection:</span>
					<select
						className="bg-[var(--surface-1)] text-[var(--text-primary)] text-xs px-[var(--space-2)] py-[var(--space-1)] rounded border border-[var(--border-primary)]"
						value={selectedObjectId ?? ''}
						onChange={(e) => setSelectedObjectId(e.target.value || null)}
					>
						<option value="">Default</option>
						{upstreamObjects.map((obj) => (
							<option key={obj.data.identifier.id} value={obj.data.identifier.id}>
								{obj.data.identifier.displayName}
							</option>
						))}
					</select>
				</div>
			)}
		/>
	);
}

function DefaultSelector({ onClick, active }: { onClick: () => void; active: boolean }) {
	return (
		<div
			className={`flex items-center space-x-3 py-[var(--space-1)] px-[var(--space-2)] rounded-[var(--radius-sm)] cursor-pointer ${active ? 'bg-[color:rgba(59,130,246,0.2)]' : 'hover:bg-[var(--surface-interactive)]'}`}
			onClick={onClick}
		>
			<input type="radio" checked={active} readOnly className="rounded" />
			<span className="text-sm text-[var(--text-primary)] truncate flex-1">Default</span>
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

	return (
		<div className="space-y-[var(--space-2)]">
			<div className="grid grid-cols-2 gap-[var(--space-2)]">
				<div>
					<label className="block text-xs text-[var(--text-tertiary)]">Position X</label>
					<NumberField label="" value={(data.position?.x as number) ?? NaN} onChange={(x) => updateFlow({ nodes: state.flow.nodes.map(n => ((n as any).data?.identifier?.id) !== nodeId ? n : ({ ...n, data: { ...(n as any).data, position: { x, y: (data.position?.y ?? 0) } } } as any)) })} defaultValue={0} bindAdornment={<BindButton nodeId={nodeId} bindingKey="position.x" />} />
				</div>
				<div>
					<label className="block text-xs text-[var(--text-tertiary)]">Position Y</label>
					<NumberField label="" value={(data.position?.y as number) ?? NaN} onChange={(y) => updateFlow({ nodes: state.flow.nodes.map(n => ((n as any).data?.identifier?.id) !== nodeId ? n : ({ ...n, data: { ...(n as any).data, position: { x: (data.position?.x ?? 0), y } } } as any)) })} defaultValue={0} bindAdornment={<BindButton nodeId={nodeId} bindingKey="position.y" />} />
				</div>
			</div>
			<div className="grid grid-cols-2 gap-[var(--space-2)]">
				<div>
					<label className="block text-xs text-[var(--text-tertiary)]">Scale X</label>
					<NumberField label="" value={(data.scale?.x as number) ?? NaN} onChange={(x) => updateFlow({ nodes: state.flow.nodes.map(n => ((n as any).data?.identifier?.id) !== nodeId ? n : ({ ...n, data: { ...(n as any).data, scale: { x, y: (data.scale?.y ?? 1) } } } as any)) })} defaultValue={1} min={0} step={0.1} bindAdornment={<BindButton nodeId={nodeId} bindingKey="scale.x" />} />
				</div>
				<div>
					<label className="block text-xs text-[var(--text-tertiary)]">Scale Y</label>
					<NumberField label="" value={(data.scale?.y as number) ?? NaN} onChange={(y) => updateFlow({ nodes: state.flow.nodes.map(n => ((n as any).data?.identifier?.id) !== nodeId ? n : ({ ...n, data: { ...(n as any).data, scale: { x: (data.scale?.x ?? 1), y } } } as any)) })} defaultValue={1} min={0} step={0.1} bindAdornment={<BindButton nodeId={nodeId} bindingKey="scale.y" />} />
				</div>
			</div>
			<div className="grid grid-cols-2 gap-[var(--space-2)]">
				<div>
					<label className="block text-xs text-[var(--text-tertiary)]">Rotation</label>
					<NumberField label="" value={(data.rotation as number) ?? NaN} onChange={(rotation) => updateFlow({ nodes: state.flow.nodes.map(n => ((n as any).data?.identifier?.id) !== nodeId ? n : ({ ...n, data: { ...(n as any).data, rotation } } as any)) })} step={0.1} defaultValue={0} bindAdornment={<BindButton nodeId={nodeId} bindingKey="rotation" />} />
				</div>
				<div>
					<label className="block text-xs text-[var(--text-tertiary)]">Opacity</label>
					<NumberField label="" value={(data.opacity as number) ?? NaN} onChange={(opacity) => updateFlow({ nodes: state.flow.nodes.map(n => ((n as any).data?.identifier?.id) !== nodeId ? n : ({ ...n, data: { ...(n as any).data, opacity } } as any)) })} min={0} max={1} step={0.05} defaultValue={1} bindAdornment={<BindButton nodeId={nodeId} bindingKey="opacity" />} />
				</div>
			</div>
			<div className="grid grid-cols-3 gap-[var(--space-2)] items-end">
				<div>
					<ColorField label="Fill" value={(data.fillColor as string) ?? ''} onChange={(fillColor) => updateFlow({ nodes: state.flow.nodes.map(n => ((n as any).data?.identifier?.id) !== nodeId ? n : ({ ...n, data: { ...(n as any).data, fillColor } } as any)) })} bindAdornment={<BindButton nodeId={nodeId} bindingKey="fillColor" />} />
				</div>
				<div>
					<ColorField label="Stroke" value={(data.strokeColor as string) ?? ''} onChange={(strokeColor) => updateFlow({ nodes: state.flow.nodes.map(n => ((n as any).data?.identifier?.id) !== nodeId ? n : ({ ...n, data: { ...(n as any).data, strokeColor } } as any)) })} bindAdornment={<BindButton nodeId={nodeId} bindingKey="strokeColor" />} />
				</div>
				<div>
					<NumberField label="Stroke W" value={(data.strokeWidth as number) ?? NaN} onChange={(strokeWidth) => updateFlow({ nodes: state.flow.nodes.map(n => ((n as any).data?.identifier?.id) !== nodeId ? n : ({ ...n, data: { ...(n as any).data, strokeWidth } } as any)) })} min={0} step={0.5} defaultValue={1} bindAdornment={<BindButton nodeId={nodeId} bindingKey="strokeWidth" />} />
				</div>
			</div>
		</div>
	);
}

// Show a small configured marker for per-object overrides
function ConfiguredLabel() {
	return <span className="ml-1 text-[var(--text-tertiary)]">(configured)</span>;
}

function CanvasPerObjectProperties({ nodeId, objectId, assignments, onChange, onClear }: {
	nodeId: string;
	objectId: string;
	assignments: PerObjectAssignments;
	onChange: (updates: Record<string, unknown>) => void;
	onClear: () => void;
}) {
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

	const { state, updateFlow } = useWorkspace();
	const BindingTag = ({ keyName }: { keyName: string }) => {
		const node = state.flow.nodes.find(n => (n as any).data?.identifier?.id === nodeId) as any;
		const vbAll = (node?.data?.variableBindingsByObject ?? {}) as Record<string, Record<string, { boundResultNodeId?: string }>>;
		const bound = vbAll?.[objectId]?.[keyName]?.boundResultNodeId;
		if (!bound) return null;
		const name = state.flow.nodes.find(n => (n as any).data?.identifier?.id === bound)?.data?.identifier?.displayName as string | undefined;
		return <span className="ml-2 text-[10px] text-[var(--text-tertiary)]">(bound: {name ?? bound})</span>;
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
	const labelWithOverride = (base: string, key: string) => {
		const node = state.flow.nodes.find(n => (n as any).data?.identifier?.id === nodeId) as any;
		const vbAll = (node?.data?.variableBindingsByObject ?? {}) as Record<string, Record<string, { boundResultNodeId?: string }>>;
		const isBound = !!vbAll?.[objectId]?.[key]?.boundResultNodeId;
		return (isBound || isOverridden(key)) ? `${base} (override)` : base;
	};
	const ToggleBinding = ({ keyName }: { keyName: string }) => (
		<button className="text-[10px] text-[var(--text-secondary)] underline ml-2" onClick={() => {
			updateFlow({
				nodes: state.flow.nodes.map((n) => {
					if (((n as any).data?.identifier?.id) !== nodeId) return n;
					const prevAll = ((n as any).data?.variableBindingsByObject ?? {}) as Record<string, Record<string, { target?: string; boundResultNodeId?: string }>>;
					const prev = { ...(prevAll[objectId] ?? {}) };
					delete prev[keyName];
					return { ...n, data: { ...(n as any).data, variableBindingsByObject: { ...prevAll, [objectId]: prev } } } as any;
				})
			});
		}}>Use manual</button>
	);

	return (
		<div className="space-y-[var(--space-3)]">
			<div className="flex items-center justify-between">
				<span className="text-xs text-[var(--text-tertiary)]">Editing overrides for</span>
				<button className="text-xs text-[var(--danger-500)] hover:text-[var(--danger-600)]" onClick={onClear}>Clear for this object</button>
			</div>

			<div className="grid grid-cols-2 gap-[var(--space-2)]">
				<div>
					<label className="block text-xs text-[var(--text-tertiary)]">{labelWithOverride("Position X", "position.x")} <BindingTag keyName="position.x" /></label>
					<NumberField label="" value={(initial.position?.x as number) ?? NaN} onChange={(x) => onChange({ position: { x, y: initial.position?.y ?? 0 } })} defaultValue={0} 
						bindAdornment={<BindButton nodeId={nodeId} bindingKey="position.x" objectId={objectId} />} />
				</div>
				<div>
					<label className="block text-xs text-[var(--text-tertiary)]">{labelWithOverride("Position Y", "position.y")} <BindingTag keyName="position.y" /></label>
					<NumberField label="" value={(initial.position?.y as number) ?? NaN} onChange={(y) => onChange({ position: { x: initial.position?.x ?? 0, y } })} defaultValue={0} 
						bindAdornment={<BindButton nodeId={nodeId} bindingKey="position.y" objectId={objectId} />} />
				</div>
			</div>

			<div className="grid grid-cols-2 gap-[var(--space-2)]">
				<div>
					<label className="block text-xs text-[var(--text-tertiary)]">{labelWithOverride("Scale X", "scale.x")}</label>
					<NumberField label="" value={(initial.scale?.x as number) ?? NaN} onChange={(x) => onChange({ scale: { x, y: initial.scale?.y ?? 1 } })} defaultValue={1} min={0} step={0.1} 
						bindAdornment={<BindButton nodeId={nodeId} bindingKey="scale.x" objectId={objectId} />} />
				</div>
				<div>
					<label className="block text-xs text-[var(--text-tertiary)]">{labelWithOverride("Scale Y", "scale.y")}</label>
					<NumberField label="" value={(initial.scale?.y as number) ?? NaN} onChange={(y) => onChange({ scale: { x: initial.scale?.x ?? 1, y } })} defaultValue={1} min={0} step={0.1} 
						bindAdornment={<BindButton nodeId={nodeId} bindingKey="scale.y" objectId={objectId} />} />
				</div>
			</div>

			<div className="grid grid-cols-2 gap-[var(--space-2)]">
				<div>
					<label className="block text-xs text-[var(--text-tertiary)]">{labelWithOverride("Rotation", "rotation")} <BindingTag keyName="rotation" /></label>
					<NumberField label="" value={(initial.rotation as number) ?? NaN} onChange={(rotation) => onChange({ rotation })} step={0.1} defaultValue={0} 
						bindAdornment={<BindButton nodeId={nodeId} bindingKey="rotation" objectId={objectId} />} />
				</div>
				<div>
					<label className="block text-xs text-[var(--text-tertiary)]">{labelWithOverride("Opacity", "opacity")} <BindingTag keyName="opacity" /></label>
					<NumberField label="" value={(initial.opacity as number) ?? NaN} onChange={(opacity) => onChange({ opacity })} min={0} max={1} step={0.05} defaultValue={1} 
						bindAdornment={<BindButton nodeId={nodeId} bindingKey="opacity" objectId={objectId} />} />
				</div>
			</div>

			<div className="grid grid-cols-3 gap-[var(--space-2)] items-end">
				<div>
					<ColorField label={labelWithOverride("Fill", "fillColor")} value={(initial.fillColor as string) ?? ''} onChange={(fillColor) => onChange({ fillColor })} 
						bindAdornment={<BindButton nodeId={nodeId} bindingKey="fillColor" objectId={objectId} />} />
					<div className="text-[10px] mt-1"><ToggleBinding keyName="fillColor" /> <BindingTag keyName="fillColor" /></div>
				</div>
				<div>
					<ColorField label={labelWithOverride("Stroke", "strokeColor")} value={(initial.strokeColor as string) ?? ''} onChange={(strokeColor) => onChange({ strokeColor })} 
						bindAdornment={<BindButton nodeId={nodeId} bindingKey="strokeColor" objectId={objectId} />} />
					<div className="text-[10px] mt-1"><ToggleBinding keyName="strokeColor" /> <BindingTag keyName="strokeColor" /></div>
				</div>
				<div>
					<NumberField label={labelWithOverride("Stroke W", "strokeWidth")} value={(initial.strokeWidth as number) ?? NaN} onChange={(strokeWidth) => onChange({ strokeWidth })} min={0} step={0.5} defaultValue={1} 
						bindAdornment={<BindButton nodeId={nodeId} bindingKey="strokeWidth" objectId={objectId} />} />
					<div className="text-[10px] mt-1"><ToggleBinding keyName="strokeWidth" /> <BindingTag keyName="strokeWidth" /></div>
				</div>
			</div>
		</div>
	);
}