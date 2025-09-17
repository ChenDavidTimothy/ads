'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
  variant?: 'default' | 'glass' | 'minimal';
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, selected, variant = 'default', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'transition-all duration-[var(--duration-fast)] ease-[var(--easing-standard)]',
          {
            // Premium glass variant with enhanced styling
            default: 'rounded-[var(--radius-sm)] border backdrop-blur-[20px]',
            // Ultra-glass variant
            glass: 'glass-panel rounded-[var(--radius-sm)]',
            // Minimal variant
            minimal:
              'rounded-[var(--radius-sharp)] border border-[var(--border-primary)] bg-transparent',
          }[variant],
          selected
            ? 'border-[var(--accent-primary)] shadow-[0_0_0_1px_var(--purple-shadow-subtle)]'
            : '',
          className
        )}
        style={{
          ...(variant === 'default' && {
            background: `
              linear-gradient(135deg, rgba(139, 92, 246, 0.03) 0%, transparent 25%, transparent 75%, rgba(59, 130, 246, 0.02) 100%),
              linear-gradient(145deg, rgba(255, 255, 255, 0.04), transparent),
              rgba(12, 12, 20, 0.88)
            `,
            borderColor: selected ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.15)',
            boxShadow: selected
              ? 'inset 0 1px 0 rgba(255, 255, 255, 0.15), 0 4px 12px rgba(0, 0, 0, 0.4), 0 0 32px rgba(139, 92, 246, 0.12), 0 0 0 1px var(--purple-shadow-subtle)'
              : 'inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 2px 4px rgba(0, 0, 0, 0.6), 0 0 24px rgba(139, 92, 246, 0.04)',
          }),
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export const CardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('p-[var(--card-padding-sm)] pb-[var(--space-1)]', className)}
      {...props}
    />
  )
);

CardHeader.displayName = 'CardHeader';

export const CardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-[var(--card-padding-sm)] pt-0', className)} {...props} />
  )
);

CardContent.displayName = 'CardContent';
