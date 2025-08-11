import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

type FlowData = {
  nodes: unknown[];
  edges: unknown[];
};

export const workspaceRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { supabase, user } = ctx;
    const { data, error } = await supabase
      .from("workspaces")
      .select("id, name, updated_at")
      .eq("user_id", user!.id)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { supabase, user } = ctx;
      const { data, error } = await supabase
        .from("workspaces")
        .select("id, name, flow_data, version, updated_at, created_at")
        .eq("id", input.id)
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data as { id: string; name: string; flow_data: FlowData; version: number; updated_at: string; created_at: string };
    }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(100).default("Untitled") }).optional())
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx;
      const payload = {
        user_id: user!.id,
        name: input?.name ?? "Untitled",
        flow_data: { nodes: [], edges: [] } satisfies FlowData,
      };
      const { data, error } = await supabase
        .from("workspaces")
        .insert(payload)
        .select("id, name, flow_data, version, updated_at, created_at")
        .single();
      if (error) throw error;
      return data as { id: string; name: string; flow_data: FlowData; version: number; updated_at: string; created_at: string };
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
        .eq("user_id", user!.id)
        .eq("version", input.version)
        .select("version, updated_at")
        .single();

      if (error) throw error;
      if (!data) {
        throw new Error("CONFLICT: Workspace has changed since last load. Please reload.");
      }

      return data as { version: number; updated_at: string };
    }),
});

export type WorkspaceRouter = typeof workspaceRouter;


