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
		<div className="w-64 border-r border-gray-700 p-3 bg-gray-850">
			<div className="text-xs text-gray-400 mb-2">{title}</div>
			<div className="space-y-2 max-h-full overflow-y-auto bg-gray-700 rounded p-3">
				{items.length === 0 ? (
					<div className="text-xs text-gray-500 text-center py-4 border-2 border-dashed border-gray-600 rounded">{emptyLabel}</div>
				) : (
					items.map((item) => {
						const isSelected = selectedId === item.id;
						return (
							<div
								key={item.id}
								className={`flex items-center space-x-3 py-1 px-2 rounded cursor-pointer ${isSelected ? 'bg-blue-600/30' : 'hover:bg-gray-600/40'}`}
								onClick={() => onSelect(item.id)}
							>
								<input type="radio" checked={isSelected} readOnly className="rounded" />
								<span className="text-sm text-white truncate flex-1">{item.label}</span>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}