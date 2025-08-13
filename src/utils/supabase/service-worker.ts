import { createClient } from '@supabase/supabase-js';
import { workerEnv } from '../../server/jobs/env';

export function createServiceClient() {
  const url = workerEnv.NEXT_PUBLIC_SUPABASE_URL! as string;
  const serviceKey = workerEnv.SUPABASE_SERVICE_ROLE_KEY! as string;
  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
