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

  const boss = new PgBoss(connectionString);

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


