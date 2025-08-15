"use client";

import { Button } from '@/components/ui/button';
import { ObjectCard } from '@/components/ui/object-card';

interface ObjectSelectionPanelProps {
  items: Array<{ 
    id: string; 
    label: string; 
    type?: string;
    icon?: string;
    color?: string;
  }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyLabel?: string;
  title?: string;
  variant?: 'single' | 'multi';
  selectedIds?: string[]; // For multi-selection
  onToggle?: (id: string) => void; // For multi-selection
  onSelectAll?: () => void; // For bulk select all operation
  onSelectNone?: () => void; // For bulk select none operation
}

export function ObjectSelectionPanel({ 
  items, 
  selectedId, 
  onSelect, 
  emptyLabel = 'No items', 
  title = 'Objects',
  variant = 'single',
  selectedIds = [],
  onToggle,
  onSelectAll,
  onSelectNone
}: ObjectSelectionPanelProps) {
  const handleSelect = (id: string) => {
    if (variant === 'multi' && onToggle) {
      onToggle(id);
    } else {
      onSelect(id);
    }
  };

  const isSelected = (id: string) => {
    return variant === 'multi' 
      ? selectedIds.includes(id)
      : selectedId === id;
  };



  return (
    <div className="space-y-[var(--space-2)]">
      <div className="flex items-center justify-between">
        <div className="text-xs text-[var(--text-secondary)] font-medium">{title}</div>
        {variant === 'multi' && items.length > 0 && (
          <div className="flex gap-[var(--space-1)]">
            <Button 
              variant="ghost" 
              size="xs" 
              onClick={onSelectAll}
              className="text-xs"
            >
              All
            </Button>
            <Button 
              variant="ghost" 
              size="xs" 
              onClick={onSelectNone}
              className="text-xs"
            >
              None
            </Button>
          </div>
        )}
      </div>
      
      <div className="space-y-[var(--space-2)] max-h-64 overflow-y-auto scrollbar-elegant">
        {items.length === 0 ? (
          <div className="glass-panel p-[var(--space-4)] text-center border-2 border-dashed border-[var(--border-secondary)]">
            <div className="text-xs text-[var(--text-tertiary)]">{emptyLabel}</div>
          </div>
        ) : (
          items.map((item) => (
            <ObjectCard
              key={item.id}
              id={item.id}
              label={item.label}
              type={item.type}
              icon={item.icon}
              color={item.color}
              selected={isSelected(item.id)}
              onSelect={() => handleSelect(item.id)}
              variant={variant}
            />
          ))
        )}
      </div>
    </div>
  );
}