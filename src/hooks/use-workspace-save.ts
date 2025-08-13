"use client";

import { useCallback, useRef, useState } from 'react';
import { api } from '@/trpc/react';
import type { WorkspaceState } from '@/types/workspace-state';
import { extractWorkspaceState, mergeEditorsIntoFlow } from '@/utils/workspace-state';
import { createStableFlowSnapshot } from '@/utils/workspace-snapshot';

interface SaveResult {
  version: number;
  updated_at: string;
}

interface UseWorkspaceSaveOptions {
  workspaceId: string;
  initialVersion: number;
  onSaveSuccess?: (result: SaveResult) => void;
  onSaveError?: (error: unknown) => void;
}

export function useWorkspaceSave({
  workspaceId,
  initialVersion,
  onSaveSuccess,
  onSaveError,
}: UseWorkspaceSaveOptions) {
  const [lastSavedState, setLastSavedState] = useState<WorkspaceState | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [currentVersion, setCurrentVersion] = useState<number>(initialVersion);

  const lastSavedFlowSnapshotRef = useRef<string>('');
  const lastQueuedFlowSnapshotRef = useRef<string>('');

  const saveMutation = api.workspace.save.useMutation({
    onSuccess: (result) => {
      setCurrentVersion(result.version);
      setLastSaved(new Date(result.updated_at));
      onSaveSuccess?.(result as SaveResult);
    },
    onError: (error) => {
      onSaveError?.(error);
    },
  });

  const isSaveInFlightRef = useRef(false);

  const hasUnsavedChanges = useCallback(
    (currentState: WorkspaceState) => {
      if (!lastSavedState) return false; // not initialized yet

      const currentFlowSnapshot = createStableFlowSnapshot(currentState.flow);
      const lastFlowSnapshot = lastSavedFlowSnapshotRef.current || createStableFlowSnapshot(lastSavedState.flow);

      if (currentFlowSnapshot !== lastFlowSnapshot) return true;

      // Also compare editor-specific persistable data (timeline)
      const currentEditorsSnapshot = JSON.stringify(stableEditorsSnapshot(currentState));
      const lastEditorsSnapshot = JSON.stringify(stableEditorsSnapshot(lastSavedState));
      return currentEditorsSnapshot !== lastEditorsSnapshot;
    },
    [lastSavedState]
  );

  const saveNow = useCallback(
    async (currentState: WorkspaceState) => {
      if (isSaveInFlightRef.current) {
        return; // drop overlapping manual save to avoid version conflicts
      }
      // Avoid duplicate enqueues, but allow explicit saves even if snapshot unchanged
      const currentFlowSnapshot = createStableFlowSnapshot(currentState.flow);
      if (currentFlowSnapshot === lastQueuedFlowSnapshotRef.current && !hasUnsavedChanges(currentState)) {
        return;
      }

      const flowDataWithEditors = mergeEditorsIntoFlow(currentState);

      const version = currentVersion;
      lastQueuedFlowSnapshotRef.current = currentFlowSnapshot;

      isSaveInFlightRef.current = true;
      try {
        const result = await saveMutation.mutateAsync({ id: workspaceId, flowData: flowDataWithEditors, version });
        // Update last-saved state on success
        setLastSavedState(currentState);
        lastSavedFlowSnapshotRef.current = currentFlowSnapshot;
        return result as SaveResult;
      } finally {
        isSaveInFlightRef.current = false;
      }
    },
    [workspaceId, currentVersion, hasUnsavedChanges, saveMutation]
  );

  const initializeFromWorkspace = useCallback((workspaceData: unknown) => {
    const initialState = extractWorkspaceState(workspaceData);
    setLastSavedState(initialState);
    setCurrentVersion((workspaceData as { version?: number }).version ?? initialVersion);
    lastSavedFlowSnapshotRef.current = createStableFlowSnapshot(initialState.flow);
  }, [initialVersion]);

  return {
    saveNow,
    isSaving: saveMutation.isPending,
    hasUnsavedChanges,
    lastSaved,
    initializeFromWorkspace,
    currentVersion,
  } as const;
}

function stableEditorsSnapshot(state: WorkspaceState): unknown {
  const entries = Object.entries(state.editors.timeline)
    .map(([nodeId, data]) => ({ nodeId, duration: data.duration, tracks: data.tracks }))
    .sort((a, b) => a.nodeId.localeCompare(b.nodeId));
  return entries;
}