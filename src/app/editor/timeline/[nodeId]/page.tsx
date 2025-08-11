import { redirect } from "next/navigation";
import { TimelinePageClient } from "@/components/editor/timeline-page-client";

export default function Page({ params, searchParams }: { params: { nodeId: string }; searchParams: { workspace?: string } }) {
  const workspaceId = searchParams.workspace;
  if (!workspaceId) {
    redirect("/editor");
  }
  return <TimelinePageClient workspaceId={workspaceId} nodeId={params.nodeId} />;
}


