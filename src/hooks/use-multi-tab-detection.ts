"use client";

import { useEffect, useState } from "react";

interface TabEntry {
  id: string;
  lastSeen: number;
}
const HEARTBEAT_MS = 30000;
const STALE_MS = 2 * 60 * 1000;

function readTabs(key: string): TabEntry[] {
  try {
    const item = localStorage.getItem(key);
    if (!item) return [];
    const parsed = JSON.parse(item) as unknown;
    return Array.isArray(parsed) ? (parsed as TabEntry[]) : [];
  } catch {
    return [];
  }
}
function writeTabs(key: string, tabs: TabEntry[]) {
  localStorage.setItem(key, JSON.stringify(tabs));
}

export function useMultiTabDetection(workspaceId: string) {
  const [hasMultipleTabs, setHasMultipleTabs] = useState(false);
  const [tabCount, setTabCount] = useState(1);

  useEffect(() => {
    const storageKey = `workspace-tabs-${workspaceId}`;
    const tabId = crypto.randomUUID();

    const upsert = () => {
      const now = Date.now();
      const filtered = readTabs(storageKey).filter(
        (t) => now - t.lastSeen < STALE_MS,
      );
      const updated = [
        ...filtered.filter((t) => t.id !== tabId),
        { id: tabId, lastSeen: now },
      ];
      writeTabs(storageKey, updated);
      setHasMultipleTabs(updated.length > 1);
      setTabCount(updated.length);
    };

    upsert();
    const hb = window.setInterval(upsert, HEARTBEAT_MS);
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey) upsert();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.clearInterval(hb);
      const now = Date.now();
      const filtered = readTabs(storageKey).filter(
        (t) => t.id !== tabId && now - t.lastSeen < STALE_MS,
      );
      writeTabs(storageKey, filtered);
    };
  }, [workspaceId]);

  return { hasMultipleTabs, tabCount } as const;
}
