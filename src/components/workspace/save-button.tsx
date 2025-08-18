"use client";

import { Button } from '@/components/ui/button';
import { HardDriveDownload } from 'lucide-react';

interface SaveButtonProps {
  onSave: () => void | Promise<void>;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  disabled?: boolean;
}

export function SaveButton({ onSave, isSaving, hasUnsavedChanges, disabled }: SaveButtonProps) {
  return (
    <Button onClick={() => void onSave()} disabled={disabled ?? false || isSaving || !hasUnsavedChanges} variant="primary" size="sm">
      <HardDriveDownload size={16} className="mr-2" />
      {isSaving ? 'Saving…' : 'Save'}
    </Button>
  );
}