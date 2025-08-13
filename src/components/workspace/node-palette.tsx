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
			<div className="mb-6">
				<h3 className="text-xs font-semibold text-[var(--text-tertiary)] mb-3 uppercase tracking-wide">
					{title}
				</h3>
				<div className="space-y-2">
					{nodes.map((node) => (
						<Button
							key={node.type}
							onClick={() => handleNodeClick(node.type)}
							className={`w-full justify-start gap-3 ${nodeColors[node.type]?.primary ?? 'bg-[var(--surface-2)]'} hover:opacity-90`}
							size="md"
						>
							<span className="text-lg">{node.icon}</span>
							<span>{node.label}</span>
						</Button>
					))}
				</div>
			</div>
		);
	};

	return (
		<div className="w-64 bg-[var(--surface-1)] border-r border-[var(--border-primary)] p-4 overflow-y-auto">
			<h2 className="text-base font-semibold text-[var(--text-primary)] mb-4">Nodes</h2>
			{renderNodeSection("Geometry", palette.geometryNodes)}
			{renderNodeSection("Timing", palette.timingNodes)}
			{renderNodeSection("Logic", palette.logicNodes)}
			{renderNodeSection("Animation", palette.animationNodes)}
			{renderNodeSection("Output", palette.outputNodes)}
		</div>
	);
}