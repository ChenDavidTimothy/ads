'use client';

import { cn } from '@/lib/utils';
import { Button } from './button';
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  variant?: 'glass' | 'solid';
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'lg',
  className,
  variant = 'glass',
}: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm"
      style={{ backgroundColor: 'var(--modal-backdrop-blur)' }}
      onClick={handleBackdropClick}
    >
      <div
        className={cn(
          'flex flex-col outline-none',
          {
            'max-h-[32rem] w-[28rem]': size === 'sm',
            'max-h-[36rem] w-[40rem]': size === 'md',
            'max-h-[44rem] w-[56rem]': size === 'lg',
            'max-h-[80vh] w-[72rem]': size === 'xl',
          },
          'max-h-[90vh] max-w-[95vw] rounded-[var(--radius-md)]',
          className
        )}
        style={{
          ...(variant === 'glass' && {
            background: `
              linear-gradient(135deg, rgba(139, 92, 246, 0.03) 0%, transparent 25%, transparent 75%, rgba(59, 130, 246, 0.02) 100%),
              linear-gradient(145deg, rgba(255, 255, 255, 0.04), transparent),
              rgba(12, 12, 20, 0.92)
            `,
            border: '1px solid rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(24px)',
            boxShadow:
              'inset 0 1px 0 rgba(255, 255, 255, 0.15), 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 48px rgba(139, 92, 246, 0.08)',
          }),
          ...(variant === 'solid' && {
            background: 'var(--surface-1)',
            border: '1px solid var(--border-primary)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          }),
        }}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div
            className="flex items-center justify-between border-b p-[var(--space-4)]"
            style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}
          >
            <h2 className="text-refined-medium text-[14px] font-medium text-[var(--text-primary)]">
              {title}
            </h2>
            <Button variant="minimal" size="xs" onClick={onClose} aria-label="Close modal">
              ✕
            </Button>
          </div>
        )}
        <div className="scrollbar-elegant flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
