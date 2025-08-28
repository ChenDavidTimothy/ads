"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import type {
  WorkspaceState,
  TimelineEditorData,
} from "@/types/workspace-state";
import { extractWorkspaceState } from "@/utils/workspace-state";
import { useWorkspaceSave } from "@/hooks/use-workspace-save";
import { useNotifications } from "@/hooks/use-notifications";
import { useCrashBackup } from "@/hooks/use-crash-backup";
import { useNavigationGuard } from "@/hooks/use-navigation-guard";
import { UnsavedChangesModal } from "./unsaved-changes-modal";

interface WorkspaceContextValue {
  state: WorkspaceState;
  updateFlow: (updates: Partial<WorkspaceState["flow"]>) => void;
  updateTimeline: (nodeId: string, data: Partial<TimelineEditorData>) => void;
  updateUI: (updates: Partial<WorkspaceState["ui"]>) => void;
  saveNow: () => Promise<void>;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  lastSaved: Date | null;
  hasBackup: boolean;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(
  null,
);

export function WorkspaceProvider({
  children,
  workspaceId,
}: {
  children: ReactNode;
  workspaceId: string;
}) {
  const { toast } = useNotifications();
  const router = useRouter();
  const utils = api.useUtils();
  const { data: workspace, isLoading } = api.workspace.get.useQuery(
    { id: workspaceId },
    {
      enabled: Boolean(workspaceId),
      // Always refetch on mount/navigation and never trust stale cache
      refetchOnMount: "always",
      refetchOnReconnect: "always",
      refetchOnWindowFocus: true,
      staleTime: 0,
      // Remove from cache immediately when unused to avoid back/forward stale views
      gcTime: 0,
    },
  );

  const [state, setState] = useState<WorkspaceState | null>(null);

  // Unsaved changes modal state
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingNavigationUrl, setPendingNavigationUrl] = useState<
    string | null
  >(null);

  const {
    saveNow: saveToBackend,
    isSaving,
    hasUnsavedChanges,
    lastSaved,
    initializeFromWorkspace,
  } = useWorkspaceSave({
    workspaceId,
    initialVersion: workspace?.version ?? 0,
    onSaveSuccess: () => toast.success("Workspace saved"),
    onSaveError: (error) =>
      toast.error("Save failed", (error as Error)?.message ?? "Unknown error"),
  });

  // Track last loaded workspace signature to refresh state when backend changes
  const lastLoadedSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (!workspace) return;
    const signature = `${workspace.id}:${workspace.version}:${workspace.updated_at}`;
    if (lastLoadedSignatureRef.current !== signature) {
      const initial = extractWorkspaceState(workspace);
      setState(initial);
      initializeFromWorkspace(workspace);
      lastLoadedSignatureRef.current = signature;
    }
  }, [workspace, initializeFromWorkspace]);

  // On unmount, drop local state and remove query cache for this workspace
  useEffect(() => {
    return () => {
      setState(null);
      lastLoadedSignatureRef.current = null;
      // Explicitly drop cached data for this workspace to avoid stale back/forward cache
      utils.workspace.get.reset({ id: workspaceId });
    };
  }, [workspaceId, utils]);

  const updateFlow = useCallback((updates: Partial<WorkspaceState["flow"]>) => {
    setState((prev) => {
      if (!prev) return prev;

      // SURGICAL FIX: Fast path for node position updates (avoid expensive JSON.stringify)
      if ("nodes" in updates && updates.nodes) {
        const newNodes = updates.nodes;
        const currentNodes = prev.flow.nodes;

        // Ultra-fast position-only change detection
        if (newNodes.length === currentNodes.length) {
          let onlyPositionChanges = true;
          let hasPositionChanges = false;

          for (let i = 0; i < newNodes.length && onlyPositionChanges; i++) {
            const newNode = newNodes[i];
            const currentNode = currentNodes[i];

            // Null safety checks
            if (!newNode || !currentNode) {
              onlyPositionChanges = false;
              break;
            }

            // Quick identity check
            if (newNode.id !== currentNode.id) {
              onlyPositionChanges = false;
              break;
            }

            // Position change detection
            const posChanged =
              newNode.position.x !== currentNode.position.x ||
              newNode.position.y !== currentNode.position.y;

            if (posChanged) hasPositionChanges = true;

            // Quick non-position change detection (avoid deep comparison)
            if (
              newNode.type !== currentNode.type ||
              newNode.data !== currentNode.data
            ) {
              onlyPositionChanges = false;
            }
          }

          // CRITICAL: Fast path for position-only updates
          if (onlyPositionChanges && hasPositionChanges) {
            return { ...prev, flow: { ...prev.flow, nodes: newNodes } };
          }
        }

        // Fast path: Always update if nodes array changed (structural changes)
        return { ...prev, flow: { ...prev.flow, ...updates } };
      }

      // Existing logic for non-node updates (edges, etc.)
      const hasChanges = Object.keys(updates).some((key) => {
        const updateValue = updates[key as keyof typeof updates];
        const currentValue = prev.flow[key as keyof typeof prev.flow];
        return JSON.stringify(updateValue) !== JSON.stringify(currentValue);
      });

      if (!hasChanges) return prev;

      return { ...prev, flow: { ...prev.flow, ...updates } };
    });
  }, []);

  const updateTimeline = useCallback(
    (nodeId: string, data: Partial<TimelineEditorData>) => {
      setState((prev) => {
        if (!prev) return prev;

        const existing = prev.editors.timeline[nodeId] ?? {
          duration: 3,
          tracks: [],
        };
        const merged: TimelineEditorData = {
          duration: data.duration ?? existing.duration,
          tracks: data.tracks ?? existing.tracks,
        };

        // Mirror changes into the corresponding animation node in flow
        const updatedNodes = prev.flow.nodes.map((node) => {
          const isTarget =
            (node as unknown as { data?: { identifier?: { id?: string } } })
              .data?.identifier?.id === nodeId;
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
    },
    [],
  );

  const updateUI = useCallback((updates: Partial<WorkspaceState["ui"]>) => {
    setState((prev) =>
      prev ? { ...prev, ui: { ...prev.ui, ...updates } } : prev,
    );
  }, []);

  const saveNow = useCallback(async () => {
    if (!state) return;
    await saveToBackend(state);
  }, [state, saveToBackend]);

  // Modal handlers
  const handleNavigationAttempt = useCallback((url: string) => {
    setPendingNavigationUrl(url);
    setShowUnsavedModal(true);
  }, []);

  const handleModalSave = useCallback(async () => {
    if (!state) return;

    try {
      await saveToBackend(state);
      if (pendingNavigationUrl) {
        // Use window.location for external URLs, router for internal
        if (
          pendingNavigationUrl.startsWith("http") ||
          pendingNavigationUrl.startsWith("//")
        ) {
          window.location.href = pendingNavigationUrl;
        } else {
          router.push(pendingNavigationUrl);
        }
      }
      setShowUnsavedModal(false);
      setPendingNavigationUrl(null);
    } catch (error) {
      console.error('[WorkspaceContext] Failed to save during navigation:', error);
      // Show user-friendly error message
      toast.error("Failed to save workspace", (error as Error)?.message ?? "Please try again");
      // Don't close modal on error - let user try again or choose different action
    }
  }, [state, saveToBackend, pendingNavigationUrl, router, toast]);

  const handleModalDiscard = useCallback(() => {
    if (pendingNavigationUrl) {
      // Use window.location for external URLs, router for internal
      if (
        pendingNavigationUrl.startsWith("http") ||
        pendingNavigationUrl.startsWith("//")
      ) {
        window.location.href = pendingNavigationUrl;
      } else {
        router.push(pendingNavigationUrl);
      }
    }
    setShowUnsavedModal(false);
    setPendingNavigationUrl(null);
  }, [pendingNavigationUrl, router]);

  const handleModalClose = useCallback(() => {
    // User cancelled navigation - just close the modal
    setShowUnsavedModal(false);
    setPendingNavigationUrl(null);
  }, []);

  const getState = useCallback(() => state, [state]);
  const backup = useCrashBackup(workspaceId, getState, { intervalMs: 15000 });

  // Set up navigation guard - no need to capture return values as we handle everything via callbacks
  useNavigationGuard(Boolean(state && hasUnsavedChanges(state)), getState, {
    onNavigationAttempt: handleNavigationAttempt,
  });

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
  }, [
    state,
    updateFlow,
    updateTimeline,
    updateUI,
    saveNow,
    isSaving,
    hasUnsavedChanges,
    lastSaved,
    backup.hasBackup,
  ]);

  if (isLoading || !contextValue) {
    return (
      <div className="h-screen w-full bg-[var(--surface-0)] p-6 text-[var(--text-secondary)]">
        Loading workspace…
      </div>
    );
  }

  return (
    <WorkspaceContext.Provider value={contextValue}>
      {children}
      <UnsavedChangesModal
        isOpen={showUnsavedModal}
        onClose={handleModalClose}
        onSave={handleModalSave}
        onDiscard={handleModalDiscard}
        isSaving={isSaving}
      />
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx)
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
