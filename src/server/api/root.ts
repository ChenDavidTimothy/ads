import { postRouter } from "@/server/api/routers/post";
import { animationRouter } from "@/server/api/routers/animation";
import { assetsRouter } from "@/server/api/routers/assets";
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";
import { workspaceRouter } from "./routers/workspace";
import { cleanupRouter } from "./routers/cleanup";

// Initialize background services
import "../startup";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  post: postRouter,
  animation: animationRouter,
  workspace: workspaceRouter,
  assets: assetsRouter,
  cleanup: cleanupRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);