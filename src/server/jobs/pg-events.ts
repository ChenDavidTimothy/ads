import { Client } from 'pg';

let listenerClient: Client | null = null;
let listenerConnected: Promise<void> | null = null;
const handlers: Array<(payload: any) => void> = [];
const CHANNEL = 'render_jobs_events';

async function connectListener(): Promise<void> {
  if (listenerConnected) return listenerConnected;
  const connectionString = process.env.PG_BOSS_DATABASE_URL;
  if (!connectionString) throw new Error('PG_BOSS_DATABASE_URL is not set');
  listenerClient = new Client({ connectionString, ssl: { rejectUnauthorized: false } as any });
  listenerConnected = listenerClient
    .connect()
    .then(async () => {
      listenerClient!.on('error', () => {
        // simple reconnect strategy
        listenerConnected = null;
        listenerClient = null;
        void connectListener().then(() => listen());
      });
      await listen();
    })
    .catch((err) => {
      listenerConnected = null;
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

let publisherClient: Client | null = null;
let publisherConnecting: Promise<void> | null = null;

async function getPublisher(): Promise<Client> {
  if (publisherClient) return publisherClient;
  if (publisherConnecting) {
    await publisherConnecting;
    return publisherClient!;
  }
  const connectionString = process.env.PG_BOSS_DATABASE_URL;
  if (!connectionString) throw new Error('PG_BOSS_DATABASE_URL is not set');
  publisherClient = new Client({ connectionString, ssl: { rejectUnauthorized: false } as any });
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


