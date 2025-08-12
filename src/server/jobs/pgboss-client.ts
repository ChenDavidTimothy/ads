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
    // retention and maintenance defaults; can be tuned via env
    deleteAfterDays: Number(process.env.PG_BOSS_DELETE_AFTER_DAYS ?? '7'),
    archiveCompletedAfterSeconds: Number(process.env.PG_BOSS_ARCHIVE_COMPLETED_AFTER_SECONDS ?? '3600'),
    
    // PURE EVENT-DRIVEN: Disable polling entirely by setting extremely high intervals
    // Job processing is now driven by PostgreSQL LISTEN/NOTIFY events
    newJobCheckIntervalSeconds: 86400, // 24 hours - effectively disabled
    maintenanceIntervalSeconds: Number(process.env.PG_BOSS_MAINTENANCE_INTERVAL_SECONDS ?? '86400'), // 24 hours - effectively disabled
    monitorStateIntervalSeconds: Number(process.env.PG_BOSS_MONITOR_STATE_INTERVAL_SECONDS ?? '86400'), // 24 hours - effectively disabled
    
    // Event-driven system provides instant job processing via LISTEN/NOTIFY
    // This eliminates the ~185k polling database calls we were seeing
  };

  const boss = new PgBoss(bossOptions);

  boss.on('error', (err) => {
    logger.errorWithStack('PgBoss error', err);
  });

  bossStarting = boss.start().then(() => {
    bossSingleton = boss;
    logger.info('PgBoss started in event-driven mode (polling disabled)');

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


