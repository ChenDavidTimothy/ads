"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import type { RouterOutputs } from "@/trpc/react";

type Workspace = RouterOutputs["workspace"]["list"][number];

export function WorkspaceSelector() {
  const router = useRouter();
  const utils = api.useUtils();
  const { data: workspaces, isLoading, isError, refetch } = api.workspace.list.useQuery();
  const createWorkspace = api.workspace.create.useMutation({
    onSuccess: async (ws) => {
      await utils.workspace.list.invalidate();
      router.push(`/workspace?workspace=${ws.id}`);
    },
  });

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  const sorted = useMemo(() => {
    return (workspaces ?? []).slice().sort((a: Workspace, b: Workspace) => {
      const dateA = new Date(String(a.updated_at));
      const dateB = new Date(String(b.updated_at));
      return dateB.getTime() - dateA.getTime();
    });
  }, [workspaces]);

  return (
    <div className="max-w-4xl mx-auto p-6 text-gray-200">
      <h1 className="text-2xl font-semibold mb-4">Select a workspace</h1>

      <div className="mb-6 flex items-center gap-2">
        <Button onClick={() => setCreating((v) => !v)} size="sm">{creating ? "Cancel" : "Create new workspace"}</Button>
        <Button onClick={() => refetch()} variant="secondary" size="sm">Refresh</Button>
      </div>

      {creating && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createWorkspace.mutate({ name: name.trim() || "Untitled" });
          }}
          className="mb-8 flex gap-2"
        >
          <input
            className="px-3 py-2 rounded bg-gray-800 border border-gray-700 text-gray-100 w-72"
            placeholder="Workspace name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="submit" disabled={createWorkspace.isPending}>Create</Button>
        </form>
      )}

      {isLoading && <div className="text-gray-400">Loading workspaces…</div>}
      {isError && <div className="text-red-400">Failed to load workspaces.</div>}

      {!isLoading && sorted.length === 0 && (
        <div className="text-gray-400">You have no workspaces yet. Create one to get started.</div>
      )}

      <ul className="divide-y divide-gray-800 rounded border border-gray-800 overflow-hidden">
        {sorted.map((ws: Workspace) => (
          <li key={ws.id} className="flex items-center justify-between p-4 hover:bg-gray-850">
            <div>
              <div className="text-white font-medium">{ws.name}</div>
              <div className="text-xs text-gray-400">Last updated {new Date(String(ws.updated_at)).toLocaleString()}</div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => router.push(`/workspace?workspace=${ws.id}`)}>Open</Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}


