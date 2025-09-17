'use client';

import { forwardRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'manual' | 'bound' | 'result';
  onRemove?: () => void;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', children, onRemove, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1 px-[var(--space-2)] py-[var(--space-half)]',
          'rounded-[var(--radius-sm)] border text-[10px] font-medium',
          className
        )}
        style={{
          ...(variant === 'default' && {
            background: 'transparent',
            borderColor: 'var(--border-primary)',
            color: 'var(--text-tertiary)',
          }),
          ...(variant === 'manual' && {
            background: `
              linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, transparent 60%),
              rgba(245, 158, 11, 0.1)
            `,
            borderColor: 'rgba(245, 158, 11, 0.5)',
            color: '#f59e0b',
          }),
          ...(variant === 'bound' && {
            background: `
              linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, transparent 60%),
              rgba(59, 130, 246, 0.1)
            `,
            borderColor: 'rgba(59, 130, 246, 0.5)',
            color: 'var(--text-primary)',
          }),
          ...(variant === 'result' && {
            background: `
              linear-gradient(135deg, rgba(139, 92, 246, 0.25) 0%, transparent 60%),
              rgba(139, 92, 246, 0.15)
            `,
            borderColor: 'rgba(139, 92, 246, 0.4)',
            color: 'var(--text-primary)',
          }),
        }}
        {...props}
      >
        {children}
        {onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="ml-1 cursor-pointer rounded-sm p-0.5 transition-colors hover:bg-black/10"
            title="Reset to default"
          >
            <X size={8} />
          </button>
        )}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
