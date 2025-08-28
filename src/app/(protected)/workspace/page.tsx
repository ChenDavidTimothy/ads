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
  const { workspace: workspaceId } = params;

  const supabase = await createClient();

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
      .single();

    if (workspaceError || !workspace) {
      // Workspace doesn't exist or doesn't belong to user
      console.warn(
        "Workspace not found or doesn't belong to user:",
        workspaceId,
      );

      // Check if user has any workspaces
      const { data: userWorkspaces } = await supabase
        .from("workspaces")
        .select("id, name")
        .order("updated_at", { ascending: false })
        .limit(1);

      if (userWorkspaces && userWorkspaces.length > 0 && userWorkspaces[0]) {
        // Redirect to user's first workspace
        console.log("Redirecting to user's workspace:", userWorkspaces[0].id);
        redirect(`/workspace?workspace=${userWorkspaces[0].id}`);
      } else {
        // User has no workspaces, redirect to dashboard to create one
        console.log("No workspaces found for user, redirecting to dashboard");
        redirect("/dashboard");
      }
      return; // This line won't be reached but TypeScript needs it
    }
  } catch (error) {
    console.error("Error validating workspace:", error);

    // On error, try to find any user workspace as fallback
    try {
      const { data: userWorkspaces } = await supabase
        .from("workspaces")
        .select("id, name")
        .order("updated_at", { ascending: false })
        .limit(1);

      if (userWorkspaces && userWorkspaces.length > 0 && userWorkspaces[0]) {
        console.log(
          "Fallback: Redirecting to user's workspace after error:",
          userWorkspaces[0].id,
        );
        redirect(`/workspace?workspace=${userWorkspaces[0].id}`);
      } else {
        redirect("/dashboard");
      }
    } catch (fallbackError) {
      console.error("Fallback workspace lookup also failed:", fallbackError);
      redirect("/dashboard");
    }
  }

  return <WorkspaceLayout workspaceId={workspaceId} />;
}
