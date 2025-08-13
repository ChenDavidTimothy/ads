import { createClient } from '@supabase/supabase-js';
import { workerEnv } from '../../server/jobs/env';

function createFetchWithDuplex(): typeof fetch {
  const baseFetch: typeof fetch = (globalThis as any).fetch.bind(globalThis);
  const isNode = typeof process !== 'undefined' && !!(process as any).versions?.node;

  const fetchWithDuplex: typeof fetch = (input: any, init?: any) => {
    if (isNode && init && init.body && typeof init.duplex === 'undefined') {
      return baseFetch(input, { ...init, duplex: 'half' as any });
    }
    return baseFetch(input, init);
  };

  return fetchWithDuplex;
}

export function createServiceClient() {
  const url = workerEnv.NEXT_PUBLIC_SUPABASE_URL! as string;
  const serviceKey = workerEnv.SUPABASE_SERVICE_ROLE_KEY! as string;
  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: createFetchWithDuplex() as any,
    } as any,
  });
}
