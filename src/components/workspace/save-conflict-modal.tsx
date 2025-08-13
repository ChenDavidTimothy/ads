"use client";

import { Button } from '@/components/ui/button';

interface SaveConflictModalProps {
  isOpen: boolean;
  onReload: () => void;
  onDismiss: () => void;
}

export function SaveConflictModal({ isOpen, onReload, onDismiss }: SaveConflictModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-850 border border-gray-700 rounded-lg p-6 w-[420px] shadow-xl">
        <h2 className="text-lg font-semibold text-white mb-2">Save conflict detected</h2>
        <p className="text-sm text-gray-300 mb-4">
          The workspace has changed on the server since you loaded it. Reload to get the latest version.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onDismiss}>Keep editing</Button>
          <Button variant="primary" size="sm" onClick={onReload}>Reload now</Button>
        </div>
      </div>
    </div>
  );
}