import dotenv from 'dotenv';
// Load env from .env then override with .env.local if present for local dev
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

// Import worker and boss lazily after env is loaded to satisfy env validation
async function main() {
  // Increase max listeners to prevent warnings from multiple components
  process.setMaxListeners(50); // Increased from 20 to handle multiple pgboss instances
  
  console.log('Starting event-driven render worker...');
  
  try {
    const { registerRenderWorker, shutdownRenderWorker, getWorkerStatus } = await import('./render-worker');
    const { getWorkerBoss, getWorkerBossHealth } = await import('./worker-pgboss-client');
    const { checkEventSystemHealth } = await import('./pg-events');

    // Register the event-driven worker
    await registerRenderWorker();
    console.log('✅ Event-driven render worker registered successfully');

    // Set up health monitoring
    const healthInterval = setInterval(async () => {
      try {
        const workerStatus = getWorkerStatus();
        const bossHealth = await getWorkerBossHealth();
        const eventHealth = await checkEventSystemHealth();

        if (process.env.WORKER_HEALTH_LOG === '1') {
          console.log('Worker Health Check:', {
            timestamp: new Date().toISOString(),
            worker: workerStatus,
            pgboss: bossHealth,
            events: eventHealth
          });
        }

        // Log warnings for unhealthy states
        if (!eventHealth.listenerConnected) {
          console.warn('⚠️  Event listener disconnected - jobs may not be processed immediately');
        }
        
        if (!bossHealth.connected) {
          console.warn('⚠️  PgBoss connection lost');
        }

      } catch (error) {
        console.error('Health check failed:', error);
      }
    }, Number(process.env.WORKER_HEALTH_INTERVAL_MS ?? '60000')); // Default 1 minute

    // Graceful shutdown handler
    const shutdown = async () => {
      console.log('🛑 Shutdown signal received, gracefully shutting down...');
      
      // Clear intervals first
      clearInterval(healthInterval);
      
      try {
        // Shutdown worker (waits for active jobs)
        await shutdownRenderWorker();
        console.log('✅ Render worker shutdown complete');

        // Shutdown worker pgboss
        const boss = await getWorkerBoss();
        await boss.stop();
        console.log('✅ Worker PgBoss shutdown complete');

      } catch (error) {
        console.error('❌ Error during shutdown:', error);
      } finally {
        console.log('✅ Shutdown complete, exiting...');
        process.exit(0);
      }
    };

    // Use once() to prevent duplicate listeners if main() is called multiple times
    process.once('SIGINT', () => {
      void shutdown();
    });
    process.once('SIGTERM', () => {
      void shutdown();
    });

    // Handle uncaught exceptions gracefully
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught exception:', error);
      void shutdown();
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
      void shutdown();
    });

    console.log('🚀 Event-driven render worker is running');
    console.log('📊 Configuration:', {
      concurrency: process.env.RENDER_CONCURRENCY ?? '2',
      retryLimit: process.env.RENDER_JOB_RETRY_LIMIT ?? '5',
      retryDelay: process.env.RENDER_JOB_RETRY_DELAY_SECONDS ?? '15',
      expireMinutes: process.env.RENDER_JOB_EXPIRE_MINUTES ?? '120',
      deadLetterQueue: process.env.RENDER_DEADLETTER_QUEUE ?? 'none',
      healthMonitoring: process.env.WORKER_HEALTH_LOG === '1' ? 'enabled' : 'disabled',
      maintenance: 'disabled', // Maintenance disabled in worker-specific boss
      debug: process.env.JOB_DEBUG === '1' ? 'enabled' : 'disabled',
      eventsDebug: process.env.PG_EVENTS_DEBUG === '1' ? 'enabled' : 'disabled'
    });

    // Keep process alive
    process.stdin.resume();

  } catch (error) {
    console.error('❌ Failed to start worker:', error);
    process.exit(1);
  }
}

// Handle top-level errors
main().catch((error) => {
  console.error('❌ Fatal error in worker entry:', error);
  process.exit(1);
});

// Log startup info
console.log('🔧 Environment:', {
  node_env: process.env.NODE_ENV ?? 'development',
  pg_boss_url: process.env.PG_BOSS_DATABASE_URL ? '✅ configured' : '❌ missing'
});