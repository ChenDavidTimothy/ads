import { redirect } from "next/navigation";
import { WorkspaceLayout } from "@/components/workspace/workspace-layout";
import { createClient } from "@/utils/supabase/server";

interface WorkspacePageProps {
  searchParams: Promise<{
    workspace?: string;
    tab?: string;
    node?: string;
    redirectTo?: string;
  }>;
}

export default async function WorkspaceEditorPage({
  searchParams,
}: WorkspacePageProps) {
  // Get search params
  const params = await searchParams;
  const { workspace: workspaceId, tab, node } = params;

  // Check authentication
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    // User is not authenticated, redirect to login with return URL
    const loginUrl = new URL(
      "/login",
      process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    );
    const currentUrl = `/workspace${workspaceId ? `?workspace=${workspaceId}` : ""}${tab ? `&tab=${tab}` : ""}${node ? `&node=${node}` : ""}`;
    loginUrl.searchParams.set("redirectTo", currentUrl);
    redirect(loginUrl.toString());
  }

  // If no workspace ID is provided, redirect to dashboard
  if (!workspaceId) {
    redirect("/dashboard");
  }

  // Validate that the workspace belongs to the user
  try {
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id, name")
      .eq("id", workspaceId)
      .eq("user_id", user.id)
      .single();

    if (workspaceError || !workspace) {
      // Workspace doesn't exist or doesn't belong to user
      redirect("/dashboard");
    }
  } catch (error) {
    console.error("Error validating workspace:", error);
    redirect("/dashboard");
  }

  return <WorkspaceLayout workspaceId={workspaceId} />;
}
