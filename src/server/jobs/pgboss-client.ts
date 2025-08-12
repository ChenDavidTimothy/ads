import PgBoss from 'pg-boss';
import { logger } from '@/lib/logger';

let bossSingleton: PgBoss | null = null;
let bossStarting: Promise<PgBoss> | null = null;
let shutdownListenersAdded = false;

export async function getBoss(): Promise<PgBoss> {
  if (bossSingleton) return bossSingleton;
  if (bossStarting) return bossStarting;

  const connectionString = process.env.PG_BOSS_DATABASE_URL;
  if (!connectionString) {
    throw new Error('PG_BOSS_DATABASE_URL is not set');
  }

  const bossOptions: PgBoss.ConstructorOptions = {
    connectionString,
    // Disable all polling - we use NOTIFY/LISTEN instead
    noSupervisor: true, // Disable internal supervisor polling
    noScheduling: true, // Disable scheduling polling
    
    // Retention and maintenance settings (these don't poll continuously)
    deleteAfterDays: Number(process.env.PG_BOSS_DELETE_AFTER_DAYS ?? '7'),
    archiveCompletedAfterSeconds: Number(process.env.PG_BOSS_ARCHIVE_COMPLETED_AFTER_SECONDS ?? '3600'),
    
    // Set monitoring to minimum frequency since we'll implement custom health checks
    monitorStateIntervalSeconds: Number(process.env.PG_BOSS_MONITOR_STATE_INTERVAL_SECONDS ?? '3600'), // 1 hour minimum
    
    // Connection pool settings for stability - reduced to prevent conflicts
    max: Number(process.env.PG_BOSS_MAX_CONNECTIONS ?? '3'), // Reduced from 10 to 3
    
    // Database schema settings
    schema: 'pgboss',
    
    // Set maintenance to minimum frequency since we'll handle this manually
    maintenanceIntervalSeconds: Number(process.env.PG_BOSS_MAINTENANCE_INTERVAL_SECONDS ?? '3600'), // 1 hour minimum
    
    // Application name for connection tracking
    application_name: process.env.APP_NAME ? `${process.env.APP_NAME}_worker` : 'render_worker',
    
    // Connection timeout settings - more conservative
    connectionTimeoutMillis: Number(process.env.PG_BOSS_CONNECTION_TIMEOUT_MS ?? '30000'),
    idleTimeoutMillis: Number(process.env.PG_BOSS_IDLE_TIMEOUT_MS ?? '30000'),
    
    // Archive settings - keep completed jobs briefly for debugging
    archiveFailedAfterSeconds: Number(process.env.PG_BOSS_ARCHIVE_FAILED_AFTER_SECONDS ?? '86400'), // 24 hours
    
    // Prevent connection conflicts
    uuid: 'v4', // Use v4 UUIDs to prevent conflicts
  };

  const boss = new PgBoss(bossOptions);

  // Enhanced error handling for production
  boss.on('error', (err) => {
    logger.errorWithStack('PgBoss error', err, {
      context: 'pgboss_client',
      connectionString: connectionString.replace(/\/\/.*@/, '//***@') // Mask credentials in logs
    });
  });

  // Monitor for maintenance events if needed
  boss.on('maintenance', () => {
    if (process.env.PG_BOSS_DEBUG === '1') {
      logger.info('PgBoss maintenance completed');
    }
  });

  bossStarting = boss.start().then(() => {
    bossSingleton = boss;
    logger.info('PgBoss started with minimal polling', {
      noSupervisor: bossOptions.noSupervisor,
      noScheduling: bossOptions.noScheduling,
      monitorStateIntervalSeconds: bossOptions.monitorStateIntervalSeconds,
      maintenanceIntervalSeconds: bossOptions.maintenanceIntervalSeconds
    });

    // Graceful shutdown - only add listeners once
    if (typeof process !== 'undefined' && !shutdownListenersAdded) {
      shutdownListenersAdded = true;
      const shutdown = async () => {
        try {
          logger.info('Shutting down PgBoss...');
          await boss.stop();
          logger.info('PgBoss shutdown complete');
        } catch (error) {
          logger.errorWithStack('Error during PgBoss shutdown', error);
        }
      };
      process.once('SIGINT', () => { void shutdown(); });
      process.once('SIGTERM', () => { void shutdown(); });
    }

    return boss;
  });

  return bossStarting;
}

// Get boss instance health status
export async function getBossHealth(): Promise<{
  connected: boolean;
  queueCount?: number;
  error?: string;
}> {
  try {
    if (!bossSingleton) {
      return { connected: false, error: 'Boss not initialized' };
    }

    // Test connection with a simple query
    await bossSingleton.db.query('SELECT 1');
    
    // Get queue statistics
    const result = await bossSingleton.db.query(`
      SELECT COUNT(*) as queue_count 
      FROM pgboss.job 
      WHERE state < 10 AND name = 'render-video'
    `);
    
    const queueCount = parseInt(result.rows[0]?.queue_count ?? '0', 10);

    return { 
      connected: true, 
      queueCount 
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { 
      connected: false, 
      error: errorMessage 
    };
  }
}

// Manual maintenance trigger (since we disabled automatic maintenance)
export async function runMaintenance(): Promise<void> {
  if (!bossSingleton) {
    throw new Error('Boss not initialized');
  }
  
  try {
    logger.info('Running manual PgBoss maintenance...');
    
    // Archive completed jobs
    const archiveResult = await bossSingleton.db.query(`
      UPDATE pgboss.job 
      SET archived_on = now() 
      WHERE archived_on IS NULL 
        AND completed_on IS NOT NULL 
        AND completed_on < now() - interval '${bossSingleton.config.archiveCompletedAfterSeconds} seconds'
    `);
    
    // Delete old archived jobs
    const deleteResult = await bossSingleton.db.query(`
      DELETE FROM pgboss.job 
      WHERE archived_on IS NOT NULL 
        AND archived_on < now() - interval '${bossSingleton.config.deleteAfterDays} days'
    `);
    
    logger.info('Manual maintenance completed', {
      archivedJobs: archiveResult.rowCount ?? 0,
      deletedJobs: deleteResult.rowCount ?? 0
    });
  } catch (error) {
    logger.errorWithStack('Manual maintenance failed', error);
    throw error;
  }
}

// Create queues explicitly (since we disabled supervisor)
export async function ensureQueues(): Promise<void> {
  const boss = await getBoss();
  
  try {
    // Ensure render queue exists
    await boss.createQueue('render-video', {
      policy: 'standard',
      retryLimit: Number(process.env.RENDER_JOB_RETRY_LIMIT ?? '5'),
      retryDelay: Number(process.env.RENDER_JOB_RETRY_DELAY_SECONDS ?? '15'),
      retryBackoff: true,
      expireInSeconds: Number(process.env.RENDER_JOB_EXPIRE_MINUTES ?? '120') * 60
    });
    
    logger.info('Queues ensured', { queues: ['render-video'] });
  } catch (error) {
    // Ignore if queue already exists or not supported
    if (process.env.PG_BOSS_DEBUG === '1') {
      logger.info('Queue creation result', { error: error instanceof Error ? error.message : String(error) });
    }
  }
}