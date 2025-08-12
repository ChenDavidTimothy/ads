import { getBoss } from './pgboss-client';
import { CanvasRenderer } from '@/server/rendering/canvas-renderer';
import { SupabaseStorageProvider } from '@/server/storage/supabase';
import { createServiceClient } from '@/utils/supabase/service';
import { notifyRenderJobEvent, shutdownPgEvents } from './pg-events';
import type { Job } from 'pg-boss';
import type { AnimationScene } from '@/shared/types/scene';
import type { SceneAnimationConfig } from '@/server/rendering/renderer';

const CONCURRENCY = Number(process.env.RENDER_CONCURRENCY ?? '1');

let workerRegistered = false;

export async function registerRenderWorker() {
  if (workerRegistered) return;
  const boss = await getBoss();
  // Ensure queue exists
  if (process.env.JOB_DEBUG === '1') {
    try {
      await boss.createQueue('render-video');
      console.log('[worker] queue ensured: render-video');
    } catch {
      // ignore if not supported / already exists
    }
  }
  type RenderJobPayload = {
    scene: AnimationScene;
    config: SceneAnimationConfig;
    userId: string;
    jobId: string;
  };

  function isRenderJobPayload(value: unknown): value is RenderJobPayload {
    if (!value || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    const cfg = v.config as Record<string, unknown> | undefined;
    return (
      typeof v.userId === 'string' &&
      typeof v.jobId === 'string' &&
      typeof v.scene === 'object' && v.scene !== null &&
      cfg !== undefined &&
      typeof cfg.width === 'number' &&
      typeof cfg.height === 'number' &&
      typeof cfg.fps === 'number'
    );
  }

  const workOptions = {
    teamSize: Number.isFinite(CONCURRENCY) && CONCURRENCY > 0 ? CONCURRENCY : 1, // Changed default from 2 to 1
    teamConcurrency: 1, // Limit to 1 concurrent job per worker to reduce database load
    includeMetadata: true as const,
  };

  await boss.work<RenderJobPayload>(
    'render-video',
    workOptions,
    async (job: Job<RenderJobPayload> | Job<RenderJobPayload>[]) => {
      const j = Array.isArray(job) ? job[0] : job;
      const payloadCandidate: unknown = j
        ? (j.data as RenderJobPayload | undefined) ?? (j as unknown as { body?: unknown }).body
        : undefined;

      if (!isRenderJobPayload(payloadCandidate)) {
        throw new Error('Invalid job payload');
      }
      const { scene, config, userId, jobId } = payloadCandidate;

      console.log(`[worker] received job ${jobId} for user ${userId}`);
      const supabase = createServiceClient();
      try {
        // Idempotency guard: if job already completed or failed, ack and return stored result
        const { data: existing } = await supabase
          .from('render_jobs')
          .select('status, output_url, error')
          .eq('id', jobId)
          .eq('user_id', userId)
          .single();
        if (existing?.status === 'completed' && typeof existing.output_url === 'string') {
          console.log(`[worker] job ${jobId} already completed, skipping`);
          await notifyRenderJobEvent({ jobId, status: 'completed', publicUrl: existing.output_url });
          return { publicUrl: existing.output_url };
        }
        if (existing?.status === 'failed') {
          console.log(`[worker] job ${jobId} already failed, skipping`);
          const previousError = typeof existing.error === 'string' ? existing.error : undefined;
          await notifyRenderJobEvent({ jobId, status: 'failed', error: previousError });
          throw new Error(previousError ?? 'Job previously failed');
        }
        await supabase
          .from('render_jobs')
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('id', jobId)
          .eq('user_id', userId);

        const storage = new SupabaseStorageProvider(userId);
        const renderer = new CanvasRenderer(storage);
        const { publicUrl } = await renderer.render(scene, config);

        await supabase
          .from('render_jobs')
          .update({ status: 'completed', output_url: publicUrl, updated_at: new Date().toISOString() })
          .eq('id', jobId)
          .eq('user_id', userId);

        console.log(`[worker] completed job ${jobId} -> ${publicUrl}`);
        await notifyRenderJobEvent({ jobId, status: 'completed', publicUrl });

        return { publicUrl };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[worker] failed job ${jobId}: ${message}`);
        if (jobId && userId) {
          const configuredRetryLimit = Number(process.env.RENDER_JOB_RETRY_LIMIT ?? '5');
          const meta = j as unknown as { retrycount?: unknown; retryCount?: unknown };
          const attempt = typeof meta.retrycount === 'number' ? meta.retrycount : typeof meta.retryCount === 'number' ? meta.retryCount : 0;
          const isFinalAttempt = attempt + 1 >= (Number.isFinite(configuredRetryLimit) ? configuredRetryLimit : 5);
          if (isFinalAttempt) {
            await supabase
              .from('render_jobs')
              .update({ status: 'failed', error: message, updated_at: new Date().toISOString() })
              .eq('id', jobId)
              .eq('user_id', userId);
            await notifyRenderJobEvent({ jobId, status: 'failed', error: message });
            // DLQ pattern: mirror failed job into dedicated table/queue if configured
            const deadLetterQueue = process.env.RENDER_DEADLETTER_QUEUE;
            if (deadLetterQueue) {
              try {
                await (await getBoss()).send(deadLetterQueue, { jobId, userId, error: message });
                console.warn(`[worker] sent job ${jobId} to DLQ ${deadLetterQueue}`);
              } catch {
                // ignore DLQ failures
              }
            }
          } else {
            // mark back to queued to reflect retry in UI
            await supabase
              .from('render_jobs')
              .update({ status: 'queued', error: message, updated_at: new Date().toISOString() })
              .eq('id', jobId)
              .eq('user_id', userId);
          }
        }
        throw err;
      }
    }
  );
  if (process.env.JOB_DEBUG === '1') {
    console.log('[worker] registered for queue: render-video');
  }
  workerRegistered = true;
}

export async function shutdownRenderWorker(): Promise<void> {
  try {
    await shutdownPgEvents();
  } catch {
    // ignore
  }
}


