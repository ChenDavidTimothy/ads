"use client";

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface SelectionCardProps {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
  variant?: 'single' | 'multi';
  disabled?: boolean;
  className?: string;
}

export function SelectionCard({ 
  selected, 
  onSelect, 
  children, 
  variant = 'single',
  disabled = false,
  className 
}: SelectionCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={cn(
        // Base glass morphism styling
        "glass-panel cursor-pointer transition-all duration-[var(--duration-fast)]",
        "p-[var(--space-3)] rounded-[var(--radius-md)]",
        "border-2 backdrop-filter backdrop-blur-sm",
        
        // Selection states with purple/cyan theme
        selected 
          ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 shadow-lg shadow-[var(--accent-primary)]/20" 
          : "border-[var(--border-primary)] hover:border-[var(--accent-secondary)]/50 hover:bg-[var(--glass-bg)]",
          
        // Multi-selection specific styling
        variant === 'multi' && selected && "ring-2 ring-[var(--accent-secondary)]/30",
        
        // Disabled state
        disabled && "opacity-50 cursor-not-allowed",
        
        // Hover effects
        isHovered && !selected && "shadow-md shadow-[var(--accent-secondary)]/20",
        
        className
      )}
      onClick={disabled ? undefined : onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (!disabled) onSelect();
        }
      }}
      role="button"
      aria-pressed={selected}
      aria-disabled={disabled}
    >
      <div className="flex items-center gap-[var(--space-3)]">
        {/* Visual selection indicator instead of input */}
        <div 
          className={cn(
            "w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center flex-shrink-0",
            selected 
              ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]" 
              : "border-[var(--border-secondary)]",
            variant === 'multi' && "rounded-[var(--radius-sm)]" // Square for multi-select
          )}
        >
          {selected && (
            <div className={cn(
              "transition-all",
              variant === 'single' 
                ? "w-2 h-2 rounded-full bg-[var(--text-primary)]"
                : "w-2 h-2 bg-[var(--text-primary)] rounded-[1px]" // Small square for multi
            )} />
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}
