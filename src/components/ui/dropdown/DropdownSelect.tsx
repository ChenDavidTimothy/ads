'use client';

import { Dropdown } from './Dropdown';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

type Option = {
  value: string;
  label: string;
  icon?: React.ReactNode;
  hint?: React.ReactNode;
  disabled?: boolean;
};

interface DropdownSelectProps {
  value: string | undefined;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  variant?: 'default' | 'glass' | 'minimal';
}

export function DropdownSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled,
  className,
  variant = 'default',
}: DropdownSelectProps) {
  const selected = options.find((o) => o.value === value);

  return (
    <Dropdown value={value} onChange={onChange}>
      <Dropdown.Trigger
        disabled={disabled}
        className={cn(
          'text-refined w-full text-left text-[12px] text-[var(--text-primary)] transition-all',
          'duration-[var(--duration-fast)] ease-[var(--easing-standard)]',
          'focus:ring-1 focus:ring-[var(--ring-color)] focus:outline-none',
          'flex items-center justify-between',
          {
            default:
              'rounded-[var(--radius-sm)] border border-[var(--border-primary)] bg-[var(--surface-2)] px-[var(--space-3)] py-[var(--space-2)]',
            glass: 'glass-input rounded-[var(--radius-sm)] px-[var(--space-3)] py-[var(--space-2)]',
            minimal:
              'rounded-none border-0 border-b border-[var(--border-primary)] bg-transparent px-0 py-[var(--space-1)]',
          }[variant],
          disabled ? 'opacity-60' : undefined,
          className
        )}
        aria-label={selected?.label ?? placeholder}
      >
        <span className={cn('truncate', !selected && 'text-[var(--text-muted)]')}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className="ml-2 h-4 w-4 text-[var(--text-secondary)]" />
      </Dropdown.Trigger>

      <Dropdown.Content>
        {options.map((o) => (
          <Dropdown.Item
            key={o.value}
            value={o.value}
            aria-disabled={o.disabled}
            className={o.disabled ? 'cursor-not-allowed' : undefined}
          >
            <div className="flex min-w-0 items-center gap-2">
              {o.icon && <span className="shrink-0">{o.icon}</span>}
              <span className="truncate">{o.label}</span>
            </div>
            {o.hint && (
              <div className="ml-2 shrink-0 text-[10px] text-[var(--text-tertiary)]">{o.hint}</div>
            )}
          </Dropdown.Item>
        ))}
      </Dropdown.Content>
    </Dropdown>
  );
}
