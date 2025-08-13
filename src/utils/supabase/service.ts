import { createClient } from '@supabase/supabase-js';

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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    // Ensure Node stream uploads work (duplex is required by undici when body is a stream)
    global: {
      fetch: createFetchWithDuplex() as any,
    } as any,
  });
}


