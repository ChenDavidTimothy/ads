"use client";

import { useEffect } from "react";
import type { WorkspaceState } from "@/types/workspace-state";

export function useNavigationGuard(
  hasUnsavedChanges: boolean,
  getState: () => WorkspaceState | null,
) {
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };

    const handlePageHide = () => {
      if (hasUnsavedChanges) {
        const state = getState();
        if (state) {
          try {
            localStorage.setItem(
              `workspace-emergency-backup-${state.meta.workspaceId}`,
              JSON.stringify({ state, timestamp: Date.now() }),
            );
          } catch {
            // ignore quota errors
          }
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [hasUnsavedChanges, getState]);
}
