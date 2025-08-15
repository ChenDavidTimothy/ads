import React from 'react';

interface SelectionItemProps {
  id: string;
  label: string;
  icon?: string;
  color?: string;
  selected: boolean;
  onSelect: () => void;
  mode: 'single' | 'multi';
}

export function SelectionItem({
  id,
  label,
  icon,
  color,
  selected,
  onSelect,
  mode
}: SelectionItemProps) {
  const baseClasses = [
    'flex items-center gap-2 px-2 py-1',
    'bg-[var(--surface-2)] border border-[var(--border-primary)]',
    'rounded-[var(--radius-sm)] cursor-pointer',
    'transition-all duration-[var(--duration-fast)] ease-[var(--easing-standard)]',
    'hover:bg-[var(--surface-interactive)] hover:border-[var(--accent-primary)]',
    'focus-visible:outline-none focus-visible:ring-[var(--ring-width)] focus-visible:ring-[var(--ring-color)]'
  ].join(' ');

  const selectedClasses = selected ? [
    'bg-[var(--purple-shadow-subtle)] border-[var(--accent-primary)]',
    'shadow-[0_0_0_1px_var(--ring-color)]'
  ].join(' ') : '';

  const multiSelectedClasses = mode === 'multi' && selected ? [
    'bg-[var(--purple-shadow-medium)] border-[var(--accent-primary)]',
    'border-2 shadow-[0_0_0_1px_var(--ring-color)]'
  ].join(' ') : '';

  const finalClasses = [baseClasses, selectedClasses, multiSelectedClasses].filter(Boolean).join(' ');

  return (
    <div
      className={finalClasses}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      {icon && (
        <span className="text-sm" style={{ color: color }}>
          {icon}
        </span>
      )}
      <span className="text-sm text-[var(--foreground)] truncate">
        {label}
      </span>
    </div>
  );
}
