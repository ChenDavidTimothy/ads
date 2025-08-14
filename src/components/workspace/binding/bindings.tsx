import React, { useMemo, useState } from 'react';
import { Link as LinkIcon } from 'lucide-react';
import { useWorkspace } from '@/components/workspace/workspace-context';
import { FlowTracker } from '@/lib/flow/flow-tracking';

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

	return { variables, getBinding, getBoundName, bind, clear } as const;
}

export function BindButton({ nodeId, bindingKey, objectId, className }: BindButtonProps) {
	const { variables, getBinding, getBoundName, bind, clear } = useVariableBinding(nodeId, objectId);
	const [open, setOpen] = useState(false);
	const boundId = getBinding(bindingKey);
	const boundName = getBoundName(boundId);

	return (
		<div className={`relative ${className ?? ''}`}>
			<button
				type="button"
				title={boundId ? `Bound to ${boundName ?? boundId}` : 'Bind to Result variable'}
				onClick={() => setOpen(v => !v)}
				className={`p-1 rounded hover:bg-[var(--surface-interactive)] ${boundId ? 'text-[var(--accent-500)]' : ''}`}
			>
				<LinkIcon size={14} />
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
						</>
					)}
				</div>
			)}
		</div>
	);
}