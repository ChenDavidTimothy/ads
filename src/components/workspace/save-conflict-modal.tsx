"use client";

import { Button } from "@/components/ui/button";

interface SaveConflictModalProps {
  isOpen: boolean;
  onReload: () => void;
  onDismiss: () => void;
}

export function SaveConflictModal({
  isOpen,
  onReload,
  onDismiss,
}: SaveConflictModalProps) {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
      style={{ backgroundColor: "var(--modal-backdrop)" }}
    >
      <div className="shadow-glass-lg w-[420px] rounded-[var(--radius-md)] border border-[var(--border-primary)] bg-[var(--surface-1)] p-[var(--space-6)]">
        <h2 className="text-refined-medium mb-[var(--space-2)] text-[14px] font-medium text-[var(--text-primary)]">
          Save conflict detected
        </h2>
        <p className="mb-[var(--space-4)] text-[13px] text-[var(--text-secondary)]">
          The workspace has changed on the server since you loaded it. Reload to
          get the latest version.
        </p>
        <div className="flex justify-end gap-[var(--space-2)]">
          <Button variant="secondary" size="sm" onClick={onDismiss}>
            Keep editing
          </Button>
          <Button variant="primary" size="sm" onClick={onReload}>
            Reload now
          </Button>
        </div>
      </div>
    </div>
  );
}
