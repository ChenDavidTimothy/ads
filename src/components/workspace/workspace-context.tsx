"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '@/trpc/react';
import type { WorkspaceState, TimelineEditorData } from '@/types/workspace-state';
import { extractWorkspaceState } from '@/utils/workspace-state';
import { useWorkspaceSave } from '@/hooks/use-workspace-save';
import { useNotifications } from '@/hooks/use-notifications';

interface WorkspaceContextValue {
  state: WorkspaceState;
  updateFlow: (updates: Partial<WorkspaceState['flow']>) => void;
  updateTimeline: (nodeId: string, data: Partial<TimelineEditorData>) => void;
  updateUI: (updates: Partial<WorkspaceState['ui']>) => void;
  saveNow: () => Promise<void>;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  lastSaved: Date | null;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children, workspaceId }: { children: ReactNode; workspaceId: string }) {
  const { toast } = useNotifications();
  const { data: workspace, isLoading } = api.workspace.get.useQuery({ id: workspaceId }, { refetchOnWindowFocus: false });

  const [state, setState] = useState<WorkspaceState | null>(null);

  const { saveNow: saveToBackend, isSaving, hasUnsavedChanges, lastSaved, initializeFromWorkspace, currentVersion } = useWorkspaceSave({
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
    setState((prev) =>
      prev
        ? {
            ...prev,
            editors: {
              ...prev.editors,
              timeline: {
                ...prev.editors.timeline,
                [nodeId]: { ...(prev.editors.timeline[nodeId] ?? { duration: 3, tracks: [] }), ...(data as TimelineEditorData) },
              },
            },
          }
        : prev
    );
  }, []);

  const updateUI = useCallback((updates: Partial<WorkspaceState['ui']>) => {
    setState((prev) => (prev ? { ...prev, ui: { ...prev.ui, ...updates } } : prev));
  }, []);

  const saveNow = useCallback(async () => {
    if (!state) return;
    await saveToBackend(state);
  }, [state, saveToBackend]);

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
    };
  }, [state, updateFlow, updateTimeline, updateUI, saveNow, isSaving, hasUnsavedChanges, lastSaved]);

  if (isLoading || !contextValue) {
    return <div className="h-screen w-full bg-gray-900 text-gray-300 p-6">Loading workspace…</div>;
  }

  return <WorkspaceContext.Provider value={contextValue}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}