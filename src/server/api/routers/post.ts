import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/trpc";
import type { createTRPCContext } from "@/server/api/trpc";
import { z } from "zod";

type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;
type HelloInput = { text: string };
type CreatePostInput = { name: string };

interface Post {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
}

export const postRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }: { input: HelloInput }) => {
      return {
        greeting: `Hello ${input.text}`,
      };
    }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(
      async ({ ctx, input }: { ctx: TRPCContext; input: CreatePostInput }) => {
        const { supabase, user } = ctx;
        const { error } = await supabase
          .from("posts")
          .insert({ name: input.name, user_id: user!.id });
        if (error) {
          throw error;
        }
        return { success: true } as const;
      },
    ),

  getLatest: protectedProcedure.query(
    async ({ ctx }: { ctx: TRPCContext }): Promise<Post | null> => {
      const { supabase, user } = ctx;
      const result = await supabase
        .from("posts")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (result.error) throw result.error;
      return result.data as Post | null;
    },
  ),
});
