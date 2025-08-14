"use client";

import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  onClose?: () => void;
}

export function TabButton({ active, onClick, icon, label, onClose }: TabButtonProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-t-lg cursor-pointer transition-colors",
        "border-b-2 min-w-0 max-w-[260px]",
        active ? "bg-[var(--surface-2)] border-[var(--accent-500)] text-[var(--text-primary)]" : "bg-[var(--surface-1)] border-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-interactive)]"
      )}
      onClick={onClick}
    >
      {icon}
      <span className="truncate text-sm font-medium">{label}</span>
      {onClose && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="ml-1 p-1 rounded hover:bg-[var(--surface-2)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}