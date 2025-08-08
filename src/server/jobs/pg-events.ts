import { Client } from 'pg';
import type { ClientConfig } from 'pg';

// Define proper types for the payload
interface RenderJobEventPayload {
  jobId: string;
  status: 'completed' | 'failed';
  publicUrl?: string;
  error?: string;
}

let listenerClient: Client | null = null;
let listenerConnected: Promise<void> | null = null;
const handlers: Array<(payload: RenderJobEventPayload) => void> = [];
const CHANNEL = 'render_jobs_events';

function createPgClient(): Client {
  const connectionString = process.env.PG_BOSS_DATABASE_URL;
  if (!connectionString) throw new Error('PG_BOSS_DATABASE_URL is not set');

  // Configurable SSL without disabling verification by default
  const sslMode = process.env.PG_SSL; // e.g. 'require'
  const rejectUnauthorizedEnv = process.env.PG_SSL_REJECT_UNAUTHORIZED; // 'true' | 'false'
  const shouldUseSsl = sslMode === 'require' || /sslmode=require/i.test(connectionString);
  const rejectUnauthorized = rejectUnauthorizedEnv
    ? rejectUnauthorizedEnv.toLowerCase() !== 'false'
    : true;

  const clientConfig: ClientConfig = {
    connectionString,
    ssl: shouldUseSsl ? { rejectUnauthorized } : undefined,
  };
  return new Client(clientConfig);
}

let reconnectDelayMs = 1000;
const maxReconnectDelayMs = 30000;

async function connectListener(): Promise<void> {
  if (listenerConnected) return listenerConnected;
  listenerClient = createPgClient();
  listenerConnected = listenerClient
    .connect()
    .then(async () => {
      reconnectDelayMs = 1000;
      listenerClient!.on('error', () => {
        // reconnect with simple exponential backoff
        listenerConnected = null;
        try {
          listenerClient?.removeAllListeners('notification');
          listenerClient?.removeAllListeners('error');
        } catch {
          // ignore cleanup errors
        }
        listenerClient = null;
        setTimeout(() => {
          reconnectDelayMs = Math.min(reconnectDelayMs * 2, maxReconnectDelayMs);
          void connectListener().then(() => listen());
        }, reconnectDelayMs);
      });
      await listen();
    })
    .catch((err) => {
      listenerConnected = null;
      try {
        listenerClient?.end().catch(() => undefined);
      } catch {
        // ignore cleanup errors
      }
      listenerClient = null;
      throw err;
    });
  return listenerConnected;
}

async function listen(): Promise<void> {
  if (!listenerClient) return;
  await listenerClient.query(`LISTEN ${CHANNEL}`);
  listenerClient.on('notification', (msg) => {
    if (msg.channel !== CHANNEL || !msg.payload) return;
    try {
      const payload = JSON.parse(msg.payload) as unknown;
      // Type guard to ensure payload is valid
      if (isValidRenderJobEventPayload(payload)) {
        for (const h of handlers) h(payload);
      }
    } catch {
      // ignore malformed payloads
    }
  });
}

// Type guard function to validate payload
function isValidRenderJobEventPayload(payload: unknown): payload is RenderJobEventPayload {
  if (!payload || typeof payload !== 'object') return false;
  const obj = payload as Record<string, unknown>;
  
  if (typeof obj.jobId !== 'string') return false;
  if (obj.status !== 'completed' && obj.status !== 'failed') return false;
  if (obj.publicUrl !== undefined && typeof obj.publicUrl !== 'string') return false;
  if (obj.error !== undefined && typeof obj.error !== 'string') return false;
  
  return true;
}

export async function listenRenderJobEvents(
  handler: (payload: RenderJobEventPayload) => void
): Promise<void> {
  await connectListener();
  handlers.push(handler);
}

export async function waitForRenderJobEvent(params: {
  jobId: string;
  timeoutMs?: number;
}): Promise<RenderJobEventPayload | null> {
  const { jobId, timeoutMs = 25000 } = params;
  await connectListener();

  return await new Promise((resolve) => {
    let settled = false;
    const handler = (payload: RenderJobEventPayload) => {
      if (settled) return;
      if (!payload || payload.jobId !== jobId) return;
      settled = true;
      // remove handler
      const idx = handlers.indexOf(handler);
      if (idx >= 0) handlers.splice(idx, 1);
      resolve({ jobId: payload.jobId, status: payload.status, publicUrl: payload.publicUrl, error: payload.error });
    };
    handlers.push(handler);
    const t = setTimeout(() => {
      if (settled) return;
      // remove handler on timeout
      const idx = handlers.indexOf(handler);
      if (idx >= 0) handlers.splice(idx, 1);
      settled = true;
      resolve(null);
    }, timeoutMs);
    // In case process is terminating, resolve early
    if (typeof process !== 'undefined') {
      const onExit = () => {
        if (settled) return;
        const idx = handlers.indexOf(handler);
        if (idx >= 0) handlers.splice(idx, 1);
        settled = true;
        clearTimeout(t);
        resolve(null);
      };
      process.once('SIGINT', onExit);
      process.once('SIGTERM', onExit);
    }
  });
}

let publisherClient: Client | null = null;
let publisherConnecting: Promise<void> | null = null;

async function getPublisher(): Promise<Client> {
  if (publisherClient) return publisherClient;
  if (publisherConnecting) {
    await publisherConnecting;
    return publisherClient!;
  }
  publisherClient = createPgClient();
  publisherConnecting = publisherClient.connect().then(() => {
    return;
  });
  await publisherConnecting;
  publisherConnecting = null;
  return publisherClient;
}

export async function notifyRenderJobEvent(payload: RenderJobEventPayload): Promise<void> {
  const client = await getPublisher();
  const text = JSON.stringify(payload);
  // Use parameterized pg_notify to avoid manual string escaping
  await client.query('SELECT pg_notify($1, $2)', [CHANNEL, text]);
}

export async function shutdownPgEvents(): Promise<void> {
  try {
    if (listenerClient) {
      listenerClient.removeAllListeners('notification');
      listenerClient.removeAllListeners('error');
      await listenerClient.end().catch(() => undefined);
    }
  } catch {
    // ignore
  } finally {
    listenerClient = null;
    listenerConnected = null;
  }
  try {
    if (publisherClient) {
      await publisherClient.end().catch(() => undefined);
    }
  } catch {
    // ignore
  } finally {
    publisherClient = null;
    publisherConnecting = null;
  }
}


