import PgBoss from 'pg-boss';
import { logger } from '@/lib/logger';

let workerBossSingleton: PgBoss | null = null;
let workerBossStarting: Promise<PgBoss> | null = null;
let shutdownListenersAdded = false;

export async function getWorkerBoss(): Promise<PgBoss> {
  if (workerBossSingleton) return workerBossSingleton;
  if (workerBossStarting) return workerBossStarting;

  const connectionString = process.env.PG_BOSS_DATABASE_URL;
  if (!connectionString) {
    throw new Error('PG_BOSS_DATABASE_URL is not set');
  }

  const bossOptions: PgBoss.ConstructorOptions = {
    connectionString,
    
    // Worker-specific settings - completely disable polling/supervision
    noSupervisor: true,
    noScheduling: true,
    
    // Minimal connection pool for worker
    max: 2, // Just enough for worker operations
    
    // Database schema settings
    schema: 'pgboss',
    
    // Disable all background polling
    monitorStateIntervalSeconds: 3600, // 1 hour minimum (can't be 0)
    maintenanceIntervalSeconds: 3600,   // 1 hour minimum (can't be 0)
    
    // Worker-specific application name
    application_name: 'render_worker_dedicated',
    
    // Conservative connection settings
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
    
    // Unique worker instance ID
    uuid: 'v4',
    
    // Archive settings (won't be used since maintenance is disabled)
    deleteAfterDays: 7,
    archiveCompletedAfterSeconds: 3600,
    archiveFailedAfterSeconds: 86400,
  };

  const boss = new PgBoss(bossOptions);

  // Enhanced error handling for worker
  boss.on('error', (err) => {
    logger.errorWithStack('Worker PgBoss error', err, {
      context: 'worker_pgboss_client',
      workerPid: process.pid
    });
  });

  boss.on('maintenance', () => {
    if (process.env.JOB_DEBUG === '1') {
      logger.info('Worker PgBoss maintenance completed');
    }
  });

  workerBossStarting = boss.start().then(() => {
    workerBossSingleton = boss;
    logger.info('Worker PgBoss started successfully', {
      pid: process.pid,
      applicationName: bossOptions.application_name,
      maxConnections: bossOptions.max,
      noSupervisor: bossOptions.noSupervisor,
      noScheduling: bossOptions.noScheduling
    });

    // Graceful shutdown - only add listeners once
    if (typeof process !== 'undefined' && !shutdownListenersAdded) {
      shutdownListenersAdded = true;
      const shutdown = async () => {
        try {
          logger.info('Shutting down worker PgBoss...');
          await boss.stop();
          logger.info('Worker PgBoss shutdown complete');
        } catch (error) {
          logger.errorWithStack('Error during worker PgBoss shutdown', error);
        }
      };
      process.once('SIGINT', () => { void shutdown(); });
      process.once('SIGTERM', () => { void shutdown(); });
    }

    return boss;
  });

  return workerBossStarting;
}

// Worker-specific health check
export async function getWorkerBossHealth(): Promise<{
  connected: boolean;
  queueCount?: number;
  error?: string;
}> {
  try {
    if (!workerBossSingleton) {
      return { connected: false, error: 'Worker boss not initialized' };
    }

    // Simple connection test
    const result = await workerBossSingleton.getQueueSize('render-video');
    
    return { 
      connected: true, 
      queueCount: result 
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { 
      connected: false, 
      error: errorMessage 
    };
  }
}