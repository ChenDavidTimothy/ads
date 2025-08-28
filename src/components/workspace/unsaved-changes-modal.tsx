"use client";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { AlertTriangle } from "lucide-react";

interface UnsavedChangesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  onDiscard: () => void;
  isSaving?: boolean;
}

export function UnsavedChangesModal({
  isOpen,
  onClose,
  onSave,
  onDiscard,
  isSaving = false,
}: UnsavedChangesModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Unsaved Changes"
      size="sm"
      variant="glass"
    >
      <div className="p-[var(--space-6)]">
        <div className="flex items-start gap-4">
          <AlertTriangle className="mt-1 h-6 w-6 flex-shrink-0 text-[var(--warning-500)]" />
          <div className="flex-1">
            <p className="text-[var(--text-primary)] mb-4">
              You have unsaved changes in your workspace. What would you like to do?
            </p>

            <div className="flex flex-col gap-3">
              <p className="text-sm text-[var(--text-secondary)]">
                • <strong>Save changes:</strong> Save your work and then navigate away
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                • <strong>Discard changes:</strong> Lose your unsaved work and navigate away
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                • <strong>Cancel:</strong> Stay on this page to continue working
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={onDiscard}
            disabled={isSaving}
          >
            Discard Changes
          </Button>
          <Button
            variant="primary"
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
