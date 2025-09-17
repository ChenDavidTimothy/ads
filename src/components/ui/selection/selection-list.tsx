import React from 'react';
import { SelectionItem } from './selection-item';

interface SelectionListProps<T = string> {
  items: Array<{ id: T; label: string; icon?: string; color?: string }>;

  // Single selection mode
  selectedId?: T | null;
  onSelect?: (id: T) => void;

  // Multi selection mode
  selectedIds?: T[];
  onToggle?: (id: T) => void;

  // Multi selection actions
  onSelectAll?: () => void;
  onSelectNone?: () => void;

  // Configuration
  mode: 'single' | 'multi';
  showDefault?: boolean;
  defaultLabel?: string;
  emptyLabel?: string;
  className?: string;
}

export function SelectionList<T = string>({
  items,
  selectedId,
  onSelect,
  selectedIds = [],
  onToggle,
  onSelectAll,
  onSelectNone,
  mode,
  showDefault = false,
  defaultLabel = 'Default',
  emptyLabel = 'No items available',
  className = '',
}: SelectionListProps<T>) {
  const handleSelect = (id: T) => {
    if (mode === 'single' && onSelect) {
      onSelect(id);
    } else if (mode === 'multi' && onToggle) {
      onToggle(id);
    }
  };

  const isSelected = (id: T) => {
    if (mode === 'single') {
      return selectedId === id;
    } else {
      return selectedIds.includes(id);
    }
  };

  const renderDefaultOption = () => {
    if (!showDefault) return null;

    return (
      <SelectionItem
        id="default"
        label={defaultLabel}
        selected={selectedId === null}
        onSelect={() => onSelect?.(null as T)}
        mode={mode}
      />
    );
  };

  const renderMultiSelectionActions = () => {
    if (mode !== 'multi' || !onSelectAll || !onSelectNone) return null;

    return (
      <div className="mb-2 flex gap-2">
        <button
          onClick={onSelectAll}
          className="rounded-[var(--radius-sm)] border border-[var(--border-primary)] bg-[var(--surface-2)] px-2 py-1 text-xs transition-colors hover:bg-[var(--surface-interactive)]"
        >
          Select All
        </button>
        <button
          onClick={onSelectNone}
          className="rounded-[var(--radius-sm)] border border-[var(--border-primary)] bg-[var(--surface-2)] px-2 py-1 text-xs transition-colors hover:bg-[var(--surface-interactive)]"
        >
          Select None
        </button>
      </div>
    );
  };

  if (items.length === 0 && !showDefault) {
    return (
      <div className={`p-2 text-sm text-[var(--foreground-muted)] ${className}`}>{emptyLabel}</div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {renderMultiSelectionActions()}
      {renderDefaultOption()}
      {items.map((item) => (
        <SelectionItem
          key={String(item.id)}
          id={String(item.id)}
          label={item.label}
          icon={item.icon}
          color={item.color}
          selected={isSelected(item.id)}
          onSelect={() => handleSelect(item.id)}
          mode={mode}
        />
      ))}
    </div>
  );
}
