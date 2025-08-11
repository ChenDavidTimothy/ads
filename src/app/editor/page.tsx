import { redirect } from "next/navigation";
import { FlowEditor } from "@/components/editor/flow-editor";

export default function EditorPage({ searchParams }: { searchParams?: { workspace?: string } }) {
  const workspaceId = searchParams?.workspace;
  if (!workspaceId) {
    redirect("/workspace-selector");
  }
  return (
    <div className="h-screen w-full bg-gray-900">
      <FlowEditor />
    </div>
  );
}