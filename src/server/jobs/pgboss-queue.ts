import type { JobQueue } from './queue';
import { getBoss } from './pgboss-client';
import { createServiceClient } from '@/utils/supabase/service';
import { listenRenderJobEvents } from './pg-events';

type Waiter<TResult> = {
  resolve: (value: TResult) => void;
  reject: (reason?: unknown) => void;
  timeout: NodeJS.Timeout;
  fallbackTimer?: NodeJS.Timeout;
};

const waiters = new Map<string, Waiter<any>>();
let eventsSubscribed = false;

export class PgBossQueue<TJob, TResult> implements JobQueue<TJob, TResult> {
  private readonly queueName: string;
  private readonly fallbackTotalTimeoutMs: number;

  constructor(options: { queueName: string; fallbackTotalTimeoutMs?: number }) {
    this.queueName = options.queueName;
    this.fallbackTotalTimeoutMs = options.fallbackTotalTimeoutMs ?? 15 * 60 * 1000; // 15 min
  }

  private async ensureEventSubscription(): Promise<void> {
    if (eventsSubscribed) return;
    await listenRenderJobEvents(({ jobId, status, publicUrl, error }) => {
      const waiter = waiters.get(jobId);
      if (!waiter) return;
      waiters.delete(jobId);
      clearTimeout(waiter.timeout);
      if (waiter.fallbackTimer) clearTimeout(waiter.fallbackTimer);
      if (status === 'failed') {
        waiter.reject(new Error(error || 'Job failed'));
      } else {
        waiter.resolve({ publicUrl } as TResult);
      }
    });
    eventsSubscribed = true;
  }

  async enqueue(job: TJob & { jobId?: string; userId?: string }): Promise<TResult> {
    await this.ensureEventSubscription();
    const boss = await getBoss();

    const businessJobId = (job as any)?.jobId as string | undefined;
    if (!businessJobId) {
      throw new Error('jobId is required to enqueue render job');
    }

    // eslint-disable-next-line no-console
    console.log(`[queue] enqueue ${this.queueName} businessJobId=${businessJobId}`);
    await boss.send(this.queueName, job as any, {
      singletonKey: businessJobId,
    } as any);

    return await new Promise<TResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        waiters.delete(businessJobId);
        reject(new Error('Job timed out'));
      }, this.fallbackTotalTimeoutMs);

      waiters.set(businessJobId, { resolve, reject, timeout });

      // sparse fallback polling of render_jobs if event missed
      let delay = 5_000; // start at 5s
      const poll = async () => {
        const waiter = waiters.get(businessJobId);
        if (!waiter) return; // already resolved
        try {
          const supabase = createServiceClient();
          const { data, error } = await supabase
            .from('render_jobs')
            .select('status, output_url, error')
            .eq('id', businessJobId)
            .single();
          if (!error && data) {
            // eslint-disable-next-line no-console
            console.log(`[queue] poll status jobId=${businessJobId} status=${data.status}`);
            if (data.status === 'completed' && data.output_url) {
              waiters.delete(businessJobId);
              clearTimeout(timeout);
              resolve({ publicUrl: data.output_url } as TResult);
              return;
            }
            if (data.status === 'failed') {
              waiters.delete(businessJobId);
              clearTimeout(timeout);
              reject(new Error(data.error || 'Job failed'));
              return;
            }
          }
        } catch {
          // ignore and continue backoff
        }
        delay = Math.min(delay * 2, 60_000);
        const w = waiters.get(businessJobId);
        if (!w) return;
        w.fallbackTimer = setTimeout(poll, delay);
      };
      // schedule first fallback check
      (waiters.get(businessJobId) as Waiter<TResult>).fallbackTimer = setTimeout(poll, delay);
    });
  }
}


