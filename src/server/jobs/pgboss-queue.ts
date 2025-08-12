import type { JobQueue } from './queue';
import { getBoss } from './pgboss-client';
import { 
  listenRenderJobEvents, 
  waitForRenderJobEvent,
  type RenderJobEventPayload 
} from './pg-events';
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
  private readonly fallbackTotalTimeoutMs: number;

  constructor(options: { queueName: string; fallbackTotalTimeoutMs?: number }) {
    this.queueName = options.queueName;
    this.fallbackTotalTimeoutMs = options.fallbackTotalTimeoutMs ?? 15 * 60 * 1000; // 15 min
  }

  private async ensureEventSubscription(): Promise<void> {
    if (eventsSubscribed) return;
    
    await listenRenderJobEvents((payload: RenderJobEventPayload) => {
      const waiter = waiters.get(payload.jobId);
      if (!waiter) return;
      
      // Clean up waiter
      waiters.delete(payload.jobId);
      clearTimeout(waiter.timeout);
      
      // Resolve or reject based on job status
      if (payload.status === 'failed') {
        waiter.reject(new Error(payload.error ?? 'Job failed'));
      } else if (payload.publicUrl) {
        waiter.resolve({ publicUrl: payload.publicUrl });
      } else {
        waiter.reject(new Error('Job completed but no public URL provided'));
      }
    });
    
    eventsSubscribed = true;
    logger.info('PgBossQueue subscribed to render job events');
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

    if (process.env.JOB_DEBUG === '1') {
      logger.info('Enqueueing job', { 
        businessJobId, 
        queueName: this.queueName,
        options 
      });
    }

    await boss.send(this.queueName, payload, options);

    return { jobId: businessJobId };
  }

  // Blocking enqueue: send job and wait for completion
  async enqueue(job: TJob): Promise<TResult> {
    await this.ensureEventSubscription();

    const businessJobId = job.jobId as string | undefined;
    if (!businessJobId) {
      throw new Error('jobId is required to enqueue render job');
    }

    if (process.env.JOB_DEBUG === '1') {
      logger.info('Enqueueing job with wait', { 
        businessJobId, 
        queueName: this.queueName 
      });
    }

    // Enqueue the job first
    await this.enqueueOnly(job);

    // Wait for completion using pure event-driven approach
    return await new Promise<TResult>((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        waiters.delete(businessJobId);
        reject(new Error(`Job timed out after ${this.fallbackTotalTimeoutMs}ms`));
      }, this.fallbackTotalTimeoutMs);

      // Store resolver - expects DefaultQueueResult, cast when resolving
      waiters.set(businessJobId, {
        resolve: (value) => resolve(value as TResult),
        reject,
        timeout,
      });

      if (process.env.JOB_DEBUG === '1') {
        logger.info('Waiting for job completion via events', { businessJobId });
      }
    });
  }

  // Wait for job completion using optimized event system
  async waitForJob(jobId: string, timeoutMs?: number): Promise<TResult> {
    if (process.env.JOB_DEBUG === '1') {
      logger.info('Waiting for existing job', { jobId, timeoutMs });
    }

    const result = await waitForRenderJobEvent({ 
      jobId, 
      timeoutMs: timeoutMs ?? this.fallbackTotalTimeoutMs 
    });

    if (!result) {
      throw new Error(`Job ${jobId} timed out or was not found`);
    }

    if (result.status === 'failed') {
      throw new Error(result.error ?? 'Job failed');
    }

    if (!result.publicUrl) {
      throw new Error('Job completed but no public URL provided');
    }

    return { publicUrl: result.publicUrl } as TResult;
  }

  // Get queue statistics
  async getQueueStats(): Promise<{
    pending: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    const boss = await getBoss();
    
    try {
      const result = await boss.db.query(`
        SELECT 
          COUNT(*) FILTER (WHERE state = 0) as pending,
          COUNT(*) FILTER (WHERE state = 1) as active,
          COUNT(*) FILTER (WHERE state = 2) as completed,
          COUNT(*) FILTER (WHERE state = 3) as failed
        FROM pgboss.job 
        WHERE name = $1
      `, [this.queueName]);
      
      const row = result.rows[0];
      return {
        pending: parseInt(row?.pending ?? '0', 10),
        active: parseInt(row?.active ?? '0', 10),
        completed: parseInt(row?.completed ?? '0', 10),
        failed: parseInt(row?.failed ?? '0', 10)
      };
    } catch (error) {
      logger.errorWithStack('Failed to get queue stats', error);
      return { pending: 0, active: 0, completed: 0, failed: 0 };
    }
  }

  // Cancel a specific job
  async cancelJob(jobId: string): Promise<boolean> {
    const boss = await getBoss();
    
    try {
      const result = await boss.cancel(jobId);
      
      if (process.env.JOB_DEBUG === '1') {
        logger.info('Job cancellation result', { jobId, cancelled: result });
      }
      
      // Clean up any waiters
      const waiter = waiters.get(jobId);
      if (waiter) {
        waiters.delete(jobId);
        clearTimeout(waiter.timeout);
        waiter.reject(new Error('Job was cancelled'));
      }
      
      return result;
    } catch (error) {
      logger.errorWithStack('Failed to cancel job', error, { jobId });
      return false;
    }
  }

  // Clean up waiters (for graceful shutdown)
  async cleanup(): Promise<void> {
    logger.info('Cleaning up PgBossQueue waiters', { activeWaiters: waiters.size });
    
    for (const [jobId, waiter] of waiters.entries()) {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error('Queue is shutting down'));
    }
    
    waiters.clear();
  }
}