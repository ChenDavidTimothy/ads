import dotenv from 'dotenv';
// Load env from .env then override with .env.local if present for local dev
dotenv.config();
dotenv.config({ path: '.env.local', override: true });
// Import worker and boss lazily after env is loaded to satisfy env validation

async function main() {
  const { registerRenderWorker, shutdownRenderWorker } = await import('./render-worker');
  const { getBoss } = await import('./pgboss-client');
  await registerRenderWorker();
  const boss = await getBoss();

  const shutdown = async () => {
    try {
      await shutdownRenderWorker();
      await boss.stop();
    } catch {
      // ignore
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGINT', () => {
    void shutdown();
  });
  process.on('SIGTERM', () => {
    void shutdown();
  });
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();


