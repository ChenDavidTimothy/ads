import React, { useMemo, useState, useCallback } from 'react';
import { Link as LinkIcon } from 'lucide-react';
import { useWorkspace } from '@/components/workspace/workspace-context';
import { FlowTracker } from '@/lib/flow/flow-tracking';
import { propertySystem } from '@/shared/properties/system';

interface BindButtonProps {
	nodeId: string;
	bindingKey: string;
	objectId?: string;
	className?: string;
}

function useVariableBinding(nodeId: string, objectId?: string) {
	const { state, updateFlow } = useWorkspace();

	// Existing code (keep unchanged)
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

	// ADD these new functions:
	const isManuallyOverridden = useCallback((key: string): boolean => {
		const node = state.flow.nodes.find(n => (n as any).data?.identifier?.id === nodeId) as any;
		if (!node) return false;

		if (objectId) {
			// Canvas context: check perObjectAssignments.initial
			const assignments = node.data?.perObjectAssignments?.[objectId]?.initial;
			return getByPath(assignments, key) !== undefined;
		} else {
			// Property panel context: check node data directly
			return getByPath(node.data, key) !== undefined;
		}
	}, [nodeId, objectId, state.flow.nodes]);

	const clearManualOverride = useCallback((key: string) => {
		updateFlow({
			nodes: state.flow.nodes.map((n) => {
				if (((n as any).data?.identifier?.id) !== nodeId) return n;
				
				if (objectId) {
					// Canvas: remove from perObjectAssignments.initial
					const assignments = { ...((n as any).data?.perObjectAssignments ?? {}) };
					if (assignments[objectId]?.initial) {
						const initial = { ...assignments[objectId].initial };
						removeByPath(initial, key);
						if (Object.keys(initial).length === 0) {
							delete assignments[objectId].initial;
							if (Object.keys(assignments[objectId] ?? {}).length === 0) {
								delete assignments[objectId];
							}
						} else {
							assignments[objectId] = { ...assignments[objectId], initial };
						}
					}
					return { ...n, data: { ...(n as any).data, perObjectAssignments: assignments } };
				} else {
					// Property panel: remove from node data directly
					const data = { ...(n as any).data };
					removeByPath(data, key);
					return { ...n, data };
				}
			})
		});
	}, [nodeId, objectId, updateFlow]);

	const getDefaultValue = useCallback((key: string): unknown => {
		const node = state.flow.nodes.find(n => (n as any).data?.identifier?.id === nodeId) as any;
		if (!node) return undefined;

		const nodeDefaults = propertySystem.getNodeDefaults(node.data?.identifier?.type);
		return getByPath(nodeDefaults, key);
	}, [nodeId, state.flow.nodes]);

	const resetToDefault = useCallback((key: string) => {
		clear(key);
		clearManualOverride(key);
	}, [clear, clearManualOverride]);

	return { 
		variables, 
		getBinding, 
		getBoundName, 
		bind, 
		clear, 
		isManuallyOverridden,
		clearManualOverride,
		getDefaultValue,
		resetToDefault
	} as const;
}

export function BindButton({ nodeId, bindingKey, objectId, className }: BindButtonProps) {
	const { 
		variables, 
		getBinding, 
		getBoundName, 
		bind, 
		clear, 
		isManuallyOverridden,
		clearManualOverride,
		getDefaultValue,
		resetToDefault 
	} = useVariableBinding(nodeId, objectId);
	
	const [open, setOpen] = useState(false);
	const boundId = getBinding(bindingKey);
	const boundName = getBoundName(boundId);
	const isBound = !!boundId;
	const isOverridden = isManuallyOverridden(bindingKey);
	const hasAnyOverride = isBound || isOverridden;
	const defaultValue = getDefaultValue(bindingKey);

	const getStateColor = () => {
		if (isBound) return 'text-[#3b82f6]'; // Blue for bindings
		if (isOverridden) return 'text-[#f59e0b]'; // Amber for manual
		return 'text-[var(--text-secondary)]';
	};

	const getIndicatorColor = () => {
		if (isBound) return 'bg-[#3b82f6]';
		if (isOverridden) return 'bg-[#f59e0b]';
		return 'bg-[var(--text-secondary)]';
	};

	const getTooltipText = () => {
		if (isBound) return `Bound to ${boundName ?? boundId}`;
		if (isOverridden) return 'Manually overridden';
		return 'Bind to Result variable';
	};

	return (
		<div className={`relative ${className ?? ''}`}>
			<button
				type="button"
				title={getTooltipText()}
				onClick={() => setOpen(v => !v)}
				className={`relative p-1 rounded hover:bg-[var(--surface-interactive)] transition-colors ${getStateColor()}`}
			>
				<LinkIcon size={14} />
				{hasAnyOverride && (
					<span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${getIndicatorColor()}`} />
				)}
			</button>
			
			{open && (
				<div className="absolute right-0 z-50 mt-1 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded shadow-md min-w-[200px]">
					{/* Current State Display */}
					<div className="px-3 py-2 bg-[var(--surface-1)] border-b border-[var(--border-primary)]">
						<div className="text-xs font-medium text-[var(--text-primary)]">Current State</div>
						<div className="mt-1 flex items-center gap-2">
							<div className={`w-2 h-2 rounded-full ${getIndicatorColor()}`} />
							<span className={`text-xs ${getStateColor()}`}>
								{isBound ? `Bound to ${boundName ?? boundId}` : 
								 isOverridden ? 'Manual override' : 
								 'Default value'}
							</span>
						</div>
						{defaultValue !== undefined && (
							<div className="mt-1 text-[10px] text-[var(--text-tertiary)]">
								Default: {String(defaultValue)}
							</div>
						)}
					</div>

					{/* Binding Options */}
					{variables.length === 0 ? (
						<div className="px-3 py-2 text-xs text-[var(--text-tertiary)]">
							No connected Result variables
						</div>
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

					{/* Reset Actions */}
					{hasAnyOverride && (
						<>
							<div className="h-px bg-[var(--border-primary)]" />
							{isBound && (
								<div
									className="px-3 py-2 text-xs text-[#f59e0b] hover:bg-[var(--surface-interactive)] cursor-pointer"
									onClick={() => { clear(bindingKey); setOpen(false); }}
								>
									Clear binding only
								</div>
							)}
							<div
								className="px-3 py-2 text-xs text-[#dc2626] hover:bg-[var(--surface-interactive)] cursor-pointer"
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

// ADD these helper functions at the end of the file:
function getByPath(obj: any, path: string): unknown {
	if (!obj) return undefined;
	return path.split('.').reduce((current, segment) => current?.[segment], obj);
}

function removeByPath(obj: any, path: string): void {
	if (!obj) return;
	const segments = path.split('.');
	const last = segments.pop()!;
	const target = segments.reduce((current, segment) => {
		if (!current[segment]) return {};
		return current[segment];
	}, obj);
	delete target[last];
}