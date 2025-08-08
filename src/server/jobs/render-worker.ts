import { getBoss } from './pgboss-client';
import { CanvasRenderer } from '@/server/rendering/canvas-renderer';
import { SupabaseStorageProvider } from '@/server/storage/supabase';
import { createServiceClient } from '@/utils/supabase/service';
import { notifyRenderJobEvent, shutdownPgEvents } from './pg-events';

const CONCURRENCY = Number(process.env.RENDER_CONCURRENCY ?? '2');

let workerRegistered = false;

export async function registerRenderWorker() {
  if (workerRegistered) return;
  const boss = await getBoss();
  // Ensure queue exists
  if (process.env.JOB_DEBUG === '1') {
    try {
      await boss.createQueue('render-video');
      // eslint-disable-next-line no-console
      console.log('[worker] queue ensured: render-video');
    } catch {
      // ignore if not supported / already exists
    }
  }
  await boss.work(
    'render-video',
    { teamSize: Number.isFinite(CONCURRENCY) && CONCURRENCY > 0 ? CONCURRENCY : 2 } as any,
    async (job: any) => {
      const j = Array.isArray(job) ? job[0] : job;
      const data = (j && (j.data ?? j.body)) ?? {};
      const { scene, config, userId, jobId } = data;
      // eslint-disable-next-line no-console
      console.log(`[worker] received job ${jobId} for user ${userId}`);
      const supabase = createServiceClient();
      try {
        if (!jobId || !userId || !scene || !config) {
          throw new Error('Invalid job payload');
        }
        // Idempotency guard: if job already completed or failed, ack and return stored result
        const { data: existing } = await supabase
          .from('render_jobs')
          .select('status, output_url, error')
          .eq('id', jobId)
          .eq('user_id', userId)
          .single();
        if (existing?.status === 'completed' && existing.output_url) {
          // eslint-disable-next-line no-console
          console.log(`[worker] job ${jobId} already completed, skipping`);
          await notifyRenderJobEvent({ jobId, status: 'completed', publicUrl: existing.output_url });
          return { publicUrl: existing.output_url };
        }
        if (existing?.status === 'failed') {
          // eslint-disable-next-line no-console
          console.log(`[worker] job ${jobId} already failed, skipping`);
          await notifyRenderJobEvent({ jobId, status: 'failed', error: existing.error });
          throw new Error(existing.error ?? 'Job previously failed');
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

        // eslint-disable-next-line no-console
        console.log(`[worker] completed job ${jobId} -> ${publicUrl}`);
        await notifyRenderJobEvent({ jobId, status: 'completed', publicUrl });

        return { publicUrl };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // eslint-disable-next-line no-console
        console.error(`[worker] failed job ${jobId}: ${message}`);
        if (jobId && userId) {
          const configuredRetryLimit = Number(process.env.RENDER_JOB_RETRY_LIMIT ?? '5');
          const attempt = Number((j as any)?.retrycount ?? (j as any)?.retryCount ?? 0);
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
                await (await getBoss()).send(deadLetterQueue, { jobId, userId, error: message }, { expireIn: '7 days' } as any);
                // eslint-disable-next-line no-console
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
    // eslint-disable-next-line no-console
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


