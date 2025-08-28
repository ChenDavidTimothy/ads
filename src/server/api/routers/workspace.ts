import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

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

      const currentWorkspace = currentWorkspaceRaw as DatabaseWorkspaceRow | null;

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
