import { getBoss } from './pgboss-client';
import { CanvasRenderer } from '@/server/rendering/canvas-renderer';
import { SupabaseStorageProvider } from '@/server/storage/supabase';
import { createServiceClient } from '@/utils/supabase/service';
import { notifyRenderJobEvent } from './pg-events';

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
    { teamSize: Number.isFinite(CONCURRENCY) && CONCURRENCY > 0 ? CONCURRENCY : 2, batchSize: 1 },
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
          await supabase
            .from('render_jobs')
            .update({ status: 'failed', error: message, updated_at: new Date().toISOString() })
            .eq('id', jobId)
            .eq('user_id', userId);
          await notifyRenderJobEvent({ jobId, status: 'failed', error: message });
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


