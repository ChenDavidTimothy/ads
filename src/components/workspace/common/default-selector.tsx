"use client";

import { SelectionCard } from '@/components/ui/selection-card';

interface DefaultSelectorProps {
  onClick: () => void;
  active: boolean;
  disabled?: boolean;
}

export function DefaultSelector({ onClick, active, disabled }: DefaultSelectorProps) {
  return (
    <SelectionCard 
      selected={active} 
      onSelect={onClick} 
      disabled={disabled}
      className="mb-[var(--space-2)]"
    >
      <div className="flex items-center gap-[var(--space-2)]">
        <div className="w-6 h-6 rounded-[var(--radius-sm)] border border-[var(--border-secondary)] flex items-center justify-center text-xs bg-[var(--surface-2)]">
          ⚙️
        </div>
        <div>
          <div className="text-sm font-medium text-[var(--text-primary)]">Default</div>
          <div className="text-xs text-[var(--text-tertiary)]">Base properties</div>
        </div>
      </div>
    </SelectionCard>
  );
}
