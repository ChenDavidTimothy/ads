import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { useNotifications } from "@/hooks/use-notifications";

export interface WorkspaceOperationResult {
  isLoading: boolean;
  error: unknown;
}

export interface UseWorkspaceOperationsReturn {
  duplicate: {
    mutate: (workspaceId: string) => void;
    result: WorkspaceOperationResult;
  };
  delete: {
    mutate: (workspaceId: string) => void;
    result: WorkspaceOperationResult;
  };
  rename: {
    mutate: (workspaceId: string, newName: string) => void;
    result: WorkspaceOperationResult;
  };
  // Future operations can be added here
  // archive: { mutate: (workspaceId: string) => void; result: WorkspaceOperationResult };
}

/**
 * Custom hook for managing workspace operations (duplicate, delete, etc.)
 * Provides consistent error handling, loading states, and user feedback
 */
export function useWorkspaceOperations(): UseWorkspaceOperationsReturn {
  const router = useRouter();
  const utils = api.useUtils();
  const { toast } = useNotifications();

  const duplicateWorkspace = api.workspace.duplicate.useMutation({
    onSuccess: async (ws) => {
      await utils.workspace.list.invalidate();
      toast.success(
        "Workspace duplicated successfully!",
        `Created "${ws.name}"`,
      );
      router.push(`/workspace?workspace=${ws.id}`);
    },
    onError: (error) => {
      console.error("Failed to duplicate workspace:", error);
      toast.error(
        "Failed to duplicate workspace",
        "Please try again or contact support if the problem persists.",
      );
    },
  });

  const deleteWorkspace = api.workspace.delete.useMutation({
    onSuccess: async (_result) => {
      await utils.workspace.list.invalidate();
      toast.success(
        "Workspace deleted successfully",
        "The workspace has been permanently removed.",
      );
    },
    onError: (error) => {
      console.error("Failed to delete workspace:", error);
      toast.error(
        "Failed to delete workspace",
        "Please try again or contact support if the problem persists.",
      );
    },
  });

  const renameWorkspace = api.workspace.rename.useMutation({
    onSuccess: async (result) => {
      await utils.workspace.list.invalidate();
      const finalName = (
        result as { workspace: { name: string }; originalName: string }
      ).workspace.name;
      const originalName = (
        result as { workspace: { name: string }; originalName: string }
      ).originalName;
      const message =
        finalName !== originalName
          ? `Renamed to "${finalName}"`
          : "Workspace renamed successfully";

      toast.success("Workspace renamed successfully", message);
    },
    onError: (error) => {
      console.error("Failed to rename workspace:", error);
      toast.error(
        "Failed to rename workspace",
        "Please try again or contact support if the problem persists.",
      );
    },
  });

  return {
    duplicate: {
      mutate: (workspaceId: string) =>
        duplicateWorkspace.mutate({ id: workspaceId }),
      result: {
        isLoading: duplicateWorkspace.isPending,
        error: duplicateWorkspace.error,
      },
    },
    delete: {
      mutate: (workspaceId: string) =>
        deleteWorkspace.mutate({ id: workspaceId }),
      result: {
        isLoading: deleteWorkspace.isPending,
        error: deleteWorkspace.error,
      },
    },
    rename: {
      mutate: (workspaceId: string, newName: string) =>
        renameWorkspace.mutate({ id: workspaceId, newName }),
      result: {
        isLoading: renameWorkspace.isPending,
        error: renameWorkspace.error,
      },
    },
  };
}
