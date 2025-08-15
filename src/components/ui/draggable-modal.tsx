"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { X, Move } from "lucide-react";

interface DraggableModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: string;
  height?: string;
  minHeight?: string;
  maxHeight?: string;
  className?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  headerIcon?: React.ReactNode;
  headerActions?: React.ReactNode;
}

export function DraggableModal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  width = "w-[32rem]",
  height,
  minHeight = "min-h-[16rem]",
  maxHeight = "max-h-[80vh]",
  className,
  collapsible = false,
  defaultCollapsed = false,
  headerIcon,
  headerActions
}: DraggableModalProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isInitialized, setIsInitialized] = useState(false);
  
  const modalRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  // Initialize position when modal opens
  useEffect(() => {
    if (isOpen && modalRef.current && !isInitialized) {
      // Wait for next frame to ensure modal is rendered
      requestAnimationFrame(() => {
        if (modalRef.current) {
          const rect = modalRef.current.getBoundingClientRect();
          setPosition({
            x: Math.max(0, (window.innerWidth - rect.width) / 2),
            y: Math.max(0, (window.innerHeight - rect.height) / 2)
          });
          setIsInitialized(true);
        }
      });
    } else if (!isOpen) {
      setIsInitialized(false);
    }
  }, [isOpen, isInitialized]);

  // Handle drag start
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!modalRef.current || !headerRef.current) return;
    
    const rect = modalRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    setIsDragging(true);
    e.preventDefault(); // Prevent text selection
  }, []);

  // Handle drag movement and end
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !modalRef.current) return;
      
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      // Keep modal within viewport bounds with padding
      const padding = 20;
      const maxX = window.innerWidth - modalRef.current.offsetWidth - padding;
      const maxY = window.innerHeight - modalRef.current.offsetHeight - padding;
      
      setPosition({
        x: Math.max(padding, Math.min(newX, maxX)),
        y: Math.max(padding, Math.min(newY, maxY))
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      // Prevent text selection during drag
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };
  }, [isDragging, dragOffset]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div 
        ref={modalRef}
        className={cn(
          "glass-panel flex flex-col outline-none shadow-glass-lg",
          "rounded-[var(--radius-md)] border border-[var(--glass-border)]",
          "max-w-[95vw] transition-all duration-[var(--duration-fast)]",
          width,
          height || (isCollapsed ? "h-auto" : minHeight),
          !isCollapsed && maxHeight,
          isDragging && "cursor-move select-none transition-none",
          className
        )}
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
        tabIndex={-1}
      >
        {/* Draggable Header */}
        <div 
          ref={headerRef}
          className={cn(
            "flex items-center justify-between p-[var(--space-4)] border-b border-[var(--border-primary)]",
            "cursor-move bg-[var(--surface-1)] rounded-t-[var(--radius-md)]",
            "hover:bg-[var(--surface-interactive)] transition-colors duration-[var(--duration-fast)]"
          )}
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-[var(--space-3)]">
            {headerIcon && (
              <div className="w-6 h-6 flex items-center justify-center">
                {headerIcon}
              </div>
            )}
            {title && (
              <div>
                <h3 className="text-[13px] font-medium text-[var(--text-primary)] text-refined-medium">
                  {title}
                </h3>
              </div>
            )}
            <div className="w-4 h-4 flex items-center justify-center opacity-40">
              <Move size={12} />
            </div>
          </div>
          
          <div className="flex items-center gap-[var(--space-1)]">
            {headerActions}
            {collapsible && (
              <Button
                onClick={() => setIsCollapsed(!isCollapsed)}
                variant="minimal"
                size="xs"
                className="p-[var(--space-1)]"
                aria-label={isCollapsed ? "Expand" : "Collapse"}
              >
                {isCollapsed ? "⬇" : "⬆"}
              </Button>
            )}
            <Button
              onClick={onClose}
              variant="minimal"
              size="xs"
              className="p-[var(--space-1)]"
              aria-label="Close modal"
            >
              <X size={12} />
            </Button>
          </div>
        </div>

        {/* Content Area */}
        {!isCollapsed && (
          <div className="flex-1 overflow-hidden">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
