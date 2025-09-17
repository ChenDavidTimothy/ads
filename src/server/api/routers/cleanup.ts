// src/server/api/routers/cleanup.ts

import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';
import { serviceRegistry } from '@/server/services/service-registry';

export const cleanupRouter = createTRPCRouter({
  getStatus: protectedProcedure.query(async () => {
    const status = serviceRegistry.getStatus();
    const cleanupStatus = status.cleanup;
    return {
      isRunning: cleanupStatus?.isRunning ?? false,
      message: cleanupStatus?.isRunning
        ? 'Cleanup service is running and cleaning orphaned files every 3 minutes'
        : 'Cleanup service is not running',
    };
  }),

  start: protectedProcedure.mutation(async () => {
    await serviceRegistry.initialize();
    return {
      success: true,
      message: 'Cleanup service started successfully',
    };
  }),

  stop: protectedProcedure.mutation(async () => {
    await serviceRegistry.shutdown();
    return {
      success: true,
      message: 'Cleanup service stopped successfully',
    };
  }),
});
