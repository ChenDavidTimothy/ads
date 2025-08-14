"use client";

import React from 'react';

interface ObjectSelectionPanelProps {
	items: Array<{ id: string; label: string }>;
	selectedId: string | null;
	onSelect: (id: string) => void;
	emptyLabel?: string;
	title?: string;
}

export function ObjectSelectionPanel({ items, selectedId, onSelect, emptyLabel = 'No items', title = 'Objects' }: ObjectSelectionPanelProps) {
	return (
		<div className="w-[var(--sidebar-width)] border-r border-[var(--border-primary)] p-[var(--space-3)] bg-[var(--surface-1)]">
			<div className="text-xs text-[var(--text-tertiary)] mb-[var(--space-2)]">{title}</div>
			<div className="space-y-[var(--space-2)] max-h-full overflow-y-auto bg-[var(--surface-2)] rounded-[var(--radius-sm)] p-[var(--space-3)]">
				{items.length === 0 ? (
					<div className="text-xs text-[var(--text-tertiary)] text-center py-[var(--space-4)] border-2 border-dashed border-[var(--border-primary)] rounded-[var(--radius-sm)]">{emptyLabel}</div>
				) : (
					items.map((item) => {
						const isSelected = selectedId === item.id;
						return (
							<div
								key={item.id}
								className={`flex items-center space-x-3 py-[var(--space-1)] px-[var(--space-2)] rounded-[var(--radius-sm)] cursor-pointer ${isSelected ? 'bg-[color:rgba(59,130,246,0.2)]' : 'hover:bg-[var(--surface-interactive)]'}`}
								onClick={() => onSelect(item.id)}
							>
								<input type="radio" checked={isSelected} readOnly className="rounded" />
								<span className="text-sm text-[var(--text-primary)] truncate flex-1">{item.label}</span>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}