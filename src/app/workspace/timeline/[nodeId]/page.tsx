import { redirect } from "next/navigation";
import { TimelinePageClient } from "@/components/editor/timeline-page-client";

export default async function Page({
  params,
  searchParams,
}: {
  params: { nodeId: string };
  searchParams: Promise<{ workspace?: string }>;
}) {
  const { workspace: workspaceId } = (await searchParams) ?? {};
  if (!workspaceId) {
    redirect("/workspace-selector");
  }
  return <TimelinePageClient workspaceId={workspaceId} nodeId={params.nodeId} />;
}


