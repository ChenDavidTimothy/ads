import React, { useMemo, useState } from 'react';
import { Link as LinkIcon } from 'lucide-react';
import { useWorkspace } from '@/components/workspace/workspace-context';
import { FlowTracker } from '@/lib/flow/flow-tracking';
import { deleteByPath } from '@/shared/utils/object-path';
import { transformFactory } from '@/shared/registry/transforms';
import type { AnimationTrack, NodeData } from '@/shared/types/nodes';
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

	const bind = (key: string, resultNodeId: string) => {
		updateFlow({
			nodes: state.flow.nodes.map((n) => {
				if (((n as any).data?.identifier?.id) !== nodeId) return n;
				if (objectId) {
					const prevAll = ((n as any).data?.variableBindingsByObject ?? {}) as Record<string, Record<string, { target?: string; boundResultNodeId?: string }>>;
					const prev = prevAll[objectId] ?? {};
					const nextObj = { ...prev, [key]: { target: key, boundResultNodeId: resultNodeId } };
					return { ...n, data: { ...(n as any).data, variableBindingsByObject: { ...prevAll, [objectId]: nextObj } } } as any;
				}
				const prev = ((n as any).data?.variableBindings ?? {}) as Record<string, { target?: string; boundResultNodeId?: string }>;
				const next = { ...prev, [key]: { target: key, boundResultNodeId: resultNodeId } };
				return { ...n, data: { ...(n as any).data, variableBindings: next } } as any;
			})
		});
	};

	const clear = (key: string) => {
		updateFlow({
			nodes: state.flow.nodes.map((n) => {
				if (((n as any).data?.identifier?.id) !== nodeId) return n;
				if (objectId) {
					const prevAll = ((n as any).data?.variableBindingsByObject ?? {}) as Record<string, Record<string, { target?: string; boundResultNodeId?: string }>>;
					const prev = { ...(prevAll[objectId] ?? {}) };
					delete prev[key];
					return { ...n, data: { ...(n as any).data, variableBindingsByObject: { ...prevAll, [objectId]: prev } } } as any;
				}
				const prev = ((n as any).data?.variableBindings ?? {}) as Record<string, { target?: string; boundResultNodeId?: string }>;
				const next = { ...prev } as typeof prev;
				delete next[key];
				return { ...n, data: { ...(n as any).data, variableBindings: next } } as any;
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

				// Helper: prune empty nested objects
				const pruneEmpty = (obj: any) => {
					if (!obj || typeof obj !== 'object') return obj;
					for (const k of Object.keys(obj)) {
						if (obj[k] && typeof obj[k] === 'object') pruneEmpty(obj[k]);
						if (obj[k] && typeof obj[k] === 'object' && Object.keys(obj[k]).length === 0) delete obj[k];
					}
					return obj;
				};

				// 2) Clear manual overrides
				// Canvas node: per-object overrides live in perObjectAssignments[objectId].initial
				if (data.type === 'canvas') {
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
						// Node-level canvas defaults stored directly on node data
						deleteByPath(nextData as unknown as Record<string, unknown>, key);
					}
				} else if (data.type === 'animation') {
					// Animation node: per-object track overrides or global track defaults
					const trackPrefix = 'track.';
					if (rawKey.startsWith(trackPrefix)) {
						// track.<id>.<subPath>
						const [, trackId, ...rest] = rawKey.split('.');
						const subPath = rest.join('.'); // e.g., 'move.from.x' or 'easing' etc.
						const poa = { ...(nextData.perObjectAssignments as PerObjectAssignments ?? {}) };
						if (!objectId) return { ...n, data: nextData } as any;
						const entry: ObjectAssignments = { ...(poa[objectId] ?? {}) } as ObjectAssignments;
						const tracks: TrackOverride[] = Array.isArray(entry.tracks) ? [...entry.tracks] : [];
						const idx = tracks.findIndex(t => t.trackId === trackId);
						if (idx >= 0) {
							const t = { ...tracks[idx] } as TrackOverride;
							const props = { ...(t.properties ?? {}) } as Record<string, unknown>;
							// Strip type prefix if present (e.g., 'move.from.x' -> 'from.x')
							const dot = subPath.indexOf('.');
							const propPath = dot >= 0 ? subPath.slice(dot + 1) : subPath;
							deleteByPath(props as Record<string, unknown>, propPath);
							const prunedProps = pruneEmpty(props);
							if (Object.keys(prunedProps).length === 0) delete (t as any).properties; else (t as any).properties = prunedProps;
							// Also allow clearing scalar timing/easing keys
							if (propPath === 'easing' || propPath === 'duration' || propPath === 'startTime') delete (t as any)[propPath];
							const hasProps = !!t.properties && Object.keys(t.properties as Record<string, unknown>).length > 0;
							const hasMeta = (t as any).easing !== undefined || (t as any).startTime !== undefined || (t as any).duration !== undefined;
							if (!hasProps && !hasMeta) tracks.splice(idx, 1); else tracks[idx] = t;
							(entry as any).tracks = tracks;
							if ((!entry.initial || Object.keys(entry.initial as any).length === 0) && (!tracks || tracks.length === 0)) {
								delete poa[objectId];
							} else {
								poa[objectId] = entry;
							}
							nextData.perObjectAssignments = poa;
						}
					} else {
						// Global track defaults: reset the base track properties in timeline editor data
						// subPath like 'duration' or '<type>.<prop>...'
						const subPath = rawKey;
						const tracks: AnimationTrack[] = Array.isArray((nextData as any).tracks) ? ([...(nextData as any).tracks] as AnimationTrack[]) : [];
						const dot = subPath.indexOf('.');
						if (subPath === 'duration') {
							(nextData as any).duration = (transformFactory.getTransformDefinition ? undefined : undefined); // duration default handled elsewhere; keep editor state owner to reset via timeline flow
						} else if (dot >= 0) {
							const type = subPath.slice(0, dot);
							const propPath = subPath.slice(dot + 1);
							const defaults = transformFactory.getDefaultProperties(type) ?? {};
							const getDefaultByPath = (obj: any, path: string): any => {
								const parts = path.split('.');
								let cur = obj;
								for (const p of parts) {
									if (!cur || typeof cur !== 'object') return undefined;
									cur = cur[p];
								}
								return cur;
							};
							const defaultVal = getDefaultByPath(defaults, propPath);
							(nextData as any).tracks = tracks.map((t) => {
								if ((t as any).type !== type) return t;
								const copy = { ...(t as any), properties: { ...(t as any).properties } };
								if (defaultVal === undefined) {
									deleteByPath(copy.properties as Record<string, unknown>, propPath);
								} else {
									// set to default
									const assignByPath = (obj: any, path: string, val: any) => {
										const parts = path.split('.');
										let cursor = obj;
										for (let i = 0; i < parts.length - 1; i++) {
											const k = parts[i]!;
											if (!cursor[k] || typeof cursor[k] !== 'object') cursor[k] = {};
											cursor = cursor[k];
										}
										cursor[parts[parts.length - 1]!] = val;
									};
									assignByPath(copy.properties, propPath, defaultVal);
								}
								return copy as AnimationTrack;
							});
						}
					}
				}

				return { ...n, data: nextData } as any;
			})
		});
	};

	return { variables, getBinding, getBoundName, bind, clear, resetToDefault } as const;
}

export function BindButton({ nodeId, bindingKey, objectId, className }: BindButtonProps) {
	const { variables, getBinding, getBoundName, bind, clear, resetToDefault } = useVariableBinding(nodeId, objectId);
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
					{boundId && (
						<>
							<div className="h-px bg-[var(--border-primary)]" />
							<div
								className="px-3 py-2 text-xs text-[var(--danger-400)] hover:bg-[var(--surface-interactive)] cursor-pointer"
								onClick={() => { clear(bindingKey); setOpen(false); }}
							>
								Clear binding
							</div>
						<div
							className="px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--surface-interactive)] cursor-pointer"
							onClick={() => { resetToDefault(bindingKey); setOpen(false); }}
						>
							Reset to default
						</div>
 						</>
 					)}
 				</div>
 			)}
 		</div>
 	);
 }