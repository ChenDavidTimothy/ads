// src/server/jobs/pgboss-client.ts - Performance optimized configuration
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
    
    // CRITICAL: Advisory lock optimization
    newJobCheckInterval: Number(process.env.PG_BOSS_NEW_JOB_CHECK_INTERVAL ?? '2000'), // Reduced from default 5000ms
    
    // CRITICAL: Maintenance interval optimization - reduce database overhead
    maintenanceIntervalSeconds: Number(process.env.PG_BOSS_MAINTENANCE_INTERVAL_SECONDS ?? '60'), // Reduced from default 300s
    
    // Connection pool configuration for advisory lock contention reduction
    max: Number(process.env.PG_BOSS_MAX_CONNECTIONS ?? '10'), // Connection pool size
    application_name: 'pgboss_video_render', // Easier monitoring
    
    // Retention and maintenance - optimized for performance
    deleteAfterDays: Number(process.env.PG_BOSS_DELETE_AFTER_DAYS ?? '7'),
    archiveCompletedAfterSeconds: Number(process.env.PG_BOSS_ARCHIVE_COMPLETED_AFTER_SECONDS ?? '3600'),
    
    // CRITICAL: Reduce monitoring overhead - increased from 60s to 300s
    monitorStateIntervalSeconds: Number(process.env.PG_BOSS_MONITOR_STATE_INTERVAL_SECONDS ?? '300'),
    
    // CRITICAL: Archive interval optimization - reduce maintenance load
    archiveIntervalMinutes: Number(process.env.PG_BOSS_ARCHIVE_INTERVAL_MINUTES ?? '60'), // Archive every hour instead of default
    
    // CRITICAL: Delete interval optimization
    deleteIntervalHours: Number(process.env.PG_BOSS_DELETE_INTERVAL_HOURS ?? '24'), // Delete daily instead of more frequent
    
    // Performance: Disable supervisor if not needed for job dependencies
    supervise: process.env.PG_BOSS_DISABLE_SUPERVISOR !== 'true',
    
    // Performance: Retention policies to prevent table bloat
    retentionDays: Number(process.env.PG_BOSS_RETENTION_DAYS ?? '30'),
  };

  const boss = new PgBoss(bossOptions);

  boss.on('error', (err) => {
    logger.errorWithStack('PgBoss error', err);
  });

  // CRITICAL: Add maintenance event monitoring for performance insights
  boss.on('maintenance', () => {
    logger.debug('PgBoss maintenance completed');
  });

  bossStarting = boss.start().then(() => {
    bossSingleton = boss;
    logger.info('PgBoss started with optimized configuration', {
      newJobCheckInterval: bossOptions.newJobCheckInterval,
      maintenanceInterval: bossOptions.maintenanceIntervalSeconds,
      maxConnections: bossOptions.max,
      archiveInterval: bossOptions.archiveIntervalMinutes,
    });

    // graceful shutdown - only add listeners once
    if (typeof process !== 'undefined' && !shutdownListenersAdded) {
      shutdownListenersAdded = true;
      const shutdown = async () => {
        try {
          await boss.stop();
        } catch {
          // ignore
        }
      };
      process.once('SIGINT', () => { void shutdown(); });
      process.once('SIGTERM', () => { void shutdown(); });
    }

    return boss;
  });

  return bossStarting;
}