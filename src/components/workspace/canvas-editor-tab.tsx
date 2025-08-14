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
		const currentInitial = { ...(current.initial ?? {}) } as Record<string, unknown>;
		Object.assign(currentInitial, updates);
		const cleanedInitial = Object.fromEntries(Object.entries(currentInitial).filter(([_, v]) => v !== undefined));
		current.initial = cleanedInitial as any;
		next[selectedObjectId] = current;
		// Persist to flow.nodes
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
				<ObjectSelectionPanel
					items={upstreamObjects.map(o => ({ id: o.data.identifier.id, label: o.data.identifier.displayName }))}
					selectedId={selectedObjectId}
					onSelect={(id) => setSelectedObjectId(id)}
					emptyLabel="No upstream objects"
				/>
			)}
			center={(
				<div className="flex-1 p-4">
					<div className="h-full w-full flex items-center justify-center text-[var(--text-tertiary)]">
						No timeline for Canvas. Select an object on the left to edit its overrides.
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
					<div className="text-[var(--text-tertiary)] text-sm">Select an object to edit its overrides</div>
				)
			)}
			rightHeader={<h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Properties</h3>}
			onBack={() => updateUI({ activeTab: 'flow', selectedNodeId: undefined, selectedNodeType: undefined })}
			headerExtras={(
				<div className="flex items-center gap-2">
					<span className="text-xs text-[var(--text-tertiary)]">Object:</span>
					<select
						className="bg-[var(--surface-1)] text-[var(--text-primary)] text-xs px-2 py-1 rounded border border-[var(--border-primary)]"
						value={selectedObjectId ?? ''}
						onChange={(e) => setSelectedObjectId(e.target.value || null)}
					>
						<option value="">—</option>
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

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<span className="text-xs text-[var(--text-tertiary)]">Editing overrides for</span>
				<button className="text-xs text-[var(--danger-500)] hover:text-[var(--danger-600)]" onClick={onClear}>Clear for this object</button>
			</div>

			<div className="grid grid-cols-2 gap-2">
				<div>
					<label className="block text-xs text-[var(--text-tertiary)]">Position X</label>
					<NumberField label="" value={(initial.position?.x as number) ?? NaN} onChange={(x) => onChange({ position: { x, y: initial.position?.y ?? 0 } })} defaultValue={0} />
				</div>
				<div>
					<label className="block text-xs text-[var(--text-tertiary)]">Position Y</label>
					<NumberField label="" value={(initial.position?.y as number) ?? NaN} onChange={(y) => onChange({ position: { x: initial.position?.x ?? 0, y } })} defaultValue={0} />
				</div>
			</div>

			<div className="grid grid-cols-2 gap-2">
				<div>
					<label className="block text-xs text-[var(--text-tertiary)]">Scale X</label>
					<NumberField label="" value={(initial.scale?.x as number) ?? NaN} onChange={(x) => onChange({ scale: { x, y: initial.scale?.y ?? 1 } })} defaultValue={1} min={0} step={0.1} />
				</div>
				<div>
					<label className="block text-xs text-[var(--text-tertiary)]">Scale Y</label>
					<NumberField label="" value={(initial.scale?.y as number) ?? NaN} onChange={(y) => onChange({ scale: { x: initial.scale?.x ?? 1, y } })} defaultValue={1} min={0} step={0.1} />
				</div>
			</div>

			<div className="grid grid-cols-2 gap-2">
				<div>
					<label className="block text-xs text-[var(--text-tertiary)]">Rotation</label>
					<NumberField label="" value={(initial.rotation as number) ?? NaN} onChange={(rotation) => onChange({ rotation })} step={0.1} defaultValue={0} />
				</div>
				<div>
					<label className="block text-xs text-[var(--text-tertiary)]">Opacity</label>
					<NumberField label="" value={(initial.opacity as number) ?? NaN} onChange={(opacity) => onChange({ opacity })} min={0} max={1} step={0.05} defaultValue={1} />
				</div>
			</div>

			<div className="grid grid-cols-3 gap-2 items-end">
				<div>
					<ColorField label="Fill" value={(initial.fillColor as string) ?? ''} onChange={(fillColor) => onChange({ fillColor })} />
				</div>
				<div>
					<ColorField label="Stroke" value={(initial.strokeColor as string) ?? ''} onChange={(strokeColor) => onChange({ strokeColor })} />
				</div>
				<div>
					<NumberField label="Stroke W" value={(initial.strokeWidth as number) ?? NaN} onChange={(strokeWidth) => onChange({ strokeWidth })} min={0} step={0.5} defaultValue={1} />
				</div>
			</div>
		</div>
	);
}