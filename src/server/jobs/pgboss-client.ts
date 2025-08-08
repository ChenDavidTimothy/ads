import PgBoss from 'pg-boss';

let bossSingleton: PgBoss | null = null;
let bossStarting: Promise<PgBoss> | null = null;

export async function getBoss(): Promise<PgBoss> {
  if (bossSingleton) return bossSingleton;
  if (bossStarting) return bossStarting;

  const connectionString = process.env.PG_BOSS_DATABASE_URL;
  if (!connectionString) {
    throw new Error('PG_BOSS_DATABASE_URL is not set');
  }

  const boss = new PgBoss({
    connectionString,
    // retention and maintenance defaults; can be tuned via env
    deleteAfterDays: Number(process.env.PG_BOSS_DELETE_AFTER_DAYS ?? '7'),
    archiveCompletedAfterSeconds: Number(process.env.PG_BOSS_ARCHIVE_COMPLETED_AFTER_SECONDS ?? '3600'),
    // Enable internal state monitoring to make operational health observable
    monitorStateIntervalSeconds: Number(process.env.PG_BOSS_MONITOR_STATE_INTERVAL_SECONDS ?? '60'),
  } as any);

  boss.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('[pg-boss] error', err);
  });

  bossStarting = boss.start().then(() => {
    bossSingleton = boss;
    // eslint-disable-next-line no-console
    console.log('[pg-boss] started');

    // graceful shutdown
    if (typeof process !== 'undefined') {
      const shutdown = async () => {
        try {
          await boss.stop();
        } catch {
          // ignore
        }
      };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    }

    return boss;
  });

  return bossStarting;
}


