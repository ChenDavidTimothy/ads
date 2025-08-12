import { jobManager, type JobHandler } from './job-manager';
import { CanvasRenderer } from '@/server/rendering/canvas-renderer';
import { SupabaseStorageProvider } from '@/server/storage/supabase';
import { createServiceClient } from '@/utils/supabase/service';
import { notifyRenderJobEvent, shutdownPgEvents } from './pg-events';
import { logger } from '@/lib/logger';
import type { AnimationScene } from '@/shared/types/scene';
import type { SceneAnimationConfig } from '@/server/rendering/renderer';

const QUEUE_NAME = 'render-video';

// Production-ready render worker with comprehensive error handling
export class RenderWorker {
  private isRegistered = false;
  private isShuttingDown = false;
  private activeJobs = new Set<string>();
  private readonly config = {
    concurrency: Number(process.env.RENDER_CONCURRENCY ?? '1'),
    teamConcurrency: Number(process.env.RENDER_TEAM_CONCURRENCY ?? '1'),
    maxRetries: Number(process.env.RENDER_JOB_RETRY_LIMIT ?? '5'),
    retryDelaySeconds: Number(process.env.RENDER_JOB_RETRY_DELAY_SECONDS ?? '15'),
    jobTimeoutMinutes: Number(process.env.RENDER_JOB_TIMEOUT_MINUTES ?? '60'),
  };

  async start(): Promise<void> {
    if (this.isRegistered) {
      logger.warn('🔄 Render worker already registered');
      return;
    }

    try {
      logger.info('🎬 Starting production render worker...', {
        config: this.config
      });

      // Ensure job manager is started
      await jobManager.start();

      // Register the worker with production-ready handler
      await jobManager.registerWorker(
        QUEUE_NAME,
        this.createProductionJobHandler(),
        {
          teamSize: this.config.concurrency,
          teamConcurrency: this.config.teamConcurrency,
        }
      );

      this.isRegistered = true;
      
      logger.info('✅ Production render worker started successfully', {
        queueName: QUEUE_NAME,
        config: this.config
      });

    } catch (error) {
      logger.errorWithStack('❌ Failed to start render worker', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRegistered || this.isShuttingDown) return;
    
    this.isShuttingDown = true;
    logger.info('🛑 Gracefully shutting down render worker...');

    try {
      // Wait for active jobs to complete (with timeout)
      await this.waitForActiveJobsToComplete(30000); // 30 second timeout
      
      // Shutdown pg events
      await shutdownPgEvents();
      
      this.isRegistered = false;
      logger.info('✅ Render worker shut down gracefully');
      
    } catch (error) {
      logger.errorWithStack('❌ Error during render worker shutdown', error);
      throw error;
    } finally {
      this.isShuttingDown = false;
    }
  }

  getStatus(): RenderWorkerStatus {
    return {
      isRegistered: this.isRegistered,
      isShuttingDown: this.isShuttingDown,
      activeJobCount: this.activeJobs.size,
      activeJobIds: Array.from(this.activeJobs),
      config: this.config
    };
  }

  private createProductionJobHandler(): JobHandler<RenderJobPayload> {
    return async (job) => {
      const startTime = Date.now();
      const { jobId, userId, scene, config } = job.data;
      const pgJobId = job.id;

      // Track active job
      this.activeJobs.add(jobId);

      try {
        logger.info('🎬 Starting render job', {
          jobId,
          userId,
          pgJobId,
          attemptNumber: (job as any).retrycount || 0,
          scene: {
            objects: scene?.objects?.length || 0,
            duration: scene?.metadata?.duration || 'unknown'
          },
          config: {
            width: config?.width,
            height: config?.height,
            fps: config?.fps
          }
        });

        // Validate job payload
        this.validateJobPayload(job.data);

        // Check if we're shutting down
        if (this.isShuttingDown) {
          throw new Error('Worker is shutting down, rejecting new work');
        }

        // Execute the render job with comprehensive error handling
        const result = await this.executeRenderJob(job.data);

        const duration = Date.now() - startTime;
        logger.info('✅ Render job completed successfully', {
          jobId,
          userId,
          duration,
          result: {
            publicUrl: result.publicUrl
          }
        });

        return result;

      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        logger.errorWithStack('❌ Render job failed', error, {
          jobId,
          userId,
          pgJobId,
          duration,
          attemptNumber: (job as any).retrycount || 0
        });

        // Handle final attempt failure
        await this.handleJobFailure(job, errorMessage);
        
        throw error;
        
      } finally {
        // Remove from active jobs tracking
        this.activeJobs.delete(jobId);
      }
    };
  }

  private async executeRenderJob(payload: RenderJobPayload): Promise<RenderJobResult> {
    const { jobId, userId, scene, config } = payload;
    const supabase = createServiceClient();

    // Idempotency check: verify job hasn't already been completed
    const { data: existingJob } = await supabase
      .from('render_jobs')
      .select('status, output_url, error')
      .eq('id', jobId)
      .eq('user_id', userId)
      .single();

    if (existingJob?.status === 'completed' && existingJob.output_url) {
      logger.info('🔄 Job already completed, returning cached result', {
        jobId,
        userId,
        outputUrl: existingJob.output_url
      });
      
      await notifyRenderJobEvent({
        jobId,
        status: 'completed',
        publicUrl: existingJob.output_url
      });
      
      return { publicUrl: existingJob.output_url };
    }

    if (existingJob?.status === 'failed') {
      throw new Error(existingJob.error || 'Job previously failed');
    }

    // Update job status to processing
    await supabase
      .from('render_jobs')
      .update({
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .eq('user_id', userId);

    // Execute the actual rendering with timeout protection
    const renderPromise = this.performRendering(userId, scene, config);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Render job timed out after ${this.config.jobTimeoutMinutes} minutes`));
      }, this.config.jobTimeoutMinutes * 60 * 1000);
    });

    const { publicUrl } = await Promise.race([renderPromise, timeoutPromise]);

    // Update job status to completed
    await supabase
      .from('render_jobs')
      .update({
        status: 'completed',
        output_url: publicUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .eq('user_id', userId);

    // Notify completion
    await notifyRenderJobEvent({
      jobId,
      status: 'completed',
      publicUrl
    });

    return { publicUrl };
  }

  private async performRendering(
    userId: string,
    scene: AnimationScene,
    config: SceneAnimationConfig
  ): Promise<{ publicUrl: string }> {
    // Initialize storage and renderer with error handling
    const storage = new SupabaseStorageProvider(userId);
    const renderer = new CanvasRenderer(storage);

    // Add rendering validation
    this.validateRenderingInputs(scene, config);

    // Perform the actual rendering
    return await renderer.render(scene, config);
  }

  private validateJobPayload(payload: RenderJobPayload): void {
    if (!payload) {
      throw new Error('Job payload is required');
    }

    const { jobId, userId, scene, config } = payload;

    if (!jobId || typeof jobId !== 'string') {
      throw new Error('Valid jobId is required');
    }

    if (!userId || typeof userId !== 'string') {
      throw new Error('Valid userId is required');
    }

    if (!scene || typeof scene !== 'object') {
      throw new Error('Valid scene object is required');
    }

    if (!config || typeof config !== 'object') {
      throw new Error('Valid config object is required');
    }

    // Validate scene structure
    if (!Array.isArray(scene.objects)) {
      throw new Error('Scene must contain objects array');
    }

    // Validate config structure
    const requiredConfigFields = ['width', 'height', 'fps'];
    for (const field of requiredConfigFields) {
      if (typeof (config as any)[field] !== 'number') {
        throw new Error(`Config field '${field}' must be a number`);
      }
    }
  }

  private validateRenderingInputs(scene: AnimationScene, config: SceneAnimationConfig): void {
    // Validate scene dimensions
    if (scene.objects.length === 0) {
      throw new Error('Scene must contain at least one object');
    }

    // Validate config constraints
    if (config.width <= 0 || config.width > 3840) {
      throw new Error('Width must be between 1 and 3840 pixels');
    }

    if (config.height <= 0 || config.height > 2160) {
      throw new Error('Height must be between 1 and 2160 pixels');
    }

    if (config.fps <= 0 || config.fps > 120) {
      throw new Error('FPS must be between 1 and 120');
    }
  }

  private async handleJobFailure(job: any, errorMessage: string): Promise<void> {
    const { jobId, userId } = job.data;
    const attemptNumber = (job as any).retrycount || 0;
    const isFinalAttempt = attemptNumber + 1 >= this.config.maxRetries;

    const supabase = createServiceClient();

    if (isFinalAttempt) {
      // Mark job as permanently failed
      await supabase
        .from('render_jobs')
        .update({
          status: 'failed',
          error: errorMessage,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId)
        .eq('user_id', userId);

      // Notify failure
      await notifyRenderJobEvent({
        jobId,
        status: 'failed',
        error: errorMessage
      });

      // Send to dead letter queue if configured
      const deadLetterQueue = process.env.RENDER_DEADLETTER_QUEUE;
      if (deadLetterQueue) {
        try {
          await jobManager.enqueueJob(deadLetterQueue, {
            originalJobId: jobId,
            userId,
            error: errorMessage,
            failedAt: new Date().toISOString()
          });
          
          logger.warn('💀 Job sent to dead letter queue', {
            jobId,
            deadLetterQueue,
            error: errorMessage
          });
          
        } catch (dlqError) {
          logger.errorWithStack('❌ Failed to send job to dead letter queue', dlqError);
        }
      }
    } else {
      // Mark for retry
      await supabase
        .from('render_jobs')
        .update({
          status: 'queued',
          error: errorMessage,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId)
        .eq('user_id', userId);

      logger.info('🔄 Job marked for retry', {
        jobId,
        attemptNumber: attemptNumber + 1,
        maxRetries: this.config.maxRetries
      });
    }
  }

  private async waitForActiveJobsToComplete(timeoutMs: number): Promise<void> {
    const startTime = Date.now();
    
    while (this.activeJobs.size > 0 && (Date.now() - startTime) < timeoutMs) {
      logger.info('⏳ Waiting for active jobs to complete', {
        activeJobCount: this.activeJobs.size,
        activeJobIds: Array.from(this.activeJobs)
      });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (this.activeJobs.size > 0) {
      logger.warn('⚠️ Some jobs still active after timeout', {
        activeJobCount: this.activeJobs.size,
        activeJobIds: Array.from(this.activeJobs)
      });
    }
  }
}

// Type definitions
interface RenderJobPayload {
  jobId: string;
  userId: string;
  scene: AnimationScene;
  config: SceneAnimationConfig;
}

interface RenderJobResult {
  publicUrl: string;
}

interface RenderWorkerStatus {
  isRegistered: boolean;
  isShuttingDown: boolean;
  activeJobCount: number;
  activeJobIds: string[];
  config: {
    concurrency: number;
    teamConcurrency: number;
    maxRetries: number;
    retryDelaySeconds: number;
    jobTimeoutMinutes: number;
  };
}

// Global instance for the application
export const renderWorker = new RenderWorker();

// Legacy functions for backward compatibility
export async function registerRenderWorker(): Promise<void> {
  return renderWorker.start();
}

export async function shutdownRenderWorker(): Promise<void> {
  return renderWorker.stop();
}


