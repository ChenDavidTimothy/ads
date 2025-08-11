import { redirect } from "next/navigation";
import { FlowEditor } from "@/components/workspace/flow-editor";

export default async function WorkspaceEditorPage({
  searchParams,
}: {
  searchParams?: Promise<{ workspace?: string }>;
}) {
  const { workspace: workspaceId } = (await searchParams) ?? {};
  if (!workspaceId) {
    redirect("/workspace-selector");
  }
  return (
    <div className="h-screen w-full bg-gray-900">
      <FlowEditor />
    </div>
  );
}


