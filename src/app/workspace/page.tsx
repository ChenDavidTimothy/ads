import { redirect } from "next/navigation";
import { WorkspaceLayout } from "@/components/workspace/workspace-layout";

export default async function WorkspaceEditorPage({
  searchParams,
}: {
  searchParams?: Promise<{ workspace?: string; tab?: string; node?: string }>;
}) {
  const { workspace: workspaceId } = (await searchParams) ?? {};
  if (!workspaceId) {
    redirect("/workspace-selector");
  }
  return <WorkspaceLayout workspaceId={workspaceId} />;
}


