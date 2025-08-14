"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '@/trpc/react';
import type { WorkspaceState, TimelineEditorData } from '@/types/workspace-state';
import { extractWorkspaceState } from '@/utils/workspace-state';
import { useWorkspaceSave } from '@/hooks/use-workspace-save';
import { useNotifications } from '@/hooks/use-notifications';
import { useCrashBackup } from '@/hooks/use-crash-backup';
import { useNavigationGuard } from '@/hooks/use-navigation-guard';

interface WorkspaceContextValue {
  state: WorkspaceState;
  updateFlow: (updates: Partial<WorkspaceState['flow']>) => void;
  updateTimeline: (nodeId: string, data: Partial<TimelineEditorData>) => void;
  updateUI: (updates: Partial<WorkspaceState['ui']>) => void;
  saveNow: () => Promise<void>;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  lastSaved: Date | null;
  hasBackup: boolean;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children, workspaceId }: { children: ReactNode; workspaceId: string }) {
  const { toast } = useNotifications();
  const { data: workspace, isLoading } = api.workspace.get.useQuery({ id: workspaceId }, { refetchOnWindowFocus: false });

  const [state, setState] = useState<WorkspaceState | null>(null);

  const { saveNow: saveToBackend, isSaving, hasUnsavedChanges, lastSaved, initializeFromWorkspace } = useWorkspaceSave({
    workspaceId,
    initialVersion: workspace?.version ?? 0,
    onSaveSuccess: () => toast.success('Workspace saved'),
    onSaveError: (error) => toast.error('Save failed', (error as Error)?.message ?? 'Unknown error'),
  });

  useEffect(() => {
    if (workspace && !state) {
      const initial = extractWorkspaceState(workspace);
      setState(initial);
      initializeFromWorkspace(workspace);
    }
  }, [workspace, state, initializeFromWorkspace]);

  const updateFlow = useCallback((updates: Partial<WorkspaceState['flow']>) => {
    setState((prev) => (prev ? { ...prev, flow: { ...prev.flow, ...updates } } : prev));
  }, []);

  const updateTimeline = useCallback((nodeId: string, data: Partial<TimelineEditorData>) => {
    setState((prev) => {
      if (!prev) return prev;

      const existing = prev.editors.timeline[nodeId] ?? { duration: 3, tracks: [] };
      const merged: TimelineEditorData = {
        duration: data.duration ?? existing.duration,
        tracks: data.tracks ?? existing.tracks,
      };

      // Mirror changes into the corresponding animation node in flow
      const updatedNodes = prev.flow.nodes.map((node) => {
        const isTarget = (node as unknown as { data?: { identifier?: { id?: string } } }).data?.identifier?.id === nodeId;
        if (!isTarget) return node;
        return {
          ...node,
          data: {
            ...(node as unknown as { data: Record<string, unknown> }).data,
            duration: merged.duration,
            tracks: merged.tracks,
          } as unknown,
        } as typeof node;
      });

      return {
        ...prev,
        flow: { ...prev.flow, nodes: updatedNodes },
        editors: {
          ...prev.editors,
          timeline: {
            ...prev.editors.timeline,
            [nodeId]: merged,
          },
        },
      } as WorkspaceState;
    });
  }, []);

  const updateUI = useCallback((updates: Partial<WorkspaceState['ui']>) => {
    setState((prev) => (prev ? { ...prev, ui: { ...prev.ui, ...updates } } : prev));
  }, []);

  const saveNow = useCallback(async () => {
    if (!state) return;
    await saveToBackend(state);
  }, [state, saveToBackend]);

  const getState = useCallback(() => state, [state]);
  const backup = useCrashBackup(workspaceId, getState, { intervalMs: 15000 });
  useNavigationGuard(Boolean(state && hasUnsavedChanges(state)), getState);

  const contextValue = useMemo<WorkspaceContextValue | null>(() => {
    if (!state) return null;
    return {
      state,
      updateFlow,
      updateTimeline,
      updateUI,
      saveNow,
      isSaving,
      hasUnsavedChanges: hasUnsavedChanges(state),
      lastSaved,
      hasBackup: backup.hasBackup,
    };
  }, [state, updateFlow, updateTimeline, updateUI, saveNow, isSaving, hasUnsavedChanges, lastSaved, backup.hasBackup]);

  if (isLoading || !contextValue) {
    return <div className="h-screen w-full bg-[var(--surface-0)] text-[var(--text-secondary)] p-6">Loading workspace…</div>;
  }

  return <WorkspaceContext.Provider value={contextValue}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}