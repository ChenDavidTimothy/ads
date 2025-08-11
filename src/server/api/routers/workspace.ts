import { z } from "zod";
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
    .input(z.object({ name: z.string().min(1).max(100).default("Untitled") }).optional())
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
        flowData: z.object({ nodes: z.any().array(), edges: z.any().array() }),
        version: z.number().int().nonnegative(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx;
      // Optimistic concurrency: version must match
      const { data, error } = await supabase
        .from("workspaces")
        .update({ flow_data: input.flowData, version: (input.version + 1) })
        .eq("id", input.id)
        .eq("user_id", user.id)
        .eq("version", input.version)
        .select("version, updated_at")
        .single();

      if (error) throw error;
      if (!data) {
        throw new Error("CONFLICT: Workspace has changed since last load. Please reload.");
      }

      return saveResultSchema.parse(data);
    }),
});

export type WorkspaceRouter = typeof workspaceRouter;


