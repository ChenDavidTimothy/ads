"use client";

import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  onClose?: () => void;
}

export function TabButton({ active, onClick, icon, label, onClose }: TabButtonProps) {
  return (
    <Button
      variant={active ? "primary" : "ghost"}
      size="sm"
      className={cn(
        "border-b-2 rounded-none",
        active ? "border-[var(--accent-primary)]" : "border-transparent"
      )}
      onClick={onClick}
    >
      {icon} {label}
      {onClose && (
        <Button variant="ghost" size="xs" onClick={onClose} className="ml-2">
          <X size={12} />
        </Button>
      )}
    </Button>
  );
}