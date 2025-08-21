"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkspaceState } from "@/types/workspace-state";

const BACKUP_PREFIX = "workspace-emergency-backup-";

export function useCrashBackup(
  workspaceId: string,
  getState: () => WorkspaceState | null,
  options?: { intervalMs?: number; maxAgeMs?: number },
) {
  const [hasBackup, setHasBackup] = useState(false);
  const intervalMs = options?.intervalMs ?? 15000; // 15s periodic backup
  const maxAgeMs = options?.maxAgeMs ?? 24 * 60 * 60 * 1000; // 24 hours
  const timerRef = useRef<number | null>(null);

  // Detect existing backup on mount
  useEffect(() => {
    const key = BACKUP_PREFIX + workspaceId;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as {
          state: WorkspaceState;
          timestamp: number;
        };
        setHasBackup(Date.now() - parsed.timestamp < maxAgeMs);
      } catch {
        localStorage.removeItem(key);
        setHasBackup(false);
      }
    } else {
      setHasBackup(false);
    }
  }, [workspaceId, maxAgeMs]);

  // Periodic backup
  useEffect(() => {
    const key = BACKUP_PREFIX + workspaceId;
    const tick = () => {
      const state = getState();
      if (!state) return;
      try {
        localStorage.setItem(
          key,
          JSON.stringify({ state, timestamp: Date.now() }),
        );
        setHasBackup(true);
      } catch {
        // Best-effort; ignore quota errors
      }
    };

    timerRef.current = window.setInterval(tick, intervalMs);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [workspaceId, getState, intervalMs]);

  const recover = useCallback((): WorkspaceState | null => {
    const key = BACKUP_PREFIX + workspaceId;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as {
        state: WorkspaceState;
        timestamp: number;
      };
      // Keep the backup until user dismisses
      return parsed.state;
    } catch {
      localStorage.removeItem(key);
      setHasBackup(false);
      return null;
    }
  }, [workspaceId]);

  const dismiss = useCallback(() => {
    const key = BACKUP_PREFIX + workspaceId;
    localStorage.removeItem(key);
    setHasBackup(false);
  }, [workspaceId]);

  return { hasBackup, recover, dismiss } as const;
}
