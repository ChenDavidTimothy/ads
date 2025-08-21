"use client";

import { cn } from "@/lib/utils";
import { Button } from "./button";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
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
  variant = "glass",
}: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscapeKey);
    return () => document.removeEventListener("keydown", handleEscapeKey);
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
      style={{ backgroundColor: "var(--modal-backdrop-blur)" }}
      onClick={handleBackdropClick}
    >
      <div
        className={cn(
          variant === "glass"
            ? "glass-panel shadow-glass-lg flex flex-col outline-none"
            : "shadow-glass-lg flex flex-col border border-[var(--border-primary)] bg-[var(--surface-1)] outline-none",
          {
            "max-h-[32rem] w-[28rem]": size === "sm",
            "max-h-[36rem] w-[40rem]": size === "md",
            "max-h-[44rem] w-[56rem]": size === "lg",
            "max-h-[80vh] w-[72rem]": size === "xl",
          },
          "max-h-[90vh] max-w-[95vw] rounded-[var(--radius-md)]",
          className,
        )}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-[var(--border-primary)] p-[var(--space-4)]">
            <h2 className="text-refined-medium text-[14px] font-medium text-[var(--text-primary)]">
              {title}
            </h2>
            <Button
              variant="minimal"
              size="xs"
              onClick={onClose}
              aria-label="Close modal"
            >
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
