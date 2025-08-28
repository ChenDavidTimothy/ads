"use client";

import { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface DropdownContextValue<T extends string = string> {
  value?: T;
  onChange?: (value: T) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  listboxId: string;
  triggerRef: React.RefObject<HTMLButtonElement>;
}

const DropdownContext = createContext<DropdownContextValue | null>(null);
function useDropdownCtx(): DropdownContextValue {
  const ctx = useContext(DropdownContext);
  if (!ctx) throw new Error("Dropdown components must be used within <Dropdown>");
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

  const ctx = useMemo<DropdownContextValue>(() => ({
    value,
    onChange,
    isOpen,
    setIsOpen,
    listboxId,
    triggerRef,
  }), [value, onChange, isOpen, listboxId]);

  // Close on Escape globally when open
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  return (
    <div className={cn("relative", className)}>
      <DropdownContext.Provider value={ctx}>{children}</DropdownContext.Provider>
    </div>
  );
}

interface TriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  disabled?: boolean;
  "aria-label"?: string;
}

Dropdown.Trigger = function Trigger({ children, disabled, className, ...props }: TriggerProps) {
  const ctx = useDropdownCtx();
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleToggle = () => {
    if (disabled) return;
    ctx.setIsOpen(!ctx.isOpen);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      ctx.setIsOpen(true);
    }
  };

  useEffect(() => {
    if (!ctx.isOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (buttonRef.current && !buttonRef.current.contains(t)) {
        // Content handles its own outside click; this is a safeguard
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [ctx.isOpen]);

  return (
    <button
      ref={(el) => {
        (buttonRef as React.MutableRefObject<HTMLButtonElement | null>).current = el;
        (ctx.triggerRef as React.MutableRefObject<HTMLButtonElement | null>).current = el ?? null;
      }}
      type="button"
      role="button"
      aria-haspopup="listbox"
      aria-expanded={ctx.isOpen}
      aria-controls={ctx.listboxId}
      disabled={disabled}
      className={className}
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
  align?: "start" | "end";
  sideOffset?: number;
  className?: string;
  matchTriggerWidth?: boolean;
  maxHeight?: number;
}

Dropdown.Content = function Content({ children, align = "start", sideOffset = 4, className, matchTriggerWidth = true, maxHeight = 240, ...props }: ContentProps) {
  const ctx = useDropdownCtx();
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ctx.isOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      const t = e.target as Node;
      const triggerEl = ctx.triggerRef.current;
      if (contentRef.current && !contentRef.current.contains(t) && triggerEl && !triggerEl.contains(t)) {
        ctx.setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [ctx.isOpen]);

  if (!ctx.isOpen) return null;

  // Basic positioning relative to trigger
  let style: React.CSSProperties = {};
  const triggerRect = ctx.triggerRef.current?.getBoundingClientRect();
  if (triggerRect) {
    const width = matchTriggerWidth ? triggerRect.width : undefined;
    const left = align === "end" ? triggerRect.right - (width ?? 0) : triggerRect.left;
    style = {
      position: "fixed",
      top: Math.min(window.innerHeight - 8, triggerRect.bottom + sideOffset),
      left: Math.max(8, left),
      width,
      zIndex: 50,
    };
  }

  return (
    <div
      ref={contentRef}
      role="listbox"
      id={ctx.listboxId}
      className={cn(
        "rounded-[var(--radius-sm)] border border-[var(--border-primary)] bg-[var(--surface-2)] shadow-lg",
        "overflow-auto",
        className,
      )}
      style={{ ...style, maxHeight }}
      {...props}
    >
      {children}
    </div>
  );
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
      data-disabled={disabled ? "true" : undefined}
      className={cn(
        "flex cursor-pointer items-center justify-between px-[var(--space-3)] py-[var(--space-2)] text-[12px]",
        "text-[var(--text-primary)] hover:bg-[var(--surface-interactive)]",
        isSelected ? "bg-[var(--surface-interactive)]" : undefined,
        disabled ? "opacity-60 cursor-not-allowed" : undefined,
        className,
      )}
      onClick={handleClick}
      {...props}
    >
      <div className="truncate">{children}</div>
      {isSelected && <div className="ml-2 text-[var(--accent-primary)]">✔</div>}
    </div>
  );
};


