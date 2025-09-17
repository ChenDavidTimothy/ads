import { createClient } from '@supabase/supabase-js';
import { workerEnv } from '../../server/jobs/env';

// Type-safe Node.js environment detection
interface NodeProcess {
  versions?: {
    node?: string;
  };
}

// Type-safe globalThis with fetch
interface GlobalWithFetch {
  fetch: typeof fetch;
}

// Extended RequestInit for Node.js duplex support
interface NodeRequestInit extends RequestInit {
  duplex?: 'half' | 'full';
}

function createFetchWithDuplex(): typeof fetch {
  const globalWithFetch = globalThis as unknown as GlobalWithFetch;
  const baseFetch: typeof fetch = globalWithFetch.fetch.bind(globalThis);

  // Type-safe Node.js detection
  const nodeProcess = (typeof process !== 'undefined' ? process : null) as NodeProcess | null;
  const isNode = typeof process !== 'undefined' && nodeProcess?.versions?.node !== undefined;

  const fetchWithDuplex: typeof fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (isNode && init?.body && !('duplex' in init)) {
      const nodeInit: NodeRequestInit = { ...init, duplex: 'half' };
      return baseFetch(input, nodeInit);
    }
    return baseFetch(input, init);
  };

  return fetchWithDuplex;
}

export function createServiceClient() {
  const url = workerEnv.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = workerEnv.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: createFetchWithDuplex(),
    },
  });
}
