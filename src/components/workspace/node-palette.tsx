// src/components/workspace/node-palette.tsx - Registry-driven node palette
"use client";

import { type XYPosition } from "reactflow";
import { Button } from "@/components/ui/button";
import { generateNodeColors, generateNodePalette } from "@/shared/registry/registry-utils";

interface NodePaletteProps {
	onAddNode: (nodeType: string, position: XYPosition) => void;
}

export function NodePalette({ onAddNode }: NodePaletteProps) {
	// Generate palette structure from registry
	const palette = generateNodePalette();
	const nodeColors = generateNodeColors();

	const handleNodeClick = (nodeType: string) => {
		onAddNode(nodeType, { x: 250, y: 250 });
	};

	const renderNodeSection = (
		title: string,
		nodes: Array<{ type: string; label: string; icon: string }>
	) => {
		if (nodes.length === 0) return null;

		return (
			<div className="mb-[var(--space-6)]">
				<h3 className="text-xs font-semibold text-[var(--text-tertiary)] mb-[var(--space-3)] uppercase tracking-wide">
					{title}
				</h3>
				<div className="space-y-[var(--space-2)]">
					{nodes.map((node) => (
						<Button
							key={node.type}
							onClick={() => handleNodeClick(node.type)}
							className="w-full justify-start gap-[var(--space-3)] bg-[var(--surface-2)] hover:bg-[var(--surface-interactive)] border border-[var(--border-primary)]"
							size="md"
						>
							{/* Category color indicator */}
							<span className={`inline-block w-1.5 h-4 rounded-[var(--radius-sm)] ${nodeColors[node.type]?.primary ?? 'bg-[var(--accent-500)]'}`} />
							{/* Placeholder for future icon system; keep label tight */}
							<span className="text-[13px]">{node.label}</span>
						</Button>
					))}
				</div>
			</div>
		);
	};

	return (
		<div className="w-[var(--sidebar-width)] bg-[var(--surface-1)] border-r border-[var(--border-primary)] p-[var(--space-4)] overflow-y-auto">
			<h2 className="text-base font-semibold text-[var(--text-primary)] mb-[var(--space-4)]">Nodes</h2>
			{renderNodeSection("Geometry", palette.geometryNodes)}
			{renderNodeSection("Timing", palette.timingNodes)}
			{renderNodeSection("Logic", palette.logicNodes)}
			{renderNodeSection("Animation", palette.animationNodes)}
			{renderNodeSection("Output", palette.outputNodes)}
		</div>
	);
}