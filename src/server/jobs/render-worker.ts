// src/server/jobs/render-worker.ts
import { getWorkerBoss, getWorkerBossHealth } from './worker-pgboss-client';
import { ensureQueues } from './pgboss-client'; // Keep this for queue creation only
import { CanvasRenderer } from '@/server/rendering/canvas-renderer';
import { SupabaseStorageProvider } from '@/server/storage/supabase';
import { createServiceClient } from '@/utils/supabase/service';
import { 
  notifyRenderJobEvent, 
  shutdownPgEvents, 
  listenNewJobEvents, 
  listenRetryJobEvents,
  type NewJobEventPayload,
  type RetryJobEventPayload 
} from './pg-events';
import type { Job } from 'pg-boss';
import type { AnimationScene } from '@/shared/types/scene';
import type { SceneAnimationConfig } from '@/server/rendering/renderer';
import { logger } from '@/lib/logger';

const CONCURRENCY = Number(process.env.RENDER_CONCURRENCY ?? '2');
const QUEUE_NAME = 'render-video';

let workerRegistered = false;
let shutdownRequested = false;
let activeJobs = 0; // Track active jobs for concurrency control
let pollingTimer: NodeJS.Timeout | null = null;

export async function registerRenderWorker(): Promise<void> {
  if (workerRegistered) return;
  
  try {
    logger.info('Initializing event-driven render worker', { 
      concurrency: CONCURRENCY,
      queue: QUEUE_NAME 
    });

    const boss = await getWorkerBoss();
    await ensureQueues(); // Use shared client just for queue creation

    // Subscribe to new job notifications
    await listenNewJobEvents(async (payload: NewJobEventPayload) => {
      if (payload.queueName === QUEUE_NAME && !shutdownRequested) {
        if (process.env.JOB_DEBUG === '1') {
          logger.info('New job notification received', payload);
        }
        // Trigger immediate job processing when notified
        void triggerJobProcessing();
      }
    });

    // Subscribe to retry job notifications  
    await listenRetryJobEvents(async (payload: RetryJobEventPayload) => {
      if (payload.queueName === QUEUE_NAME && !shutdownRequested) {
        if (process.env.JOB_DEBUG === '1') {
          logger.info('Retry job notification received', payload);
        }
        // Trigger immediate job processing when notified
        void triggerJobProcessing();
      }
    });

    // Start periodic job processing (fallback for missed notifications)
    startJobPolling();

    logger.info('Event-driven render worker registered successfully', {
      concurrency: CONCURRENCY,
      subscribedToEvents: ['new_job', 'retry_job']
    });

    workerRegistered = true;
  } catch (error) {
    logger.errorWithStack('Failed to register render worker', error);
    throw error;
  }
}

// Trigger immediate job processing
async function triggerJobProcessing(): Promise<void> {
  if (shutdownRequested || activeJobs >= CONCURRENCY) {
    return; // Skip if shutting down or at capacity
  }

  try {
    const boss = await getWorkerBoss();
    
    // Fetch and process jobs directly
    const jobs = await boss.fetch(QUEUE_NAME, { batchSize: CONCURRENCY - activeJobs });
    
    if (jobs && jobs.length > 0) {
      if (process.env.JOB_DEBUG === '1') {
        logger.info('Fetched jobs for processing', { 
          jobCount: jobs.length,
          activeJobs,
          capacity: CONCURRENCY 
        });
      }
      
      // Process jobs concurrently
      const promises = jobs.map(job => processAndCompleteJob(job));
      await Promise.allSettled(promises);
    }
  } catch (error) {
    logger.errorWithStack('Error in triggerJobProcessing', error);
  }
}

// Start periodic polling as fallback
function startJobPolling(): void {
  if (pollingTimer || shutdownRequested) return;
  
  const pollInterval = Number(process.env.WORKER_POLL_INTERVAL_MS ?? '5000'); // 5 seconds default
  
  pollingTimer = setInterval(() => {
    if (!shutdownRequested) {
      void triggerJobProcessing();
    }
  }, pollInterval);
  
  logger.info('Started job polling', { intervalMs: pollInterval });
}

// Stop polling
function stopJobPolling(): void {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
    logger.info('Stopped job polling');
  }
}

// Process job and complete it in pg-boss
async function processAndCompleteJob(job: Job<RenderJobPayload>): Promise<void> {
  let businessJobId: string | undefined;
  let userId: string | undefined;
  
  try {
    activeJobs++;
    
    // Extract payload from various possible locations
    const payloadCandidate: unknown = job.data ?? (job as unknown as { body?: unknown }).body;
    
    if (process.env.JOB_DEBUG === '1') {
      logger.info('Processing job with fetch pattern', { 
        jobId: job.id,
        hasData: !!job.data,
        payloadType: typeof payloadCandidate
      });
    }

    if (!isRenderJobPayload(payloadCandidate)) {
      logger.error('Invalid job payload structure', { 
        payload: payloadCandidate,
        jobId: job.id
      });
      throw new Error('Invalid job payload structure');
    }
    
    const payload = payloadCandidate;
    businessJobId = payload.jobId;
    userId = payload.userId;

    if (process.env.JOB_DEBUG === '1') {
      logger.info('Processing render job', { 
        pgJobId: job.id,
        businessJobId, 
        userId
      });
    }

    // Mark job as processing in database
    const supabase = createServiceClient();
    await supabase
      .from('render_jobs')
      .update({ 
        status: 'processing', 
        updated_at: new Date().toISOString() 
      })
      .eq('id', businessJobId)
      .eq('user_id', userId);

    // Set up storage and renderer
    const storageProvider = new SupabaseStorageProvider({
      supabaseServiceClient: supabase,
      bucket: 'videos'
    });

    const renderer = new CanvasRenderer({
      storageProvider,
      tempDir: process.env.TEMP_DIR ?? '/tmp'
    });

    // Render the animation
    const result = await renderer.render(payload.scene, payload.config);

    if (!result.outputPath) {
      throw new Error('Renderer did not produce output path');
    }

    // Upload to storage
    const publicUrl = await storageProvider.uploadVideo(
      result.outputPath,
      `renders/${userId}/${businessJobId}.mp4`
    );

    // Mark as completed in database
    await supabase
      .from('render_jobs')
      .update({ 
        status: 'completed', 
        output_url: publicUrl,
        updated_at: new Date().toISOString() 
      })
      .eq('id', businessJobId)
      .eq('user_id', userId);

    // Complete the job in pg-boss
    const boss = await getWorkerBoss();
    await boss.complete(job.id);

    // Notify completion via NOTIFY/LISTEN
    await notifyRenderJobEvent({ 
      jobId: businessJobId, 
      status: 'completed', 
      publicUrl 
    });

    logger.info('Render job completed successfully', { 
      pgJobId: job.id,
      businessJobId, 
      publicUrl 
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.errorWithStack('Render job failed', error, { 
      pgJobId: job.id,
      businessJobId, 
      userId 
    });

    try {
      const boss = await getWorkerBoss();
      
      if (businessJobId && userId) {
        const supabase = createServiceClient();
        
        // Determine if this is the final attempt
        const configuredRetryLimit = Number(process.env.RENDER_JOB_RETRY_LIMIT ?? '5');
        const meta = job as unknown as { retrycount?: unknown; retryCount?: unknown };
        const attempt = typeof meta.retrycount === 'number' ? meta.retrycount : 
                       typeof meta.retryCount === 'number' ? meta.retryCount : 0;
        const isFinalAttempt = attempt + 1 >= (Number.isFinite(configuredRetryLimit) ? configuredRetryLimit : 5);

        if (isFinalAttempt) {
          // Final failure - mark as failed and notify
          await supabase
            .from('render_jobs')
            .update({ 
              status: 'failed', 
              error: errorMessage, 
              updated_at: new Date().toISOString() 
            })
            .eq('id', businessJobId)
            .eq('user_id', userId);

          // Fail the job in pg-boss
          await boss.fail(job.id, new Error(errorMessage));

          await notifyRenderJobEvent({ 
            jobId: businessJobId, 
            status: 'failed', 
            error: errorMessage 
          });

          // Send to dead letter queue if configured
          const deadLetterQueue = process.env.RENDER_DEADLETTER_QUEUE;
          if (deadLetterQueue) {
            try {
              await boss.send(deadLetterQueue, { 
                jobId: businessJobId, 
                userId, 
                error: errorMessage,
                originalJob: job.data 
              });
              logger.warn('Job sent to dead letter queue', { 
                businessJobId, 
                deadLetterQueue 
              });
            } catch (dlqError) {
              logger.errorWithStack('Failed to send job to dead letter queue', dlqError);
            }
          }
        } else {
          // Not final attempt - mark back to queued for UI consistency and fail for retry
          await supabase
            .from('render_jobs')
            .update({ 
              status: 'queued', 
              error: errorMessage, 
              updated_at: new Date().toISOString() 
            })
            .eq('id', businessJobId)
            .eq('user_id', userId);

          // Fail the job in pg-boss for automatic retry
          await boss.fail(job.id, new Error(errorMessage));
        }
      } else {
        // No business job info - just fail the pg-boss job
        await boss.fail(job.id, new Error(errorMessage));
      }
    } catch (cleanupError) {
      logger.errorWithStack('Error during job failure cleanup', cleanupError, {
        originalError: errorMessage,
        pgJobId: job.id,
        businessJobId
      });
    }
  } finally {
    activeJobs--;
  }
}

// Job payload type
type RenderJobPayload = {
  scene: AnimationScene;
  config: SceneAnimationConfig;
  userId: string;
  jobId: string;
};

// Type guard for job payload validation
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

// Get worker status for health checks
export function getWorkerStatus(): {
  registered: boolean;
  activeJobs: number;
  concurrency: number;
  shutdownRequested: boolean;
} {
  return {
    registered: workerRegistered,
    activeJobs,
    concurrency: CONCURRENCY,
    shutdownRequested
  };
}

// Graceful shutdown
export async function shutdownRenderWorker(): Promise<void> {
  shutdownRequested = true;
  
  logger.info('Shutting down render worker', { activeJobs });

  // Stop polling first
  stopJobPolling();

  // Wait for active jobs to complete (with timeout)
  const shutdownTimeout = Number(process.env.WORKER_SHUTDOWN_TIMEOUT_MS ?? '30000');
  const shutdownStart = Date.now();
  
  while (activeJobs > 0 && (Date.now() - shutdownStart) < shutdownTimeout) {
    logger.info('Waiting for active jobs to complete', { 
      activeJobs, 
      remainingMs: shutdownTimeout - (Date.now() - shutdownStart) 
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  if (activeJobs > 0) {
    logger.warn('Shutdown timeout reached with active jobs', { activeJobs });
  }

  try {
    await shutdownPgEvents();
  } catch (error) {
    logger.errorWithStack('Error shutting down pg events', error);
  }

  logger.info('Render worker shutdown complete');
}