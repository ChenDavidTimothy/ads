// src/server/jobs/graphile-queue.ts
import type { JobQueue } from './queue';
import { withPgClient } from 'graphile-worker';
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

export class GraphileQueue<TJob extends { jobId: string }, TResult> implements JobQueue<TJob, TResult> {
  private readonly taskIdentifier: string;

  constructor(options: { taskIdentifier: string }) {
    this.taskIdentifier = options.taskIdentifier;
  }

  async enqueueOnly(job: TJob): Promise<{ jobId: string }> {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is not set');

    await withPgClient(async (client) => {
      await client.query('select graphile_worker.add_job($1, $2, $3)', [
        this.taskIdentifier,
        job,
        { job_key: job.jobId, max_attempts: Number(process.env.RENDER_JOB_RETRY_LIMIT ?? '5') },
      ]);
    }, { connectionString });

    return { jobId: job.jobId };
  }

  async enqueue(job: TJob): Promise<TResult> {
    await this.enqueueOnly(job);
    throw new Error('Synchronous enqueue wait is not supported; use waitForRenderJobEvent');
  }

  async getQueueStats(): Promise<{ pending: number; active: number; completed: number; failed: number }>
  {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is not set');

    return await withPgClient(async (client) => {
      const { rows } = await client.query(
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
      const row = rows[0] ?? {};
      return {
        pending: Number(row.pending ?? 0),
        active: Number(row.active ?? 0),
        completed: Number(row.completed ?? 0),
        failed: Number(row.failed ?? 0),
      };
    }, { connectionString });
  }
}