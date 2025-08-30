import { Client } from "pg";
import { pgPool } from "@/server/db/pool";
import { logger } from "@/lib/logger";

// Event types for different notification channels
export interface RenderJobEventPayload {
  jobId: string;
  status: "completed" | "failed";
  publicUrl?: string;
  error?: string;
}

// Type guard for RenderJobEventPayload
function isValidRenderJobEventPayload(
  payload: unknown,
): payload is RenderJobEventPayload {
  if (typeof payload !== "object" || payload === null) return false;
  const obj = payload as Record<string, unknown>;
  return (
    typeof obj.jobId === "string" &&
    (obj.status === "completed" || obj.status === "failed") &&
    (obj.publicUrl === undefined || typeof obj.publicUrl === "string") &&
    (obj.error === undefined || typeof obj.error === "string")
  );
}

// Notification channels
const RENDER_COMPLETION_CHANNEL = "render_job_events";

// Handler types
type RenderJobEventHandler = (payload: RenderJobEventPayload) => void;

// Global state for event system
let listenerClient: Client | null = null;
let listenerConnected: Promise<void> | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let isShuttingDown = false;
let pingTimer: NodeJS.Timeout | null = null;

// Event handlers
const renderJobHandlers: RenderJobEventHandler[] = [];

// Connection management
function createPgClient(): Client {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  return new Client({ connectionString });
}

// Robust connection with automatic reconnection
async function connectListener(): Promise<void> {
  if (listenerConnected) return listenerConnected;
  if (isShuttingDown) throw new Error("Event system is shutting down");

  listenerConnected = (async () => {
    try {
      if (listenerClient) {
        try {
          await listenerClient.end();
        } catch {
          // ignore cleanup errors
        }
      }
      if (pingTimer) {
        clearInterval(pingTimer);
        pingTimer = null;
      }

      listenerClient = createPgClient();

      // Enhanced error handling for production reliability
      listenerClient.on("error", (err) => {
        logger.errorWithStack("PostgreSQL listener connection error", err);
        scheduleReconnect();
      });

      listenerClient.on("end", () => {
        if (!isShuttingDown) {
          logger.warn("PostgreSQL listener connection ended unexpectedly");
          scheduleReconnect();
        }
      });

      listenerClient.on("notice", (notice) => {
        if (process.env.PG_EVENTS_DEBUG === "1") {
          logger.info("PostgreSQL notice", { notice: notice.message });
        }
      });

      await listenerClient.connect();

      // Set up notification channels
      await listenerClient.query(`LISTEN ${RENDER_COMPLETION_CHANNEL}`);

      // Set up notification handler
      listenerClient.on("notification", (msg) => {
        try {
          if (!msg.payload) return;

          const payload = JSON.parse(msg.payload) as unknown;

          switch (msg.channel) {
            case RENDER_COMPLETION_CHANNEL:
              if (isValidRenderJobEventPayload(payload)) {
                handleRenderJobEvent(payload);
              } else {
                logger.warn("Invalid render job event payload received", {
                  payload,
                });
              }
              break;
            default:
              if (process.env.PG_EVENTS_DEBUG === "1") {
                logger.info("Unknown notification channel", {
                  channel: msg.channel,
                });
              }
          }
        } catch (error) {
          logger.errorWithStack("Error processing notification", error, {
            channel: msg.channel,
            payload: msg.payload,
          });
        }
      });

      // Periodic ping to keep connection alive and detect silent drops
      pingTimer = setInterval(() => {
        if (!listenerClient) return;
        // Use void to explicitly ignore the promise
        void (async () => {
          try {
            await listenerClient.query("SELECT 1");
          } catch (err) {
            logger.errorWithStack("PostgreSQL listener ping failed", err);
            scheduleReconnect();
          }
        })();
      }, 15000);

      logger.info("PostgreSQL event listener connected and subscribed", {
        channels: [RENDER_COMPLETION_CHANNEL],
      });
    } catch (error) {
      listenerConnected = null;
      logger.errorWithStack("Failed to connect PostgreSQL listener", error);
      scheduleReconnect();
      throw error;
    }
  })();

  return listenerConnected;
}

// Exponential backoff reconnection with jitter
function scheduleReconnect(): void {
  if (isShuttingDown || reconnectTimer) return;

  listenerConnected = null;

  const baseDelay = Math.min(
    1000 * Math.pow(2, Math.floor(Math.random() * 5)),
    30000,
  );
  const jitter = Math.random() * 1000; // Add up to 1s jitter
  const delay = baseDelay + jitter;

  logger.info("Scheduling PostgreSQL listener reconnection", {
    delayMs: Math.round(delay),
  });

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (!isShuttingDown) {
      connectListener().catch((error) => {
        logger.errorWithStack("Reconnection failed", error);
      });
    }
  }, delay);
}

// Event handlers
function handleRenderJobEvent(payload: RenderJobEventPayload): void {
  if (process.env.PG_EVENTS_DEBUG === "1") {
    logger.info("Render job event received", { payload });
  }

  for (const handler of renderJobHandlers) {
    try {
      handler(payload);
    } catch (error) {
      logger.errorWithStack("Error in render job event handler", error, {
        payload,
      });
    }
  }
}

// Public API for subscribing to render job completion events
export async function listenRenderJobEvents(
  handler: RenderJobEventHandler,
): Promise<void> {
  await connectListener();
  renderJobHandlers.push(handler);
}

// Wait for specific render job completion with timeout
export async function waitForRenderJobEvent(params: {
  jobId: string;
  timeoutMs?: number;
}): Promise<RenderJobEventPayload | null> {
  const { jobId, timeoutMs = 25000 } = params;
  await connectListener();

  return await new Promise((resolve) => {
    let settled = false;

    const handler = (payload: RenderJobEventPayload) => {
      if (settled || payload.jobId !== jobId) return;
      settled = true;

      const idx = renderJobHandlers.indexOf(handler);
      if (idx >= 0) renderJobHandlers.splice(idx, 1);

      resolve(payload);
    };

    renderJobHandlers.push(handler);

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;

      const idx = renderJobHandlers.indexOf(handler);
      if (idx >= 0) renderJobHandlers.splice(idx, 1);

      resolve(null);
    }, timeoutMs);

    if (typeof process !== "undefined") {
      const onExit = () => {
        if (settled) return;
        settled = true;

        const idx = renderJobHandlers.indexOf(handler);
        if (idx >= 0) renderJobHandlers.splice(idx, 1);

        clearTimeout(timeout);
        resolve(null);
      };

      process.once("SIGINT", onExit);
      process.once("SIGTERM", onExit);
    }
  });
}

// Publish render job completion events
export async function notifyRenderJobEvent(
  payload: RenderJobEventPayload,
): Promise<void> {
  try {
    const text = JSON.stringify(payload);
    await pgPool.query("SELECT pg_notify($1, $2)", [
      RENDER_COMPLETION_CHANNEL,
      text,
    ]);

    if (process.env.PG_EVENTS_DEBUG === "1") {
      logger.info("Render job event published", { payload });
    }
  } catch (error) {
    logger.errorWithStack("Failed to publish render job event", error, {
      payload,
    });
    throw error;
  }
}

// Health check - verify listener connection
export async function checkEventSystemHealth(): Promise<{
  listenerConnected: boolean;
  subscribedChannels: string[];
}> {
  const health = {
    listenerConnected: false,
    subscribedChannels: [] as string[],
  };

  try {
    if (listenerClient && listenerConnected) {
      await listenerClient.query("SELECT 1");
      health.listenerConnected = true;
      health.subscribedChannels = [RENDER_COMPLETION_CHANNEL];
    }
  } catch {
    health.listenerConnected = false;
  }

  return health;
}

// Graceful shutdown
export async function shutdownPgEvents(): Promise<void> {
  isShuttingDown = true;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }

  renderJobHandlers.length = 0;

  try {
    if (listenerClient) {
      listenerClient.removeAllListeners();
      await listenerClient.end();
    }
  } catch (error) {
    logger.errorWithStack("Error closing listener client", error);
  } finally {
    listenerClient = null;
    listenerConnected = null;
  }

  logger.info("PostgreSQL event system shutdown complete");
}
