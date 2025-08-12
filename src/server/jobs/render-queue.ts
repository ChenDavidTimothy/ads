// src/server/jobs/render-queue.ts
import type { AnimationScene } from "@/shared/types/scene";
import type { SceneAnimationConfig as RendererSceneAnimationConfig } from "@/server/rendering/renderer";
import { ProductionJobQueue } from './production-queue';
import { renderWorker } from './render-worker';
import { logger } from '@/lib/logger';

// Production-ready render queue with comprehensive error handling and monitoring
export interface RenderJobInput {
  scene: AnimationScene;
  config: RendererSceneAnimationConfig;
  userId: string;
  jobId: string;
}

export interface RenderJobResult {
  publicUrl: string;
}

// Production render queue implementation
class ProductionRenderQueue extends ProductionJobQueue<RenderJobInput, RenderJobResult> {
  constructor() {
    super('render-video', {
      fallbackTimeoutMs: Number(process.env.RENDER_JOB_TIMEOUT_MS ?? '900000'), // 15 minutes
      maxRetries: Number(process.env.RENDER_JOB_RETRY_LIMIT ?? '5'),
      retryDelaySeconds: Number(process.env.RENDER_JOB_RETRY_DELAY_SECONDS ?? '30'),
      enableEventDriven: process.env.RENDER_ENABLE_EVENTS !== 'false', // Default to enabled
      fallbackPollingIntervalMs: Number(process.env.RENDER_FALLBACK_POLLING_MS ?? '10000'),
      maxFallbackAttempts: Number(process.env.RENDER_MAX_FALLBACK_ATTEMPTS ?? '6'),
      jobTimeoutSeconds: Number(process.env.RENDER_JOB_EXPIRE_SECONDS ?? '3600'),
    });
  }

  // Additional validation specific to render jobs
  protected validateJob(job: RenderJobInput): void {
    super.validateJob(job);

    // Validate scene
    if (!job.scene || typeof job.scene !== 'object') {
      throw new Error('Valid scene object is required');
    }

    if (!Array.isArray(job.scene.objects)) {
      throw new Error('Scene must contain objects array');
    }

    if (job.scene.objects.length === 0) {
      throw new Error('Scene must contain at least one object');
    }

    // Validate config
    if (!job.config || typeof job.config !== 'object') {
      throw new Error('Valid config object is required');
    }

    const { width, height, fps } = job.config;

    if (typeof width !== 'number' || width <= 0 || width > 3840) {
      throw new Error('Width must be a number between 1 and 3840');
    }

    if (typeof height !== 'number' || height <= 0 || height > 2160) {
      throw new Error('Height must be a number between 1 and 2160');
    }

    if (typeof fps !== 'number' || fps <= 0 || fps > 120) {
      throw new Error('FPS must be a number between 1 and 120');
    }

    // Additional validation for scene complexity to prevent resource exhaustion
    const totalObjects = job.scene.objects.length;
    const maxObjects = Number(process.env.MAX_SCENE_OBJECTS ?? '100');
    
    if (totalObjects > maxObjects) {
      throw new Error(`Scene contains too many objects: ${totalObjects}. Maximum allowed: ${maxObjects}`);
    }

    // Validate scene duration if available
    const duration = job.scene.metadata?.duration;
    if (duration && typeof duration === 'number') {
      const maxDuration = Number(process.env.MAX_SCENE_DURATION_SECONDS ?? '300'); // 5 minutes
      if (duration > maxDuration) {
        throw new Error(`Scene duration too long: ${duration}s. Maximum allowed: ${maxDuration}s`);
      }
    }

    // Validate video dimensions for resource constraints
    const totalPixels = width * height;
    const maxPixels = Number(process.env.MAX_VIDEO_PIXELS ?? '8294400'); // 4K UHD: 3840x2160
    
    if (totalPixels > maxPixels) {
      throw new Error(`Video resolution too high: ${width}x${height} (${totalPixels} pixels). Maximum: ${maxPixels} pixels`);
    }
  }

  // Enhanced sanitization for render jobs
  protected sanitizeJob(job: RenderJobInput): any {
    return {
      jobId: job.jobId,
      userId: job.userId,
      scene: {
        objectCount: job.scene.objects?.length || 0,
        duration: job.scene.metadata?.duration || 'unknown',
        // Don't include full scene data in logs for privacy/size
      },
      config: {
        width: job.config.width,
        height: job.config.height,
        fps: job.config.fps,
        backgroundColor: job.config.backgroundColor || 'default',
      }
    };
  }

  protected sanitizeResult(result: RenderJobResult): any {
    return {
      publicUrl: result.publicUrl ? '[URL_PROVIDED]' : null
    };
  }
}

// Global render queue instance
export const renderQueue = new ProductionRenderQueue();

// Worker readiness management
let workerStartupPromise: Promise<void> | null = null;
let workerStarted = false;

export async function ensureWorkerReady(): Promise<void> {
  if (workerStarted) return;
  
  if (workerStartupPromise) {
    return workerStartupPromise;
  }

  // Check if we're in a dedicated worker process
  const isWorkerProcess = process.argv.includes('./src/server/jobs/worker-entry.ts') || 
                         process.argv.includes('worker-entry.ts') ||
                         process.env.NODE_ENV === 'production';
  
  if (!isWorkerProcess) {
    logger.info('🔄 Skipping render worker startup in non-worker process (Next.js dev server)');
    workerStarted = true; // Mark as started to prevent retries
    return;
  }

  workerStartupPromise = (async () => {
    try {
      logger.info('🚀 Starting render worker for production queue...');
      
      // Start the render worker
      await renderWorker.start();
      
      workerStarted = true;
      logger.info('✅ Render worker started and ready');
      
    } catch (error) {
      workerStartupPromise = null; // Allow retry
      logger.errorWithStack('❌ Failed to start render worker', error);
      throw error;
    }
  })();

  return workerStartupPromise;
}

// Health check and monitoring functions
export function getRenderQueueHealth() {
  return {
    queue: renderQueue.getHealthStatus(),
    worker: renderWorker.getStatus(),
    workerStarted,
  };
}

export function getRenderQueueMetrics() {
  return {
    queue: renderQueue.getMetrics(),
    worker: renderWorker.getStatus(),
  };
}

// Graceful shutdown function
export async function shutdownRenderQueue(): Promise<void> {
  try {
    logger.info('🛑 Shutting down render queue...');
    
    // Stop the worker first
    if (workerStarted) {
      await renderWorker.stop();
      workerStarted = false;
    }
    
    // Reset startup promise
    workerStartupPromise = null;
    
    logger.info('✅ Render queue shut down gracefully');
    
  } catch (error) {
    logger.errorWithStack('❌ Error during render queue shutdown', error);
    throw error;
  }
}

// Setup graceful shutdown handlers
if (typeof process !== 'undefined') {
  const handleShutdown = async (signal: string) => {
    logger.info(`📶 Received ${signal}, shutting down render queue...`);
    try {
      await shutdownRenderQueue();
    } catch (error) {
      logger.errorWithStack('❌ Error during graceful shutdown', error);
    }
  };

  // Only add listeners once
  if (!process.listenerCount('SIGINT')) {
    process.once('SIGINT', () => handleShutdown('SIGINT'));
    process.once('SIGTERM', () => handleShutdown('SIGTERM'));
    process.once('SIGUSR2', () => handleShutdown('SIGUSR2')); // For nodemon
  }
}


