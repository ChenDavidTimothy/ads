import type { createTRPCContext } from "@/server/api/trpc";

export type AnimationTRPCContext = Awaited<
  ReturnType<typeof createTRPCContext>
>;
