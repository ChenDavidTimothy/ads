"use client";

import { cn } from "@/lib/utils";
import { Button } from "./button";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  variant?: "glass" | "solid";
}

export function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = "lg",
  className,
  variant = "glass"
}: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div 
        className={cn(
          variant === "glass" 
            ? "glass-panel flex flex-col outline-none shadow-glass-lg" 
            : "bg-[var(--surface-1)] border border-[var(--border-primary)] flex flex-col outline-none shadow-glass-lg",
          {
            "w-[28rem] max-h-[32rem]": size === "sm",
            "w-[40rem] max-h-[36rem]": size === "md", 
            "w-[56rem] max-h-[44rem]": size === "lg",
            "w-[72rem] max-h-[52rem]": size === "xl",
          },
          "max-w-[95vw] max-h-[90vh] rounded-[var(--radius-md)]",
          className
        )}
        tabIndex={-1}
      >
        {title && (
          <div className="flex items-center justify-between p-[var(--space-4)] border-b border-[var(--border-primary)]">
            <h2 className="text-[14px] font-medium text-[var(--text-primary)] text-refined-medium">{title}</h2>
            <Button variant="minimal" size="xs" onClick={onClose} aria-label="Close modal">
              ✕
            </Button>
          </div>
        )}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}