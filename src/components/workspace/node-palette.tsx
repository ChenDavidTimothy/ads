// src/components/workspace/node-palette.tsx - Registry-driven node palette
"use client";

import { useState, useMemo, useCallback } from "react";
import { type XYPosition } from "reactflow";
import { Search, Shapes, Clock, Cpu, Monitor, Database, Type, Edit } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CollapsibleSection } from './flow/components/collapsible-section';
import { generateNodeColors, generateNodePalette } from "@/shared/registry/registry-utils";

interface NodePaletteProps {
	onAddNode: (nodeType: string, position: XYPosition) => void;
}

export function NodePalette({ onAddNode }: NodePaletteProps) {
	// Generate palette structure from registry
	const palette = generateNodePalette();
	const nodeColors = generateNodeColors();

	// Search state
	const [query, setQuery] = useState('');
	const isSearching = query.trim().length > 0;

	// All nodes for search
	const allNodes = useMemo(() => [
		...palette.geometryNodes,
		...palette.textNodes,
		...palette.dataNodes,
		...palette.timingNodes, 
		...palette.logicNodes,
		...palette.animationNodes,
		...palette.outputNodes
	], [palette]);

	// Filtered search results
	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return [];
		return allNodes.filter(node => node.label.toLowerCase().includes(q));
	}, [allNodes, query]);

	// Reusable node button renderer
	const renderNodeButton = useCallback((node: {type: string; label: string; icon: string}) => {
		const handleNodeClick = (nodeType: string) => {
			onAddNode(nodeType, { x: 250, y: 250 });
		};

		return (
			<Button
				key={node.type}
				onClick={() => handleNodeClick(node.type)}
				className="w-full justify-start gap-[var(--space-3)] bg-[var(--surface-2)] hover:bg-[var(--surface-interactive)] border border-[var(--border-primary)]"
				size="md"
			>
				{/* Category color indicator */}
				<span className={`inline-block w-1.5 h-4 rounded-[var(--radius-sm)] ${nodeColors[node.type]?.primary ?? 'bg-[var(--accent-primary)]'}`} />
				{/* Placeholder for future icon system; keep label tight */}
				<span className="text-[13px]">{node.label}</span>
			</Button>
		);
	}, [onAddNode, nodeColors]);

	// Category section renderer using CollapsibleSection
	const renderCategorySection = (title: string, nodes: Array<{type: string; label: string; icon: string}>, iconComponent: React.ReactNode) => {
		if (nodes.length === 0) return null;
		
		return (
			<CollapsibleSection
				title={title}
				icon={iconComponent}
				defaultExpanded={true}
				persistKey={`nodes-${title.toLowerCase()}`}
			>
				<div className="space-y-[var(--space-2)]">
					{nodes.map(renderNodeButton)}
				</div>
			</CollapsibleSection>
		);
	};

	return (
		<div className="w-[var(--sidebar-width)] bg-[var(--surface-1)] border-r border-[var(--border-primary)] p-[var(--space-4)] overflow-y-auto">
			<h2 className="text-base font-semibold text-[var(--text-primary)] mb-[var(--space-4)]">Nodes</h2>
			
			{/* Search Input - Always Visible */}
			<div className="relative mb-[var(--space-4)]">
				<Input
					placeholder="Search nodes..."
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					className="pl-8 text-sm h-8"
				/>
				<Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
			</div>

			{/* Search Results - Visible When Searching */}
			{isSearching && (
				<div className="mb-[var(--space-4)]">
					<h3 className="text-xs font-semibold text-[var(--text-tertiary)] mb-[var(--space-3)] uppercase">
						Search Results ({filtered.length})
					</h3>
					{filtered.length === 0 ? (
						<div className="text-sm text-[var(--text-tertiary)] text-center py-4">
							No nodes found
						</div>
					) : (
						<div className="space-y-[var(--space-2)]">
							{filtered.map(renderNodeButton)}
						</div>
					)}
				</div>
			)}

			{/* Category Sections - Hidden When Searching */}
			{!isSearching && (
				<>
					{renderCategorySection("Geometry", palette.geometryNodes, <Shapes size={16} />)}
					{renderCategorySection("Text", palette.textNodes, <Type size={16} />)}
					{renderCategorySection("Data", palette.dataNodes, <Database size={16} />)}
					{renderCategorySection("Timing", palette.timingNodes, <Clock size={16} />)}
					{renderCategorySection("Logic", palette.logicNodes, <Cpu size={16} />)}
					{renderCategorySection("Editor", palette.animationNodes, <Edit size={16} />)}
					{renderCategorySection("Output", palette.outputNodes, <Monitor size={16} />)}
				</>
			)}
		</div>
	);
}