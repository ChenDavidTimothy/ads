"use client";

import { cn } from "@/lib/utils";
import { Button } from "./button";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

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
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999]"
      onClick={handleBackdropClick}
    >
      <div 
        className={cn(
          variant === "glass" 
            ? "glass-panel flex flex-col outline-none shadow-glass-lg" 
            : "bg-[var(--surface-1)] border border-[var(--border-primary)] flex flex-col outline-none shadow-glass-lg",
          {
            "w-[28rem] max-h-[32rem]": size === "sm",
            "w-[40rem] max-h-[36rem]": size === "md", 
            "w-[56rem] max-h-[44rem]": size === "lg",
            "w-[72rem] max-h-[80vh]": size === "xl",
          },
          "max-w-[95vw] max-h-[90vh] rounded-[var(--radius-md)]",
          className
        )}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
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

  return createPortal(modalContent, document.body);
}