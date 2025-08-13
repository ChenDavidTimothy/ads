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
        active ? "bg-gray-700 border-blue-500 text-white" : "bg-gray-800 border-transparent text-gray-300 hover:bg-gray-750"
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
          className="ml-1 p-1 rounded hover:bg-gray-600 text-gray-400 hover:text-white"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}