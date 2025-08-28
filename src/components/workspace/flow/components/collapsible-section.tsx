// src/components/workspace/flow/components/collapsible-section.tsx
"use client";

import { useState, useEffect, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface CollapsibleSectionProps {
  title: string;
  icon: ReactNode;
  defaultExpanded?: boolean;
  children: ReactNode;
  persistKey?: string;
  className?: string;
}

export function CollapsibleSection({
  title,
  icon,
  defaultExpanded = true,
  children,
  persistKey,
  className = "",
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Persist state to localStorage if persistKey provided
  useEffect(() => {
    if (!persistKey) return;

    const storageKey = `sidebar-section-${persistKey}`;
    const saved = localStorage.getItem(storageKey);
    if (saved !== null) {
      setIsExpanded(saved === "true");
    }
  }, [persistKey]);

  const handleToggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);

    if (persistKey) {
      localStorage.setItem(
        `sidebar-section-${persistKey}`,
        String(newExpanded),
      );
    }
  };

  return (
    <div className={`border-b border-[var(--border-primary)] ${className}`}>
      <button
        onClick={handleToggle}
        className="flex w-full items-center justify-between p-[var(--space-3)] text-left transition-colors cursor-pointer hover:bg-[var(--surface-interactive)]"
        type="button"
      >
        <div className="flex items-center gap-[var(--space-2)]">
          <div className="text-[var(--text-secondary)]">{icon}</div>
          <span className="font-medium text-[var(--text-primary)]">
            {title}
          </span>
        </div>
        <ChevronDown
          size={16}
          className={`text-[var(--text-tertiary)] transition-transform duration-200 ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>
      {isExpanded && (
        <div className="px-[var(--space-3)] pb-[var(--space-3)]">
          {children}
        </div>
      )}
    </div>
  );
}
