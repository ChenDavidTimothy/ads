import React, { useMemo, useState } from 'react';
import { Link as LinkIcon } from 'lucide-react';
import { useWorkspace } from '@/components/workspace/workspace-context';
import { FlowTracker } from '@/lib/flow/flow-tracking';
import { deleteByPath } from '@/shared/utils/object-path';
import type { NodeData } from '@/shared/types/nodes';
import type { PerObjectAssignments, ObjectAssignments, TrackOverride } from '@/shared/properties/assignments';

interface BindButtonProps {
	nodeId: string;
	bindingKey: string;
	objectId?: string;
	className?: string;
}

function useVariableBinding(nodeId: string, objectId?: string) {
	const { state, updateFlow } = useWorkspace();

	const variables = useMemo(() => {
		const tracker = new FlowTracker();
		return tracker.getAvailableResultVariables(nodeId, state.flow.nodes as any, state.flow.edges as any);
	}, [nodeId, state.flow.nodes, state.flow.edges]);

	const getBinding = (key: string): string | undefined => {
		const node = state.flow.nodes.find(n => (n as any).data?.identifier?.id === nodeId) as any;
		if (!node) return undefined;
		if (objectId) {
			const prevAll = (node?.data?.variableBindingsByObject ?? {}) as Record<string, Record<string, { boundResultNodeId?: string }>>;
			return prevAll?.[objectId]?.[key]?.boundResultNodeId;
		}
		const vb = (node?.data?.variableBindings ?? {}) as Record<string, { boundResultNodeId?: string }>;
		return vb?.[key]?.boundResultNodeId;
	};

	const getBoundName = (rid?: string): string | undefined => {
		if (!rid) return undefined;
		const node = state.flow.nodes.find(n => (n as any).data?.identifier?.id === rid) as any;
		return node?.data?.identifier?.displayName as string | undefined;
	};

	// Helper: prune empty nested objects
	const pruneEmpty = (obj: any): any => {
		if (!obj || typeof obj !== 'object') return obj;
		
		for (const k of Object.keys(obj)) {
			if (obj[k] && typeof obj[k] === 'object') {
				obj[k] = pruneEmpty(obj[k]); // ✅ ASSIGN THE RESULT BACK
				if (Object.keys(obj[k]).length === 0) {
					delete obj[k]; // ✅ CLEAN UP EMPTY OBJECTS
				}
			}
		}
		return obj;
	};

	// Helper: clear animation track override for a specific property
	const clearTrackOverride = (nextData: any, objectId: string, key: string) => {
		const trackPrefix = 'track.';
		if (!key.startsWith(trackPrefix)) return;
		
		const [, trackId, ...rest] = key.split('.');
		const subPath = rest.join('.');
		
		const poa = { ...(nextData.perObjectAssignments as PerObjectAssignments ?? {}) };
		const entry: ObjectAssignments = { ...(poa[objectId] ?? {}) } as ObjectAssignments;
		const tracks: TrackOverride[] = Array.isArray(entry.tracks) ? [...entry.tracks] : [];
		const idx = tracks.findIndex(t => t.trackId === trackId);
		
		if (idx >= 0) {
			const t = { ...tracks[idx] } as TrackOverride;
			const props = { ...(t.properties ?? {}) } as Record<string, unknown>;
			const dot = subPath.indexOf('.');
			const propPath = dot >= 0 ? subPath.slice(dot + 1) : subPath;
			deleteByPath(props as Record<string, unknown>, propPath);
			
			const prunedProps = pruneEmpty(props);
			if (Object.keys(prunedProps).length === 0) delete (t as any).properties; 
			else (t as any).properties = prunedProps;
			
			tracks[idx] = t;
			(entry as any).tracks = tracks;
			poa[objectId] = entry;
			nextData.perObjectAssignments = poa;
		}
	};

	const bind = (key: string, resultNodeId: string) => {
		updateFlow({
			nodes: state.flow.nodes.map((n) => {
				if (((n as any).data?.identifier?.id) !== nodeId) return n;
				
				const nextData: any = { ...(n as any).data };
				
				// 1) Set the binding (existing logic)
				if (objectId) {
					const prevAll = (nextData.variableBindingsByObject ?? {}) as Record<string, Record<string, { target?: string; boundResultNodeId?: string }>>;
					const prev = prevAll[objectId] ?? {};
					const nextObj = { ...prev, [key]: { target: key, boundResultNodeId: resultNodeId } };
					nextData.variableBindingsByObject = { ...prevAll, [objectId]: nextObj };
				} else {
					const prev = (nextData.variableBindings ?? {}) as Record<string, { target?: string; boundResultNodeId?: string }>;
					nextData.variableBindings = { ...prev, [key]: { target: key, boundResultNodeId: resultNodeId } };
				}
				
				// 2) Clear corresponding override assignments (NEW LOGIC)
				if (nextData.identifier?.type === 'animation' && objectId) {
					clearTrackOverride(nextData, objectId, key);
				}
				
				return { ...n, data: nextData } as any;
			})
		});
	};

	// Unified reset: clear binding and associated manual overrides, falling back to defaults
	const resetToDefault = (rawKey: string) => {
		updateFlow({
			nodes: state.flow.nodes.map((n) => {
				const data = (n as any).data as NodeData | undefined;
				if (!data || data.identifier?.id !== nodeId) return n;

				const nextData: any = { ...data };

				// 1) Clear binding for this key (supports per-object and global)
				if (objectId) {
					const all = { ...(nextData.variableBindingsByObject ?? {}) } as Record<string, Record<string, { target?: string; boundResultNodeId?: string }>>;
					const obj = { ...(all[objectId] ?? {}) };
					delete obj[rawKey];
					all[objectId] = obj;
					nextData.variableBindingsByObject = all;
				} else {
					const vb = { ...(nextData.variableBindings ?? {}) } as Record<string, { target?: string; boundResultNodeId?: string }>;
					delete vb[rawKey];
					nextData.variableBindings = vb;
				}

				// 2) Clear manual overrides and fall back to the node's own defaults
				if (data.identifier.type === 'canvas') {
					const key = rawKey; // e.g., 'position.x', 'fillColor'
					if (objectId) {
						const poa = { ...(nextData.perObjectAssignments as PerObjectAssignments ?? {}) };
						const entry: ObjectAssignments = { ...(poa[objectId] ?? {}) } as ObjectAssignments;
						const initial = { ...(entry.initial ?? {}) } as Record<string, unknown>;
						deleteByPath(initial as Record<string, unknown>, key);
						const prunedInitial = pruneEmpty(initial);
						if (Object.keys(prunedInitial).length === 0) delete (entry as any).initial; else (entry as any).initial = prunedInitial;
						if ((entry.initial === undefined) && (!entry.tracks || entry.tracks.length === 0)) {
							delete poa[objectId];
						} else {
							poa[objectId] = entry;
						}
						nextData.perObjectAssignments = poa;
					} else {
						// Node-level canvas value is the node's default; do not change it here
					}
				} else if (data.identifier.type === 'animation') {
					if (objectId) {
						clearTrackOverride(nextData, objectId, rawKey);
					}
				}

				return { ...n, data: nextData } as any;
			})
		});
	};

	return { variables, getBinding, getBoundName, bind, resetToDefault } as const;
}

export function BindButton({ nodeId, bindingKey, objectId, className }: BindButtonProps) {
	const { variables, getBinding, getBoundName, bind, resetToDefault } = useVariableBinding(nodeId, objectId);
	const [open, setOpen] = useState(false);
	const boundId = getBinding(bindingKey);
	const boundName = getBoundName(boundId);
	const isBound = !!boundId;

	return (
		<div className={`relative ${className ?? ''}`}>
			<button
				type="button"
				title={boundId ? `Bound to ${boundName ?? boundId}` : 'Bind to Result variable'}
				onClick={() => setOpen(v => !v)}
				                className={`relative p-1 rounded hover:bg-[var(--surface-interactive)] ${isBound ? 'text-[var(--accent-primary)]' : ''}`}
			>
				<LinkIcon size={14} />
				                {isBound && <span className="absolute -top-1 -right-1 w-2 h-2 bg-[var(--accent-primary)] rounded-full" />}
			</button>
			{open && (
				<div className="absolute right-0 z-50 mt-1 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded shadow-md min-w-[180px]">
					{variables.length === 0 ? (
						<div className="px-3 py-2 text-xs text-[var(--text-tertiary)]">No connected Result variables</div>
					) : (
						<div className="max-h-56 overflow-auto">
							{variables.map(v => (
								<div
									key={v.id}
									className="px-3 py-2 text-xs hover:bg-[var(--surface-interactive)] cursor-pointer"
									onClick={() => { bind(bindingKey, v.id); setOpen(false); }}
								>
									{v.name}
								</div>
							))}
						</div>
					)}
					<div className="h-px bg-[var(--border-primary)]" />
					<div
						className="px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--surface-interactive)] cursor-pointer"
						onClick={() => { resetToDefault(bindingKey); setOpen(false); }}
					>
						Reset to default
					</div>
				</div>
			)}
		</div>
	);
}