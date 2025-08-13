// src/components/workspace/flow/components/RightSidebar.tsx
import type { Edge, Node } from 'reactflow';
import { PropertyPanel } from '@/components/workspace/property-panel';
import type { NodeData } from '@/shared/types';
import type { FlowTracker } from '@/lib/flow/flow-tracking';

interface Props {
	node: Node<NodeData> | undefined;
	allNodes: Node<NodeData>[];
	allEdges: Edge[];
	onChange: (newData: Partial<NodeData>) => void;
	onDisplayNameChange: (nodeId: string, displayName: string) => boolean;
	validateDisplayName: (name: string, nodeId: string) => string | null;
	flowTracker: FlowTracker;
}

export function RightSidebar({ node, allNodes, allEdges, onChange, onDisplayNameChange, validateDisplayName, flowTracker }: Props) {
	if (!node) return null;
	return (
		<div className="w-80 bg-[var(--surface-1)] border-l border-[var(--border-primary)] p-4 overflow-y-auto">
			<h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
				{node.type?.charAt(0).toUpperCase()}
				{node.type?.slice(1)} Properties
			</h3>
			<PropertyPanel
				node={node}
				onChange={(newData: Partial<NodeData>) => onChange(newData)}
				onDisplayNameChange={onDisplayNameChange}
				validateDisplayName={validateDisplayName}
				allNodes={allNodes}
				allEdges={allEdges}
				flowTracker={flowTracker}
			/>
		</div>
	);
}


