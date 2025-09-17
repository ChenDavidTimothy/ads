// src/server/jobs/graphile-queue.ts
import type { JobQueue } from './queue';
import { pgPool } from '@/server/db/pool';
import { logger } from '@/lib/logger';
import type { AnimationScene } from '@/shared/types/scene';
import type { SceneAnimationConfig } from '@/server/rendering/renderer';

export interface RenderJobInput {
  scene: AnimationScene;
  config: SceneAnimationConfig;
  userId: string;
  jobId: string;
}

export interface RenderJobResult {
  publicUrl: string;
}

// Define proper interface for queue stats row
interface QueueStatsRow {
  pending?: string | number;
  active?: string | number;
  completed?: string | number;
  failed?: string | number;
}

// Type guard for queue stats
function isValidQueueStatsRow(row: unknown): row is QueueStatsRow {
  return typeof row === 'object' && row !== null;
}

export class GraphileQueue<TJob extends { jobId: string; jobKey?: string }, TResult>
  implements JobQueue<TJob, TResult>
{
  private readonly taskIdentifier: string;

  constructor(options: { taskIdentifier: string }) {
    this.taskIdentifier = options.taskIdentifier;
  }

  async enqueueOnly(job: TJob): Promise<{ jobId: string }> {
    const maxAttempts = Number(process.env.RENDER_JOB_RETRY_LIMIT ?? '5');
    const dedupeKey = job.jobKey ?? job.jobId;

    await withTransientPgRetry(async () => {
      await pgPool.query('select graphile_worker.add_job($1, $2, $3)', [
        this.taskIdentifier,
        job,
        {
          job_key: dedupeKey,
          max_attempts: maxAttempts,
        },
      ]);
    });

    // Best-effort wake (Graphile Worker already listens internally)
    void (async () => {
      try {
        await pgPool.query("select pg_notify('graphile_worker:jobs', '')");
      } catch (err) {
        logger.warn('Graphile Worker wake notify failed (best-effort)', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();

    return { jobId: job.jobId };
  }

  async enqueue(job: TJob): Promise<TResult> {
    await this.enqueueOnly(job);
    throw new Error('Synchronous enqueue wait is not supported; use waitForRenderJobEvent');
  }

  async getQueueStats(): Promise<{
    pending: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    const { rows } = await withTransientPgRetry(async () => {
      return await pgPool.query(
        `select
           count(*) filter (where r.status in ('created','retry')) as pending,
           count(*) filter (where r.status = 'active') as active,
           count(*) filter (where r.status = 'complete') as completed,
           count(*) filter (where r.status = 'failed') as failed
         from graphile_worker.jobs j
         join graphile_worker.job_queues q on j.queue_name = q.queue_name
         join graphile_worker.job_run_stats r on r.job_id = j.id
         where j.task_identifier = $1`,
        [this.taskIdentifier]
      );
    });

    const row: unknown = rows[0];
    if (!isValidQueueStatsRow(row)) {
      return { pending: 0, active: 0, completed: 0, failed: 0 };
    }

    return {
      pending: Number(row.pending ?? 0),
      active: Number(row.active ?? 0),
      completed: Number(row.completed ?? 0),
      failed: Number(row.failed ?? 0),
    };
  }
}

// Minimal transient retry for connection drops; avoid for non-idempotent ops
async function withTransientPgRetry<T>(fn: () => Promise<T>): Promise<T> {
  const transientPatterns = [
    /Connection terminated unexpectedly/i,
    /ECONNRESET/i,
    /57P01/, // admin_shutdown
  ];
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const message = String((error as Error)?.message ?? error);
      const isTransient = transientPatterns.some((re) => re.test(message));
      if (!isTransient || attempt === 3) throw error;
      const backoffMs = 250 * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
  throw new Error('unreachable');
}
