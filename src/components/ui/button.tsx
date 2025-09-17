'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'glass' | 'minimal' | 'danger' | 'success' | 'ghost';
  interaction?: 'always' | 'hover' | 'conditional';
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = 'primary', size = 'md', interaction = 'always', children, ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          'text-refined-medium inline-flex cursor-pointer items-center justify-center font-medium transition-all',
          'duration-[var(--duration-fast)] ease-[var(--easing-standard)]',
          'focus:ring-1 focus:ring-[var(--ring-color)] focus:ring-offset-1 focus:ring-offset-[var(--surface-0)] focus:outline-none',
          'rounded-[var(--radius-sm)] disabled:cursor-not-allowed disabled:opacity-40',
          // Ultra-compact sizing
          {
            xs: 'h-6 px-[var(--space-2)] py-[var(--space-half)] text-[10px]',
            sm: 'h-7 px-[var(--space-3)] py-[var(--space-1)] text-[11px]',
            md: 'h-8 px-[var(--space-4)] py-[var(--space-2)] text-[12px]',
            lg: 'h-9 px-[var(--space-5)] py-[var(--space-3)] text-[13px]',
          }[size],
          // Premium glass variants
          {
            primary: 'btn-primary-glass',
            secondary: 'btn-secondary-glass',
            glass: 'glass-button text-[var(--text-primary)]',
            minimal:
              'border border-transparent bg-transparent text-[var(--text-tertiary)] hover:bg-[var(--button-ghost-hover)] hover:text-[var(--text-primary)]',
            danger: 'btn-danger-glass',
            success: 'btn-success-glass',
            ghost:
              'border border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-[var(--button-ghost-hover)] hover:text-[var(--text-primary)]',
          }[variant],
          // Interaction state classes
          {
            always: '',
            hover: 'opacity-0 transition-opacity group-hover:opacity-100',
            conditional: 'data-[show=false]:opacity-0 data-[show=true]:opacity-100',
          }[interaction || 'always'],
          className
        )}
        style={{
          ...(variant === 'primary' && {
            background: `
              linear-gradient(135deg, rgba(139, 92, 246, 0.28) 0%, rgba(139, 92, 246, 0.15) 50%, rgba(59, 130, 246, 0.1) 100%),
              linear-gradient(145deg, rgba(139, 92, 246, 0.1), transparent),
              rgba(139, 92, 246, 0.15)
            `,
            border: '1px solid rgba(139, 92, 246, 0.4)',
            backdropFilter: 'blur(16px)',
            color: 'var(--text-primary)',
            boxShadow:
              'inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 2px 4px rgba(0, 0, 0, 0.6), 0 0 24px rgba(139, 92, 246, 0.12)',
          }),
          ...(variant === 'secondary' && {
            background: `
              linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, transparent 35%, rgba(59, 130, 246, 0.015) 100%),
              linear-gradient(145deg, rgba(255, 255, 255, 0.04), transparent),
              rgba(12, 12, 20, 0.88)
            `,
            border: '1px solid rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(16px)',
            color: 'var(--text-secondary)',
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 2px 4px rgba(0, 0, 0, 0.6)',
          }),
          ...(variant === 'success' && {
            background: `
              linear-gradient(135deg, rgba(16, 185, 129, 0.28) 0%, rgba(16, 185, 129, 0.15) 50%, rgba(34, 211, 238, 0.08) 100%),
              linear-gradient(145deg, rgba(16, 185, 129, 0.1), transparent),
              rgba(16, 185, 129, 0.15)
            `,
            border: '1px solid rgba(16, 185, 129, 0.4)',
            backdropFilter: 'blur(16px)',
            color: 'var(--text-primary)',
            boxShadow:
              'inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 2px 4px rgba(0, 0, 0, 0.6), 0 0 24px rgba(16, 185, 129, 0.12)',
          }),
          ...(variant === 'danger' && {
            background: `
              linear-gradient(135deg, rgba(239, 68, 68, 0.28) 0%, rgba(239, 68, 68, 0.15) 50%, rgba(245, 158, 11, 0.08) 100%),
              linear-gradient(145deg, rgba(239, 68, 68, 0.1), transparent),
              rgba(239, 68, 68, 0.15)
            `,
            border: '1px solid rgba(239, 68, 68, 0.4)',
            backdropFilter: 'blur(16px)',
            color: 'var(--text-primary)',
            boxShadow:
              'inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 2px 4px rgba(0, 0, 0, 0.6), 0 0 24px rgba(239, 68, 68, 0.12)',
          }),
        }}
        onMouseEnter={(e) => {
          if (variant === 'primary') {
            e.currentTarget.style.background = `
              linear-gradient(135deg, rgba(139, 92, 246, 0.4) 0%, rgba(139, 92, 246, 0.22) 50%, rgba(59, 130, 246, 0.15) 100%),
              linear-gradient(145deg, rgba(139, 92, 246, 0.15), transparent),
              rgba(139, 92, 246, 0.22)
            `;
            e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)';
            e.currentTarget.style.boxShadow =
              'inset 0 1px 0 rgba(255, 255, 255, 0.22), 0 4px 12px rgba(0, 0, 0, 0.4), 0 0 36px rgba(139, 92, 246, 0.18)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          } else if (variant === 'secondary') {
            e.currentTarget.style.background = `
              linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, transparent 30%, rgba(59, 130, 246, 0.025) 100%),
              linear-gradient(145deg, rgba(255, 255, 255, 0.07), transparent),
              rgba(18, 18, 28, 0.92)
            `;
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.22)';
            e.currentTarget.style.color = 'var(--text-primary)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }
        }}
        onMouseLeave={(e) => {
          if (variant === 'primary') {
            e.currentTarget.style.background = `
              linear-gradient(135deg, rgba(139, 92, 246, 0.28) 0%, rgba(139, 92, 246, 0.15) 50%, rgba(59, 130, 246, 0.1) 100%),
              linear-gradient(145deg, rgba(139, 92, 246, 0.1), transparent),
              rgba(139, 92, 246, 0.15)
            `;
            e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.4)';
            e.currentTarget.style.boxShadow =
              'inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 2px 4px rgba(0, 0, 0, 0.6), 0 0 24px rgba(139, 92, 246, 0.12)';
            e.currentTarget.style.transform = 'translateY(0)';
          } else if (variant === 'secondary') {
            e.currentTarget.style.background = `
              linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, transparent 35%, rgba(59, 130, 246, 0.015) 100%),
              linear-gradient(145deg, rgba(255, 255, 255, 0.04), transparent),
              rgba(12, 12, 20, 0.88)
            `;
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
            e.currentTarget.style.color = 'var(--text-secondary)';
            e.currentTarget.style.transform = 'translateY(0)';
          }
        }}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
