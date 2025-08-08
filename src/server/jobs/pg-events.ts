import { Client } from 'pg';

let listenerClient: Client | null = null;
let listenerConnected: Promise<void> | null = null;
const handlers: Array<(payload: any) => void> = [];
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

  const client = new Client({
    connectionString,
    ssl: shouldUseSsl ? { rejectUnauthorized } : undefined,
  } as any);
  return client;
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
          // eslint-disable-next-line no-empty
        } catch {}
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
        // eslint-disable-next-line no-empty
      } catch {}
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
      const payload = JSON.parse(msg.payload);
      for (const h of handlers) h(payload);
    } catch {
      // ignore malformed payloads
    }
  });
}

export async function listenRenderJobEvents(
  handler: (payload: { jobId: string; status: 'completed' | 'failed'; publicUrl?: string; error?: string }) => void
): Promise<void> {
  await connectListener();
  handlers.push(handler);
}

export async function waitForRenderJobEvent(params: {
  jobId: string;
  timeoutMs?: number;
}): Promise<{ status: 'completed' | 'failed'; publicUrl?: string; error?: string } | null> {
  const { jobId, timeoutMs = 25000 } = params;
  await connectListener();

  return await new Promise((resolve) => {
    let settled = false;
    const handler = (payload: any) => {
      if (settled) return;
      if (!payload || payload.jobId !== jobId) return;
      settled = true;
      // remove handler
      const idx = handlers.indexOf(handler);
      if (idx >= 0) handlers.splice(idx, 1);
      resolve({ status: payload.status, publicUrl: payload.publicUrl, error: payload.error });
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

export async function notifyRenderJobEvent(payload: {
  jobId: string;
  status: 'completed' | 'failed';
  publicUrl?: string;
  error?: string;
}): Promise<void> {
  const client = await getPublisher();
  const text = JSON.stringify(payload);
  await client.query(`NOTIFY ${CHANNEL}, '${text.replace(/'/g, "''")}'`);
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


