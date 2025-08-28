"use client";

import { useEffect, useCallback } from "react";
import type { WorkspaceState } from "@/types/workspace-state";

interface NavigationGuardOptions {
  onNavigationAttempt?: (url: string) => void;
  onSave?: () => Promise<void>;
  onDiscard?: () => void;
}

// Type for the guarded router available on window when there are unsaved changes
interface GuardedRouter {
  push: (url: string) => void;
  replace: (url: string) => void;
  back: () => void;
  forward: () => void;
}

declare global {
  interface Window {
    __guardedRouter?: GuardedRouter;
  }
}

export function useNavigationGuard(
  hasUnsavedChanges: boolean,
  getState: () => WorkspaceState | null,
  options?: NavigationGuardOptions,
) {
  const {
    onNavigationAttempt,
    onSave: _onSave,
    onDiscard: _onDiscard,
  } = options ?? {}; // eslint-disable-line @typescript-eslint/no-unused-vars

  const handleEmergencyBackup = useCallback(() => {
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
  }, [hasUnsavedChanges, getState]);

  // Handle browser unload events (refresh/close)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        handleEmergencyBackup();
        // Use browser's native warning - it's the most reliable approach
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };

    const handlePageHide = () => {
      handleEmergencyBackup();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [hasUnsavedChanges, handleEmergencyBackup]);

  // Handle programmatic navigation (link clicks)
  useEffect(() => {
    const handleLinkClick = (e: MouseEvent) => {
      if (!hasUnsavedChanges) return;

      const target = e.target as HTMLElement;
      const link = target.closest("a[href]")!;

      if (!link) return;

      const href = link.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript:"))
        return;

      // Prevent default navigation
      e.preventDefault();

      // Notify parent component about navigation attempt
      onNavigationAttempt?.(href);
    };

    // Intercept all link clicks within the workspace
    document.addEventListener("click", handleLinkClick, true);

    return () => {
      document.removeEventListener("click", handleLinkClick, true);
    };
  }, [hasUnsavedChanges, onNavigationAttempt]);

  // Intercept programmatic navigation (router.push, etc.)
  useEffect(() => {
    if (!hasUnsavedChanges || !onNavigationAttempt) return;

    // Create a custom router that intercepts navigation
    const createGuardedRouter = () => {
      const originalPush = window.history.pushState.bind(window.history);
      const originalReplace = window.history.replaceState.bind(window.history);

      return {
        push: (url: string) => {
          if (url && !url.startsWith("#")) {
            onNavigationAttempt(url);
            return; // Don't navigate, let modal handle it
          }
          originalPush.call(window.history, null, "", url);
        },
        replace: (url: string) => {
          if (url && !url.startsWith("#")) {
            onNavigationAttempt(url);
            return; // Don't navigate, let modal handle it
          }
          originalReplace.call(window.history, null, "", url);
        },
        back: () => {
          window.history.back();
        },
        forward: () => {
          window.history.forward();
        },
      };
    };

    // Make the guarded router available globally for components that need it
    window.__guardedRouter = createGuardedRouter();

    return () => {
      delete window.__guardedRouter;
    };
  }, [hasUnsavedChanges, onNavigationAttempt]);

  // No need to return anything - all functionality is handled via callbacks
}
