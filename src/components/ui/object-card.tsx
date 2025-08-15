"use client";

import { SelectionCard } from './selection-card';

interface ObjectCardProps {
  id: string;
  label: string;
  type?: string;
  icon?: string;
  color?: string;
  selected: boolean;
  onSelect: () => void;
  variant?: 'single' | 'multi';
  showType?: boolean;
}

export function ObjectCard({ 
  id, 
  label, 
  type, 
  icon, 
  color, 
  selected, 
  onSelect,
  variant = 'single',
  showType = true 
}: ObjectCardProps) {
  return (
    <SelectionCard selected={selected} onSelect={onSelect} variant={variant}>
      <div className="flex items-center gap-[var(--space-2)] min-w-0">
        {/* Object type indicator */}
        {(icon || color) && (
          <div 
            className="w-6 h-6 rounded-[var(--radius-sm)] border border-[var(--border-secondary)] flex items-center justify-center text-xs flex-shrink-0"
            style={{ backgroundColor: color || 'var(--surface-2)' }}
          >
            {icon || '○'}
          </div>
        )}
        
        {/* Object info */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-[var(--text-primary)] truncate">
            {label}
          </div>
          {showType && type && (
            <div className="text-xs text-[var(--text-tertiary)] truncate">
              {type}
            </div>
          )}
        </div>
      </div>
    </SelectionCard>
  );
}
