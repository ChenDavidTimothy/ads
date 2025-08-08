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
  await boss.work(
    'render-video',
    { teamSize: Number.isFinite(CONCURRENCY) && CONCURRENCY > 0 ? CONCURRENCY : 2 },
    async (job: any) => {
      const { scene, config, userId, jobId } = job.data ?? {};
      // eslint-disable-next-line no-console
      console.log(`[worker] received job ${jobId} for user ${userId}`);
      const supabase = createServiceClient();
      try {
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
        await supabase
          .from('render_jobs')
          .update({ status: 'failed', error: message, updated_at: new Date().toISOString() })
          .eq('id', jobId)
          .eq('user_id', userId);
        await notifyRenderJobEvent({ jobId, status: 'failed', error: message });
        throw err;
      }
    }
  );
  workerRegistered = true;
}


