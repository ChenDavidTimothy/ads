import { redirect } from "next/navigation";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ nodeId: string }>;
  searchParams: Promise<{ workspace?: string }>;
}) {
  const { workspace: workspaceId } = (await searchParams) ?? {};
  const { nodeId } = await params;
  if (!workspaceId) {
    redirect("/workspace-selector");
  }
  redirect(`/workspace?workspace=${workspaceId}&tab=timeline&node=${nodeId}`);
}


