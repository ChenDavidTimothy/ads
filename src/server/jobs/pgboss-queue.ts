import type { JobQueue } from './queue';
import { getBoss } from './pgboss-client';
import { createServiceClient } from '@/utils/supabase/service';
import { listenRenderJobEvents } from './pg-events';
import { jobWatcher } from './job-watcher';
import type { SendOptions } from 'pg-boss';
import { logger } from '@/lib/logger';

type Waiter<TResult> = {
  resolve: (value: TResult) => void;
  reject: (reason?: unknown) => void;
  timeout: NodeJS.Timeout;
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
  private readonly eventTimeoutMs: number;

  constructor(options: { queueName: string; eventTimeoutMs?: number }) {
    this.queueName = options.queueName;
    this.eventTimeoutMs = options.eventTimeoutMs ?? 15 * 60 * 1000; // 15 min
  }

  private async ensureEventSubscription(): Promise<void> {
    if (eventsSubscribed) return;
    
    // Start the job watcher for instant job processing
    await jobWatcher.start();
    
    // Subscribe to render job completion events
    await listenRenderJobEvents(({ jobId, status, publicUrl, error }) => {
      const waiter = waiters.get(jobId);
      if (!waiter) return;
      
      waiters.delete(jobId);
      clearTimeout(waiter.timeout);
      
      if (status === 'failed') {
        waiter.reject(new Error(error ?? 'Job failed'));
      } else if (publicUrl) {
        waiter.resolve({ publicUrl });
      }
    });
    
    eventsSubscribed = true;
    logger.info('✅ Event-driven job processing initialized');
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
    
    logger.info('📋 Job enqueued for event-driven processing', {
      jobId: businessJobId,
      queueName: this.queueName
    });

    return { jobId: businessJobId };
  }

  async enqueue(job: TJob): Promise<TResult> {
    await this.ensureEventSubscription();

    const businessJobId = job.jobId as string | undefined;
    if (!businessJobId) {
      throw new Error('jobId is required to enqueue render job');
    }

    if (process.env.JOB_DEBUG === '1') {
      console.log(`[queue] enqueue ${this.queueName} businessJobId=${businessJobId}`);
    }

    // Enqueue the job first
    await this.enqueueOnly(job);

    // Wait for completion via events only (no polling fallback)
    return await new Promise<TResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        waiters.delete(businessJobId);
        reject(new Error(`Job timed out after ${this.eventTimeoutMs}ms`));
      }, this.eventTimeoutMs);

      waiters.set(businessJobId, {
        resolve: (value) => resolve(value as TResult),
        reject,
        timeout,
      });
      
      logger.debug('⏳ Waiting for job completion via LISTEN/NOTIFY events', {
        jobId: businessJobId,
        timeoutMs: this.eventTimeoutMs
      });
    });
  }
}


