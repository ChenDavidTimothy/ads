import { Pool } from "pg";
import { logger } from "@/lib/logger";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

export const pgPool = new Pool({
  connectionString,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  max: Number(process.env.PG_POOL_MAX ?? 10),
  maxUses: Number(process.env.PG_POOL_MAX_USES ?? 7500),
  idleTimeoutMillis: Number(process.env.PG_POOL_IDLE_TIMEOUT_MS ?? 30000),
  connectionTimeoutMillis: Number(
    process.env.PG_POOL_CONNECTION_TIMEOUT_MS ?? 10000,
  ),
});

pgPool.on("error", (err) => {
  logger.errorWithStack("Unexpected PG client error in pool", err);
});


