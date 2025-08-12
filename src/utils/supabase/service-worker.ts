import { createClient } from '@supabase/supabase-js';
import { workerEnv } from '../../server/jobs/env';

export function createServiceClient() {
  const url = workerEnv.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = workerEnv.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
