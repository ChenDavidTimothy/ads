import React, { useMemo, useState } from 'react';
import { Link as LinkIcon, Search } from 'lucide-react';

import { useWorkspace } from '@/components/workspace/workspace-context';
import { FlowTracker } from '@/lib/flow/flow-tracking';
import { deleteByPath } from '@/shared/utils/object-path';
import type { NodeData, AnimationNodeData, CanvasNodeData, TextStyleNodeData } from '@/shared/types/nodes';
import type { PerObjectAssignments, ObjectAssignments, TrackOverride } from '@/shared/properties/assignments';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';

interface BindButtonProps {
	nodeId: string;
	bindingKey: string;
	objectId?: string;
	className?: string;
}

// Type guards for safe node data access
function isAnimationNodeData(data: NodeData): data is AnimationNodeData {
	return data.identifier.type === 'animation';
}

function isCanvasNodeData(data: NodeData): data is CanvasNodeData {
	return data.identifier.type === 'canvas';
}

// NEW: Add TextStyle support
function isTextStyleNodeData(data: NodeData): data is TextStyleNodeData {
	return data.identifier.type === 'textstyle';
}

// Helper type for variable binding structure
interface VariableBinding {
	target?: string;
	boundResultNodeId?: string;
}

type VariableBindingsMap = Record<string, VariableBinding>;
type PerObjectVariableBindings = Record<string, VariableBindingsMap>;

export function useVariableBinding(nodeId: string, objectId?: string) {
	const { state, updateFlow } = useWorkspace();

	const variables = useMemo(() => {
		const tracker = new FlowTracker();
		return tracker.getAvailableResultVariables(nodeId, state.flow.nodes, state.flow.edges);
	}, [nodeId, state.flow.nodes, state.flow.edges]);

	const getBinding = (key: string): string | undefined => {
		const node = state.flow.nodes.find(n => n.data?.identifier?.id === nodeId);
		if (!node?.data) return undefined;
		
		if (objectId) {
			if (isAnimationNodeData(node.data) || isCanvasNodeData(node.data) || isTextStyleNodeData(node.data)) {
				const prevAll = node.data.variableBindingsByObject ?? {};
				return prevAll[objectId]?.[key]?.boundResultNodeId;
			}
			return undefined;
		}
		
		if (isAnimationNodeData(node.data) || isCanvasNodeData(node.data) || isTextStyleNodeData(node.data)) {
			const vb = node.data.variableBindings ?? {};
			return vb[key]?.boundResultNodeId;
		}
		return undefined;
	};

	const getBoundName = (rid?: string): string | undefined => {
		if (!rid) return undefined;
		const node = state.flow.nodes.find(n => n.data?.identifier?.id === rid);
		return node?.data?.identifier?.displayName;
	};

	// Helper: prune empty nested objects
	const pruneEmpty = (obj: Record<string, unknown>): Record<string, unknown> => {
		if (!obj || typeof obj !== 'object') return obj;
		
		const result = { ...obj };
		for (const k of Object.keys(result)) {
			const value = result[k];
			if (value && typeof value === 'object' && !Array.isArray(value)) {
				result[k] = pruneEmpty(value as Record<string, unknown>);
				if (Object.keys(result[k] as Record<string, unknown>).length === 0) {
					delete result[k];
				}
			}
		}
		return result;
	};

	// Helper: clear animation track override for a specific property
	const clearTrackOverride = (nextData: AnimationNodeData, objectId: string, key: string): void => {
		const trackPrefix = 'track.';
		if (!key.startsWith(trackPrefix)) return;
		
		const [, trackId, ...rest] = key.split('.');
		const subPath = rest.join('.');
		
		const poa: PerObjectAssignments = { ...(nextData.perObjectAssignments ?? {}) };
		const entry: ObjectAssignments = { ...(poa[objectId] ?? {}) };
		const tracks: TrackOverride[] = Array.isArray(entry.tracks) ? [...entry.tracks] : [];
		const idx = tracks.findIndex(t => t.trackId === trackId);
		
		if (idx >= 0) {
			const t: TrackOverride = { ...tracks[idx] };
			const props = { ...(t.properties ?? {}) };
			const dot = subPath.indexOf('.');
			const propPath = dot >= 0 ? subPath.slice(dot + 1) : subPath;
			deleteByPath(props, propPath);
			
			const prunedProps = pruneEmpty(props);
			if (Object.keys(prunedProps).length === 0) {
				delete t.properties;
			} else {
				t.properties = prunedProps;
			}
			
			tracks[idx] = t;
			entry.tracks = tracks;
			poa[objectId] = entry;
			nextData.perObjectAssignments = poa;
		}
	};

	const bind = (key: string, resultNodeId: string): void => {
		updateFlow({
			nodes: state.flow.nodes.map((n) => {
				if (n.data?.identifier?.id !== nodeId) return n;
				
				const nodeData = n.data;
				if (!nodeData || (!isAnimationNodeData(nodeData) && !isCanvasNodeData(nodeData) && !isTextStyleNodeData(nodeData))) {
					return n;
				}
				
				// Create a properly typed copy of the node data
				const nextData = { ...nodeData };
				
				// 1) Set the binding
				if (objectId) {
					const prevAll: PerObjectVariableBindings = nextData.variableBindingsByObject ?? {};
					const prev: VariableBindingsMap = prevAll[objectId] ?? {};
					const nextObj: VariableBindingsMap = { ...prev, [key]: { target: key, boundResultNodeId: resultNodeId } };
					nextData.variableBindingsByObject = { ...prevAll, [objectId]: nextObj };
				} else {
					const prev: VariableBindingsMap = nextData.variableBindings ?? {};
					nextData.variableBindings = { ...prev, [key]: { target: key, boundResultNodeId: resultNodeId } };
				}
				
				// 2) Clear corresponding override assignments for animation nodes
				if (isAnimationNodeData(nextData) && objectId) {
					clearTrackOverride(nextData, objectId, key);
				}
				
				return { ...n, data: nextData };
			})
		});
	};

	// Unified reset: clear binding and associated manual overrides, falling back to defaults
	const resetToDefault = (rawKey: string): void => {
		updateFlow({
			nodes: state.flow.nodes.map((n) => {
				const data = n.data;
				if (!data || data.identifier?.id !== nodeId) return n;
				
				if (!isAnimationNodeData(data) && !isCanvasNodeData(data) && !isTextStyleNodeData(data)) {
					return n;
				}

				const nextData = { ...data };

				// 1) Clear binding for this key (supports per-object and global)
				if (objectId) {
					const all: PerObjectVariableBindings = { ...(nextData.variableBindingsByObject ?? {}) };
					const obj: VariableBindingsMap = { ...(all[objectId] ?? {}) };
					delete obj[rawKey];
					all[objectId] = obj;
					nextData.variableBindingsByObject = all;
				} else {
					const vb: VariableBindingsMap = { ...(nextData.variableBindings ?? {}) };
					delete vb[rawKey];
					nextData.variableBindings = vb;
				}

				// 2) Clear manual overrides and fall back to the node's own defaults
				if (isCanvasNodeData(nextData)) {
					const key = rawKey; // e.g., 'position.x', 'fillColor'
					if (objectId) {
						const poa: PerObjectAssignments = { ...(nextData.perObjectAssignments ?? {}) };
						const entry: ObjectAssignments = { ...(poa[objectId] ?? {}) };
						const initial = { ...(entry.initial ?? {}) };
						deleteByPath(initial, key);
						const prunedInitial = pruneEmpty(initial);
						if (Object.keys(prunedInitial).length === 0) {
							delete entry.initial;
						} else {
							entry.initial = prunedInitial;
						}
						if ((entry.initial === undefined) && (!entry.tracks || entry.tracks.length === 0)) {
							delete poa[objectId];
						} else {
							poa[objectId] = entry;
						}
						nextData.perObjectAssignments = poa;
					} else {
						// Node-level canvas value is the node's default; do not change it here
					}
				} else if (isAnimationNodeData(nextData)) {
					if (objectId) {
						clearTrackOverride(nextData, objectId, rawKey);
					}
				} else if (isTextStyleNodeData(nextData)) {
					const key = rawKey; // e.g., 'fontFamily', 'lineHeight'
					if (objectId) {
						const poa: PerObjectAssignments = { ...(nextData.perObjectAssignments ?? {}) };
						const entry: ObjectAssignments = { ...(poa[objectId] ?? {}) };
						const initial = { ...(entry.initial ?? {}) };
						deleteByPath(initial, key);
						const prunedInitial = pruneEmpty(initial);
						if (Object.keys(prunedInitial).length === 0) {
							delete entry.initial;
						} else {
							entry.initial = prunedInitial;
						}
						if ((entry.initial === undefined) && (!entry.tracks || entry.tracks.length === 0)) {
							delete poa[objectId];
						} else {
							poa[objectId] = entry;
						}
						nextData.perObjectAssignments = poa;
					} else {
						// Node-level TextStyle value is the node's default; do not change it here
					}
				}

				return { ...n, data: nextData };
			})
		});
	};

	return { variables, getBinding, getBoundName, bind, resetToDefault } as const;
}

export function BindButton({ nodeId, bindingKey, objectId, className }: BindButtonProps) {
	const { variables, getBinding, getBoundName, bind } = useVariableBinding(nodeId, objectId);
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState('');
	const boundId = getBinding(bindingKey);
	const boundName = getBoundName(boundId);
	const isBound = !!boundId;

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return variables;
		return variables.filter(v => v.name.toLowerCase().includes(q));
	}, [variables, query]);

	return (
		<div className={`relative ${className ?? ''}`}>
			<button
				type="button"
				title={boundId ? `Bound to ${boundName ?? boundId}` : 'Bind to Result variable'}
				onClick={() => setOpen(true)}
				className={`relative p-1 rounded hover:bg-[var(--surface-interactive)] ${isBound ? 'text-[var(--accent-primary)]' : ''}`}
			>
				<LinkIcon size={14} />
				{isBound && <span className="absolute -top-1 -right-1 w-2 h-2 bg-[var(--accent-primary)] rounded-full" />}
			</button>

			<Modal isOpen={open} onClose={() => setOpen(false)} title="Bind to Result" size="sm" variant="glass">
				<div className="p-[var(--space-3)] space-y-[var(--space-3)] h-full flex flex-col">
					<div className="relative">
						<Input
							placeholder="Search results..."
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							className="pl-8 text-sm h-8 glass-input"
						/>
						<Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
					</div>
					<div className="flex-1 overflow-auto scrollbar-elegant">
						{filtered.length === 0 ? (
							<div className="px-[var(--space-3)] py-[var(--space-6)] text-sm text-[var(--text-tertiary)] text-center">
								{query.trim() ? 'No results found' : 'No Result variables available'}
							</div>
						) : (
							<div className="space-y-[var(--space-1)]">
								{filtered.map(v => (
									<button
										key={v.id}
										onClick={() => { bind(bindingKey, v.id); setOpen(false); }}
										className="w-full text-left px-[var(--space-3)] py-[var(--space-2)] text-sm rounded-[var(--radius-sm)] hover:bg-[var(--surface-interactive)] transition-colors duration-[var(--duration-fast)] focus:bg-[var(--surface-interactive)] focus:outline-none focus:ring-1 focus:ring-[var(--ring-color)]"
									>
										<div className="font-medium text-[var(--text-primary)] text-refined">{v.name}</div>
									</button>
								))}
							</div>
						)}
					</div>
					{filtered.length > 0 && (
						<div className="flex items-center justify-center pt-[var(--space-2)] border-t border-[var(--border-primary)]">
							<div className="text-xs text-[var(--text-muted)] text-refined">
								{filtered.length} {filtered.length === 1 ? 'result' : 'results'}
							</div>
						</div>
					)}
				</div>
			</Modal>
		</div>
	);
}