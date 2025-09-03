import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import type { SupabaseClient } from "@supabase/supabase-js";

// Workspace operation utilities
const generateUniqueWorkspaceName = async (
  supabase: SupabaseClient,
  userId: string,
  baseName: string,
  copyPrefix = "Copy of ",
): Promise<string> => {
  // If it's already a copy, don't add another prefix
  const newName = baseName.startsWith(copyPrefix)
    ? baseName
    : `${copyPrefix}${baseName}`;

  // Get all existing workspace names for this user
  const { data: existingWorkspaces, error } = await supabase
    .from("workspaces")
    .select("name")
    .eq("user_id", userId);

  if (error) {
    console.warn(
      "[WorkspaceRouter] Could not check for name conflicts:",
      error,
    );
    return newName; // Fall back to generated name
  }

  const existingNames = new Set(
    existingWorkspaces?.map((ws: { name: string }) => ws.name) ?? [],
  );

  // If the generated name doesn't conflict, use it
  if (!existingNames.has(newName)) {
    return newName;
  }

  // Find the next available numbered name
  let counter = 1;
  let candidateName = `${newName} (${counter})`;

  while (existingNames.has(candidateName)) {
    counter++;
    candidateName = `${newName} (${counter})`;

    // Safety check to prevent infinite loops
    if (counter > 100) {
      return `${newName} (${Date.now()})`;
    }
  }

  return candidateName;
};

const validateWorkspaceAccess = async (
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
) => {
  const { data, error } = await supabase
    .from("workspaces")
    .select("id, name")
    .eq("id", workspaceId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Workspace not found or access denied.",
      cause: error,
    });
  }

  return data;
};

// Runtime schemas to type outputs precisely and avoid `any` in consumers
const flowDataSchema = z.object({
  nodes: z.array(z.unknown()),
  edges: z.array(z.unknown()),
});

const workspaceListRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  updated_at: z.string(),
});

const workspaceRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  flow_data: flowDataSchema.nullable(),
  version: z.number().int().nonnegative(),
  updated_at: z.string(),
  created_at: z.string(),
});

const saveResultSchema = z.object({
  version: z.number().int().nonnegative(),
  updated_at: z.string(),
});

// Define proper type for flow data input instead of using any
type FlowDataInput = z.infer<typeof flowDataSchema>;

// Define type for database workspace row
type DatabaseWorkspaceRow = {
  flow_data: FlowDataInput | null;
  version: number;
};

export const workspaceRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { supabase, user } = ctx;
    const { data, error } = await supabase
      .from("workspaces")
      .select("id, name, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return workspaceListRowSchema.array().parse(data);
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { supabase, user } = ctx;
      const { data, error } = await supabase
        .from("workspaces")
        .select("id, name, flow_data, version, updated_at, created_at")
        .eq("id", input.id)
        .eq("user_id", user.id)
        .single();
      if (error) throw error;
      return workspaceRowSchema.parse(data);
    }),

  create: protectedProcedure
    .input(
      z
        .object({ name: z.string().min(1).max(100).default("Untitled") })
        .optional(),
    )
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx;
      const payload = {
        user_id: user.id,
        name: input?.name ?? "Untitled",
        flow_data: { nodes: [], edges: [] },
      };
      const { data, error } = await supabase
        .from("workspaces")
        .insert(payload)
        .select("id, name, flow_data, version, updated_at, created_at")
        .single();
      if (error) throw error;
      return workspaceRowSchema.parse(data);
    }),

  duplicate: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx;

      try {
        // Validate workspace access and get basic info
        const originalWorkspace = await validateWorkspaceAccess(
          supabase,
          input.id,
          user.id,
        );

        // Fetch the full workspace data for duplication
        const { data: fullWorkspace, error: fetchError } = await supabase
          .from("workspaces")
          .select("flow_data, version")
          .eq("id", input.id)
          .eq("user_id", user.id)
          .single();

        if (fetchError || !fullWorkspace) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Failed to fetch workspace data for duplication.",
            cause: fetchError,
          });
        }

        // Generate a unique name for the duplicate
        const newName = await generateUniqueWorkspaceName(
          supabase,
          user.id,
          (originalWorkspace as { name: string }).name,
        );

        // Deep clone the flow data to ensure complete isolation
        const clonedFlowData: Record<string, unknown> = (
          fullWorkspace as { flow_data: unknown }
        ).flow_data
          ? (JSON.parse(
              JSON.stringify(
                (fullWorkspace as { flow_data: unknown }).flow_data,
              ),
            ) as Record<string, unknown>)
          : { nodes: [], edges: [] };

        // Create the duplicate workspace
        const { data: newWorkspace, error: createError } = await supabase
          .from("workspaces")
          .insert({
            user_id: user.id,
            name: newName,
            flow_data: clonedFlowData,
          })
          .select("id, name, flow_data, version, updated_at, created_at")
          .single();

        if (createError || !newWorkspace) {
          console.error(
            "[WorkspaceRouter] Failed to create duplicate workspace:",
            createError,
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create duplicate workspace. Please try again.",
            cause: createError,
          });
        }

        console.log(
          `[WorkspaceRouter] Successfully duplicated workspace "${originalWorkspace.name}" to "${newName}"`,
        );
        return workspaceRowSchema.parse(newWorkspace);
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        console.error(
          "[WorkspaceRouter] Unexpected error during duplication:",
          error,
        );
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred during workspace duplication.",
          cause: error,
        });
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx;

      try {
        // Validate workspace access before deletion
        const workspace = await validateWorkspaceAccess(
          supabase,
          input.id,
          user.id,
        );

        // Perform the deletion
        const { error: deleteError } = await supabase
          .from("workspaces")
          .delete()
          .eq("id", input.id)
          .eq("user_id", user.id);

        if (deleteError) {
          console.error(
            "[WorkspaceRouter] Failed to delete workspace:",
            deleteError,
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to delete workspace. Please try again.",
            cause: deleteError,
          });
        }

        console.log(
          `[WorkspaceRouter] Successfully deleted workspace "${workspace.name}"`,
        );
        return { success: true, deletedWorkspaceId: input.id };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        console.error(
          "[WorkspaceRouter] Unexpected error during deletion:",
          error,
        );
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred during workspace deletion.",
          cause: error,
        });
      }
    }),

  rename: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        newName: z.string().min(1).max(100).trim(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx;

      try {
        // Validate workspace access
        const workspace = await validateWorkspaceAccess(
          supabase,
          input.id,
          user.id,
        );

        // Don't allow renaming to the same name
        if (workspace.name === input.newName) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Workspace is already named that.",
          });
        }

        // Check if the requested name conflicts with existing workspaces
        const { data: existingWorkspaces, error: checkError } = await supabase
          .from("workspaces")
          .select("name")
          .eq("user_id", user.id)
          .neq("id", input.id); // Exclude current workspace

        if (checkError) {
          console.warn(
            "[WorkspaceRouter] Could not check for name conflicts during rename:",
            checkError,
          );
        }

        const existingNames = new Set(
          existingWorkspaces?.map((ws: { name: string }) => ws.name) ?? [],
        );

        let finalName = input.newName;

        // If there's a conflict, generate a unique name
        if (existingNames.has(input.newName)) {
          let counter = 1;
          let candidateName = `${input.newName} (${counter})`;

          while (existingNames.has(candidateName)) {
            counter++;
            candidateName = `${input.newName} (${counter})`;

            // Safety check to prevent infinite loops
            if (counter > 100) {
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message:
                  "Unable to generate a unique name. Please try a different name.",
              });
            }
          }
          finalName = candidateName;
        }

        // Perform the rename
        const { data: renamedWorkspace, error: renameError } = await supabase
          .from("workspaces")
          .update({ name: finalName })
          .eq("id", input.id)
          .eq("user_id", user.id)
          .select("id, name, updated_at")
          .single();

        if (renameError || !renamedWorkspace) {
          console.error(
            "[WorkspaceRouter] Failed to rename workspace:",
            renameError,
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to rename workspace. Please try again.",
            cause: renameError,
          });
        }

        console.log(
          `[WorkspaceRouter] Successfully renamed workspace from "${(workspace as { name: string }).name}" to "${finalName}"`,
        );
        return {
          success: true,
          workspace: renamedWorkspace,
          originalName: (workspace as { name: string }).name,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        console.error(
          "[WorkspaceRouter] Unexpected error during rename:",
          error,
        );
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred during workspace rename.",
          cause: error,
        });
      }
    }),

  save: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        flowData: z.object({
          nodes: z.unknown().array(),
          edges: z.unknown().array(),
        }),
        version: z.number().int().nonnegative(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx;

      // FIX: Properly type the flow data instead of using any
      const flowData = flowDataSchema.parse(input.flowData);

      // Check if the flow data has actually changed to avoid unnecessary updates
      const { data: currentWorkspaceRaw, error: fetchError } = await supabase
        .from("workspaces")
        .select("flow_data, version")
        .eq("id", input.id)
        .eq("user_id", user.id)
        .single();

      const currentWorkspace =
        currentWorkspaceRaw as DatabaseWorkspaceRow | null;

      if (fetchError) {
        console.error(
          "[WorkspaceRouter] Failed to fetch current workspace:",
          fetchError,
        );
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workspace not found or access denied.",
          cause: fetchError,
        });
      }

      if (
        currentWorkspace &&
        currentWorkspace.version === input.version &&
        JSON.stringify(currentWorkspace.flow_data) === JSON.stringify(flowData)
      ) {
        // No changes detected, return current data without updating
        return saveResultSchema.parse({
          version: currentWorkspace.version,
          updated_at: new Date().toISOString(),
        });
      }

      // Optimistic concurrency: version must match
      const { data, error } = await supabase
        .from("workspaces")
        .update({ flow_data: flowData, version: input.version + 1 })
        .eq("id", input.id)
        .eq("user_id", user.id)
        .eq("version", input.version)
        .select("version, updated_at")
        .maybeSingle();

      if (error) {
        console.error("[WorkspaceRouter] Save failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to save workspace. Please try again.",
          cause: error,
        });
      }
      if (!data) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Workspace has changed since last load. Please reload.",
        });
      }

      return saveResultSchema.parse(data);
    }),
});

export type WorkspaceRouter = typeof workspaceRouter;
