"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = "lg",
  className 
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => modalRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div 
        ref={modalRef}
        className={cn(
          "bg-gray-800 rounded-lg border border-gray-600 flex flex-col outline-none",
          {
            "w-[32rem] max-h-[40rem]": size === "sm",
            "w-[48rem] max-h-[32rem]": size === "md", 
            "w-[64rem] max-h-[40rem]": size === "lg",
            "w-[80rem] max-h-[48rem]": size === "xl",
          },
          "max-w-[95vw] max-h-[90vh]",
          className
        )}
        tabIndex={-1}
      >
        {title && (
          <div className="flex items-center justify-between p-4 border-b border-gray-600">
            <h2 className="text-xl font-bold text-white">{title}</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
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