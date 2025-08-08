import type { JobQueue } from './queue';
import { getBoss } from './pgboss-client';
import { createServiceClient } from '@/utils/supabase/service';
import { listenRenderJobEvents } from './pg-events';
import type { SendOptions } from 'pg-boss';

type Waiter<TResult> = {
  resolve: (value: TResult) => void;
  reject: (reason?: unknown) => void;
  timeout: NodeJS.Timeout;
  fallbackTimer?: NodeJS.Timeout;
};

// For this queue we resolve with a URL result
type DefaultQueueResult = { publicUrl: string };
const waiters = new Map<string, Waiter<DefaultQueueResult>>();
let eventsSubscribed = false;

export class PgBossQueue<
  TJob extends { jobId: string; userId: string; scene: unknown; config: unknown },
  TResult extends DefaultQueueResult
> implements JobQueue<TJob, TResult> {
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
        waiter.reject(new Error(error ?? 'Job failed'));
      } else if (publicUrl) {
        waiter.resolve({ publicUrl });
      }
    });
    eventsSubscribed = true;
  }

  // Non-blocking enqueue: send job and return immediately with jobId
  async enqueueOnly(job: TJob): Promise<{ jobId: string }> {
    const boss = await getBoss();

    const businessJobId = job.jobId as string | undefined;
    if (!businessJobId) {
      throw new Error('jobId is required to enqueue render job');
    }

    const retryLimit = Number(process.env.RENDER_JOB_RETRY_LIMIT ?? '5');
    const retryDelaySeconds = Number(process.env.RENDER_JOB_RETRY_DELAY_SECONDS ?? '15');
    const expireMinutes = Number(process.env.RENDER_JOB_EXPIRE_MINUTES ?? '120');
    const expireInSeconds = (Number.isFinite(expireMinutes) && expireMinutes > 0 ? expireMinutes : 120) * 60;

    const payload = {
      scene: job.scene,
      config: job.config,
      userId: job.userId,
      jobId: businessJobId,
    };
    const options: SendOptions = {
      singletonKey: businessJobId,
      retryLimit: Number.isFinite(retryLimit) && retryLimit >= 0 ? retryLimit : 5,
      retryDelay: Number.isFinite(retryDelaySeconds) && retryDelaySeconds >= 0 ? retryDelaySeconds : 15,
      retryBackoff: true,
      expireInSeconds: Number.isFinite(expireInSeconds) && expireInSeconds > 0 ? expireInSeconds : 7200,
    };

    await boss.send(this.queueName, payload, options);

    return { jobId: businessJobId };
  }

  async enqueue(job: TJob): Promise<TResult> {
    await this.ensureEventSubscription();
    const boss = await getBoss();

    const businessJobId = job.jobId as string | undefined;
    if (!businessJobId) {
      throw new Error('jobId is required to enqueue render job');
    }

    if (process.env.JOB_DEBUG === '1') {
      console.log(`[queue] enqueue ${this.queueName} businessJobId=${businessJobId}`);
    }
    const retryLimit = Number(process.env.RENDER_JOB_RETRY_LIMIT ?? '5');
    const retryDelaySeconds = Number(process.env.RENDER_JOB_RETRY_DELAY_SECONDS ?? '15');
    const expireMinutes = Number(process.env.RENDER_JOB_EXPIRE_MINUTES ?? '120');
    const expireInSeconds = (Number.isFinite(expireMinutes) && expireMinutes > 0 ? expireMinutes : 120) * 60;

    const payload = {
      scene: job.scene,
      config: job.config,
      userId: job.userId,
      jobId: businessJobId,
    };
    const options: SendOptions = {
      singletonKey: businessJobId,
      retryLimit: Number.isFinite(retryLimit) && retryLimit >= 0 ? retryLimit : 5,
      retryDelay: Number.isFinite(retryDelaySeconds) && retryDelaySeconds >= 0 ? retryDelaySeconds : 15,
      retryBackoff: true,
      expireInSeconds: Number.isFinite(expireInSeconds) && expireInSeconds > 0 ? expireInSeconds : 7200,
    };
    await boss.send(this.queueName, payload, options);

    return await new Promise<TResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        waiters.delete(businessJobId);
        reject(new Error('Job timed out'));
      }, this.fallbackTotalTimeoutMs);

      // Store resolver which expects DefaultQueueResult; cast when resolving
      waiters.set(businessJobId, {
        resolve: (value) => resolve(value as TResult),
        reject,
        timeout,
      });

      // sparse fallback polling of render_jobs if event missed
      let delay = 5_000; // start at 5s
      const poll = async () => {
        const waiter = waiters.get(businessJobId);
        if (!waiter) return; // already resolved
        try {
          const supabase = createServiceClient();
          type RenderJobRow = { status: 'queued' | 'processing' | 'completed' | 'failed'; output_url: string | null; error: string | null };
          const { data, error } = await supabase
            .from('render_jobs')
            .select('status, output_url, error')
            .eq('id', businessJobId)
            .single();
          if (!error && data) {
            if (process.env.JOB_DEBUG === '1') {
              console.log(`[queue] poll status jobId=${businessJobId} status=${data.status}`);
            }
            const row = data as RenderJobRow;
            if (row.status === 'completed' && row.output_url) {
              waiters.delete(businessJobId);
              clearTimeout(timeout);
              resolve({ publicUrl: row.output_url } as TResult);
              return;
            }
            if (row.status === 'failed') {
              waiters.delete(businessJobId);
              clearTimeout(timeout);
              reject(new Error(row.error ?? 'Job failed'));
              return;
            }
          }
        } catch {
          // ignore and continue backoff
        }
        delay = Math.min(delay * 2, 60_000);
        const w = waiters.get(businessJobId);
        if (!w) return;
        w.fallbackTimer = setTimeout(() => { void poll(); }, delay);
      };
      // schedule first fallback check
      const w = waiters.get(businessJobId);
      if (w) {
        w.fallbackTimer = setTimeout(() => { void poll(); }, delay);
      }
    });
  }
}


