"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
		<div className="max-w-4xl mx-auto p-6 text-[var(--text-secondary)]">
			<h1 className="text-2xl font-semibold mb-4 text-[var(--text-primary)]">Select a workspace</h1>

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
					<Input
						placeholder="Workspace name"
						value={name}
						onChange={(e) => setName(e.target.value)}
						className="w-72"
					/>
					<Button type="submit" disabled={createWorkspace.isPending}>Create</Button>
				</form>
			)}

			{isLoading && <div className="text-[var(--text-tertiary)]">Loading workspaces…</div>}
			{isError && <div className="text-[var(--danger-500)]">Failed to load workspaces.</div>}

			{!isLoading && sorted.length === 0 && (
				<div className="text-[var(--text-tertiary)]">You have no workspaces yet. Create one to get started.</div>
			)}

			<ul className="divide-y divide-[var(--border-primary)] rounded border border-[var(--border-primary)] overflow-hidden">
				{sorted.map((ws: Workspace) => (
					<li key={ws.id} className="flex items-center justify-between p-4 hover:bg-[var(--surface-interactive)]">
						<div>
							<div className="text-[var(--text-primary)] font-medium">{ws.name}</div>
							<div className="text-xs text-[var(--text-tertiary)]">Last updated {new Date(String(ws.updated_at)).toLocaleString()}</div>
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


