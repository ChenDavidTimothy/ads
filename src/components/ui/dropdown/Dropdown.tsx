'use client';

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useLayoutEffect,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface DropdownContextValue<T extends string = string> {
  value?: T;
  onChange?: (value: T) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  listboxId: string;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const DropdownContext = createContext<DropdownContextValue | null>(null);
function useDropdownCtx(): DropdownContextValue {
  const ctx = useContext(DropdownContext);
  if (!ctx) throw new Error('Dropdown components must be used within <Dropdown>');
  return ctx;
}

interface DropdownProps {
  value?: string;
  onChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function Dropdown({ value, onChange, children, className }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const listboxId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);

  const ctx = useMemo<DropdownContextValue>(
    () => ({
      value,
      onChange,
      isOpen,
      setIsOpen,
      listboxId,
      triggerRef,
    }),
    [value, onChange, isOpen, listboxId]
  );

  // Close on Escape globally when open
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  return (
    <div className={cn('relative', className)}>
      <DropdownContext.Provider value={ctx}>{children}</DropdownContext.Provider>
    </div>
  );
}

interface TriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  disabled?: boolean;
  'aria-label'?: string;
}

Dropdown.Trigger = function Trigger({ children, disabled, className, ...props }: TriggerProps) {
  const ctx = useDropdownCtx();

  const handleToggle = () => {
    if (disabled) return;
    ctx.setIsOpen(!ctx.isOpen);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      ctx.setIsOpen(true);
    }
  };

  return (
    <button
      ref={ctx.triggerRef}
      type="button"
      role="button"
      aria-haspopup="listbox"
      aria-expanded={ctx.isOpen}
      aria-controls={ctx.listboxId}
      disabled={disabled}
      className={cn('cursor-pointer', className)}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      {...props}
    >
      {children}
    </button>
  );
};

interface ContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  align?: 'start' | 'end';
  sideOffset?: number;
  className?: string;
  matchTriggerWidth?: boolean;
  maxHeight?: number;
}

Dropdown.Content = function Content({
  children,
  align = 'start',
  sideOffset = 4,
  className,
  matchTriggerWidth = true,
  maxHeight = 240,
  ...props
}: ContentProps) {
  const ctx = useDropdownCtx();
  const contentRef = useRef<HTMLDivElement>(null);
  const [portalStyle, setPortalStyle] = useState<React.CSSProperties | null>(null);

  useEffect(() => {
    if (!ctx.isOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      const t = e.target as Node;
      const triggerEl = ctx.triggerRef.current;
      if (
        contentRef.current &&
        !contentRef.current.contains(t) &&
        triggerEl &&
        !triggerEl.contains(t)
      ) {
        ctx.setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [ctx.isOpen, ctx]);

  // Compute and update portal position relative to viewport
  const updatePosition = () => {
    const triggerEl = ctx.triggerRef.current;
    if (!triggerEl) return;
    const rect = triggerEl.getBoundingClientRect();
    const width = matchTriggerWidth ? rect.width : undefined;
    const left = align === 'end' ? rect.right - (width ?? 0) : rect.left;
    const nextStyle: React.CSSProperties = {
      position: 'fixed',
      top: Math.min(window.innerHeight - 8, Math.max(8, rect.bottom + sideOffset)),
      left: Math.max(8, left),
      width,
      // Ensure above modal overlay which uses z-[9999]
      zIndex: 10001,
      maxHeight,
    };
    setPortalStyle(nextStyle);
  };

  // Observe scroll/resize on window and nearest scrollable ancestors
  useEffect(() => {
    if (!ctx.isOpen) return;
    updatePosition();

    const triggerEl = ctx.triggerRef.current;
    const ancestors: (Element | Window)[] = [window];
    let node: Element | null = triggerEl ? triggerEl.parentElement : null;
    while (node) {
      const style = window.getComputedStyle(node);
      const overflowY = style.overflowY;
      const overflow = style.overflow;
      if (/auto|scroll|overlay/.test(overflowY) || /auto|scroll|overlay/.test(overflow)) {
        ancestors.push(node);
      }
      node = node.parentElement;
    }
    const onScrollOrResize = () => updatePosition();
    window.addEventListener('resize', onScrollOrResize, { passive: true });
    ancestors.forEach((a) =>
      a.addEventListener?.(
        'scroll',
        onScrollOrResize as EventListener,
        { passive: true } as AddEventListenerOptions
      )
    );

    // Reposition on font/icon load/layout shifts
    const ro = new ResizeObserver(() => updatePosition());
    if (triggerEl) ro.observe(triggerEl);

    return () => {
      window.removeEventListener('resize', onScrollOrResize as EventListener);
      ancestors.forEach((a) =>
        a.removeEventListener?.('scroll', onScrollOrResize as EventListener)
      );
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.isOpen, align, sideOffset, matchTriggerWidth, maxHeight]);

  useLayoutEffect(() => {
    if (ctx.isOpen) updatePosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.isOpen]);

  if (!ctx.isOpen || !portalStyle) return null;

  const content = (
    <div
      ref={contentRef}
      role="listbox"
      id={ctx.listboxId}
      className={cn(
        'rounded-[var(--radius-sm)] border border-[var(--border-primary)] bg-[var(--surface-2)] shadow-lg',
        'overflow-auto',
        className
      )}
      style={portalStyle}
      {...props}
    >
      {children}
    </div>
  );

  return createPortal(content, document.body);
};

interface ItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  children: React.ReactNode;
  disabled?: boolean;
}

Dropdown.Item = function Item({ value, children, className, disabled, ...props }: ItemProps) {
  const ctx = useDropdownCtx();
  const isSelected = ctx.value === value;

  const handleClick = () => {
    if (disabled) return;
    ctx.onChange?.(value);
    ctx.setIsOpen(false);
  };

  return (
    <div
      role="option"
      aria-selected={isSelected}
      data-disabled={disabled ? 'true' : undefined}
      className={cn(
        'flex cursor-pointer items-center justify-between px-[var(--space-3)] py-[var(--space-2)] text-[12px]',
        'text-[var(--text-primary)] hover:bg-[var(--surface-interactive)]',
        isSelected ? 'bg-[var(--surface-interactive)]' : undefined,
        disabled ? 'cursor-not-allowed opacity-60' : undefined,
        className
      )}
      onClick={handleClick}
      {...props}
    >
      <div className="truncate">{children}</div>
      {isSelected && <div className="ml-2 text-[var(--accent-primary)]">✔</div>}
    </div>
  );
};
