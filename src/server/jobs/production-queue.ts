import { jobManager, type JobOptions, type JobResult } from './job-manager';
import { waitForRenderJobEvent, listenRenderJobEvents } from './pg-events';
import { logger } from '@/lib/logger';
import { createServiceClient } from '@/utils/supabase/service';
import type { JobQueue } from './queue';

// Production-ready job queue with comprehensive error handling and observability
export class ProductionJobQueue<TJob extends JobPayload, TResult extends JobResult> 
  implements JobQueue<TJob, TResult> {
  
  private readonly queueName: string;
  private readonly config: QueueConfig;
  private isInitialized = false;
  private eventListenerRegistered = false;
  private circuitBreaker: QueueCircuitBreaker;
  private metrics: QueueMetrics;

  constructor(queueName: string, config: Partial<QueueConfig> = {}) {
    this.queueName = queueName;
    this.config = {
      fallbackTimeoutMs: 15 * 60 * 1000, // 15 minutes
      maxRetries: 5,
      retryDelaySeconds: 30,
      enableEventDriven: true,
      fallbackPollingIntervalMs: 10000, // 10 seconds
      maxFallbackAttempts: 6, // 1 minute total with exponential backoff
      jobTimeoutSeconds: 3600, // 1 hour
      ...config
    };
    
    this.circuitBreaker = new QueueCircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 60000
    });
    
    this.metrics = new QueueMetrics(queueName);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      logger.info('🚀 Initializing production job queue', {
        queueName: this.queueName,
        config: this.config
      });

      // Ensure job manager is started
      await jobManager.start();

      // Setup event-driven notifications if enabled
      if (this.config.enableEventDriven) {
        await this.setupEventListener();
      }

      this.isInitialized = true;
      this.metrics.recordInitialization();

      logger.info('✅ Production job queue initialized', {
        queueName: this.queueName
      });

    } catch (error) {
      this.metrics.recordInitializationFailure();
      logger.errorWithStack('❌ Failed to initialize job queue', error, {
        queueName: this.queueName
      });
      throw error;
    }
  }

  async enqueue(job: TJob): Promise<TResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const jobId = job.jobId;

    try {
      logger.info('📋 Enqueueing job', {
        jobId,
        queueName: this.queueName,
        userId: job.userId
      });

      // Validate job before processing
      this.validateJob(job);

      // Check for existing job status first (idempotency)
      const existingResult = await this.checkExistingJob(job);
      if (existingResult) {
        this.metrics.recordJobSkipped();
        return existingResult;
      }

      // Create job record in database
      await this.createJobRecord(job);

      // Enqueue with circuit breaker protection
      const result = await this.circuitBreaker.execute(async () => {
        return await this.processJobWithFallback(job);
      });

      const duration = Date.now() - startTime;
      this.metrics.recordJobSuccess(duration);

      logger.info('✅ Job completed successfully', {
        jobId,
        queueName: this.queueName,
        duration,
        result: this.sanitizeResult(result)
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.metrics.recordJobFailure(duration);

      logger.errorWithStack('❌ Job failed', error, {
        jobId,
        queueName: this.queueName,
        duration,
        job: this.sanitizeJob(job)
      });

      // Update job status in database
      await this.markJobAsFailed(job, error);
      throw error;
    }
  }

  async enqueueOnly(job: TJob): Promise<{ jobId: string }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const jobId = job.jobId;

    try {
      logger.info('📤 Enqueueing job (fire-and-forget)', {
        jobId,
        queueName: this.queueName,
        userId: job.userId
      });

      // Validate job before processing
      this.validateJob(job);

      // Create job record in database
      await this.createJobRecord(job);

      // Enqueue job without waiting for result
      const jobOptions: JobOptions = {
        jobId,
        singletonKey: jobId,
        retryLimit: this.config.maxRetries,
        retryDelay: this.config.retryDelaySeconds,
        retryBackoff: true,
        expireInSeconds: this.config.jobTimeoutSeconds,
      };

      await jobManager.enqueueJob(this.queueName, job, jobOptions);

      const duration = Date.now() - startTime;
      this.metrics.recordJobEnqueued(duration);

      logger.info('📨 Job enqueued successfully', {
        jobId,
        queueName: this.queueName,
        duration
      });

      return { jobId };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.metrics.recordEnqueueFailure(duration);

      logger.errorWithStack('❌ Failed to enqueue job', error, {
        jobId,
        queueName: this.queueName,
        job: this.sanitizeJob(job)
      });

      throw error;
    }
  }

  getMetrics(): QueueMetricsSnapshot {
    return this.metrics.getSnapshot();
  }

  getHealthStatus(): QueueHealthStatus {
    return {
      isInitialized: this.isInitialized,
      queueName: this.queueName,
      circuitBreakerState: this.circuitBreaker.getState(),
      metrics: this.metrics.getSnapshot(),
      eventListenerActive: this.eventListenerRegistered
    };
  }

  private async processJobWithFallback(job: TJob): Promise<TResult> {
    const jobId = job.jobId;

    // Enqueue the job first
    const jobOptions: JobOptions = {
      jobId,
      singletonKey: jobId,
      retryLimit: this.config.maxRetries,
      retryDelay: this.config.retryDelaySeconds,
      retryBackoff: true,
      expireInSeconds: this.config.jobTimeoutSeconds,
    };

    await jobManager.enqueueJob(this.queueName, job, jobOptions);

    // Use event-driven approach if available, with fallback to polling
    if (this.config.enableEventDriven) {
      return await this.waitForJobWithEventAndFallback(jobId);
    } else {
      return await this.waitForJobWithPolling(jobId);
    }
  }

  private async waitForJobWithEventAndFallback(jobId: string): Promise<TResult> {
    const eventPromise = this.waitForJobEvent(jobId);
    const fallbackPromise = this.fallbackPolling(jobId);
    const timeoutPromise = this.createTimeoutPromise(jobId);

    try {
      const result = await Promise.race([eventPromise, fallbackPromise, timeoutPromise]);
      return result;
    } catch (error) {
      logger.errorWithStack('❌ Job processing failed with both event and fallback', error, {
        jobId
      });
      throw error;
    }
  }

  private async waitForJobEvent(jobId: string): Promise<TResult> {
    return new Promise((resolve, reject) => {
      let resolved = false;
      
      const eventPromise = waitForRenderJobEvent({
        jobId,
        timeoutMs: this.config.fallbackTimeoutMs
      });

      eventPromise.then((event) => {
        if (resolved) return;
        resolved = true;

        if (!event) {
          reject(new Error('Event wait timed out'));
          return;
        }

        if (event.status === 'completed' && event.publicUrl) {
          resolve({ publicUrl: event.publicUrl } as TResult);
        } else if (event.status === 'failed') {
          reject(new Error(event.error || 'Job failed'));
        } else {
          reject(new Error('Unexpected job status'));
        }
      }).catch((error) => {
        if (!resolved) {
          resolved = true;
          reject(error);
        }
      });
    });
  }

  private async fallbackPolling(jobId: string): Promise<TResult> {
    let attempt = 0;
    let delay = this.config.fallbackPollingIntervalMs;

    while (attempt < this.config.maxFallbackAttempts) {
      await new Promise(resolve => setTimeout(resolve, delay));
      
      try {
        const result = await this.checkJobStatus(jobId);
        if (result) {
          logger.info('✅ Job completed via fallback polling', {
            jobId,
            attempt: attempt + 1
          });
          return result;
        }
      } catch (error) {
        logger.warn('⚠️ Fallback polling attempt failed', {
          jobId,
          attempt: attempt + 1,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      attempt++;
      delay = Math.min(delay * 1.5, 60000); // Exponential backoff, max 1 minute
    }

    throw new Error(`Job polling failed after ${this.config.maxFallbackAttempts} attempts`);
  }

  private async waitForJobWithPolling(jobId: string): Promise<TResult> {
    return await this.fallbackPolling(jobId);
  }

  private createTimeoutPromise(jobId: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Job timed out after ${this.config.fallbackTimeoutMs}ms`));
      }, this.config.fallbackTimeoutMs);
    });
  }

  private async checkJobStatus(jobId: string): Promise<TResult | null> {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase
      .from('render_jobs')
      .select('status, output_url, error')
      .eq('id', jobId)
      .single();

    if (error || !data) return null;

    if (data.status === 'completed' && data.output_url) {
      return { publicUrl: data.output_url } as TResult;
    }

    if (data.status === 'failed') {
      throw new Error(data.error || 'Job failed');
    }

    return null; // Job still processing
  }

  private async setupEventListener(): Promise<void> {
    if (this.eventListenerRegistered) return;

    try {
      await listenRenderJobEvents((event) => {
        logger.debug('📡 Received job event', {
          jobId: event.jobId,
          status: event.status,
          queueName: this.queueName
        });
        // Events are handled by the waitForRenderJobEvent function
      });

      this.eventListenerRegistered = true;
      logger.info('📡 Event listener registered', {
        queueName: this.queueName
      });

    } catch (error) {
      logger.errorWithStack('❌ Failed to setup event listener', error, {
        queueName: this.queueName
      });
      // Don't throw - fallback to polling will work
    }
  }

  private validateJob(job: TJob): void {
    if (!job.jobId || typeof job.jobId !== 'string') {
      throw new Error('Valid jobId is required');
    }

    if (!job.userId || typeof job.userId !== 'string') {
      throw new Error('Valid userId is required');
    }

    // Additional validation based on job type can be added here
  }

  private async checkExistingJob(job: TJob): Promise<TResult | null> {
    const supabase = createServiceClient();
    
    const { data } = await supabase
      .from('render_jobs')
      .select('status, output_url, error')
      .eq('id', job.jobId)
      .eq('user_id', job.userId)
      .single();

    if (data?.status === 'completed' && data.output_url) {
      logger.info('🔄 Job already completed, returning cached result', {
        jobId: job.jobId,
        userId: job.userId
      });
      return { publicUrl: data.output_url } as TResult;
    }

    if (data?.status === 'failed') {
      throw new Error(data.error || 'Job previously failed');
    }

    return null;
  }

  private async createJobRecord(job: TJob): Promise<void> {
    const supabase = createServiceClient();
    
    const { error } = await supabase
      .from('render_jobs')
      .upsert({
        id: job.jobId,
        user_id: job.userId,
        status: 'queued',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id',
        ignoreDuplicates: false
      });

    if (error) {
      throw new Error(`Failed to create job record: ${error.message}`);
    }
  }

  private async markJobAsFailed(job: TJob, error: unknown): Promise<void> {
    try {
      const supabase = createServiceClient();
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      await supabase
        .from('render_jobs')
        .update({
          status: 'failed',
          error: errorMessage,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.jobId)
        .eq('user_id', job.userId);

    } catch (updateError) {
      logger.errorWithStack('❌ Failed to update job status to failed', updateError, {
        jobId: job.jobId
      });
      // Don't throw - original error is more important
    }
  }

  private sanitizeJob(job: TJob): any {
    // Remove sensitive data from logs
    const sanitized = { ...job };
    // Add any sensitive field removal logic here
    return sanitized;
  }

  private sanitizeResult(result: TResult): any {
    // Remove sensitive data from logs
    return result;
  }
}

// Supporting classes

class QueueCircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(private config: {
    failureThreshold: number;
    resetTimeoutMs: number;
  }) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.config.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Queue circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.config.failureThreshold) {
      this.state = 'OPEN';
      logger.warn('🚨 Queue circuit breaker opened', {
        failures: this.failures,
        threshold: this.config.failureThreshold
      });
    }
  }

  getState(): string {
    return this.state;
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }
}

class QueueMetrics {
  private metrics = {
    initializationTime: 0,
    totalJobsProcessed: 0,
    totalJobsSucceeded: 0,
    totalJobsFailed: 0,
    totalJobsSkipped: 0,
    totalJobsEnqueued: 0,
    totalEnqueueFailures: 0,
    avgProcessingDuration: 0,
    avgEnqueueDuration: 0,
  };

  constructor(private queueName: string) {}

  recordInitialization(): void {
    this.metrics.initializationTime = Date.now();
  }

  recordInitializationFailure(): void {
    // Could send to external metrics system
  }

  recordJobSuccess(duration: number): void {
    this.metrics.totalJobsProcessed++;
    this.metrics.totalJobsSucceeded++;
    this.updateAverage('avgProcessingDuration', duration, this.metrics.totalJobsProcessed);
  }

  recordJobFailure(duration: number): void {
    this.metrics.totalJobsProcessed++;
    this.metrics.totalJobsFailed++;
    this.updateAverage('avgProcessingDuration', duration, this.metrics.totalJobsProcessed);
  }

  recordJobSkipped(): void {
    this.metrics.totalJobsSkipped++;
  }

  recordJobEnqueued(duration: number): void {
    this.metrics.totalJobsEnqueued++;
    this.updateAverage('avgEnqueueDuration', duration, this.metrics.totalJobsEnqueued);
  }

  recordEnqueueFailure(duration: number): void {
    this.metrics.totalEnqueueFailures++;
  }

  getSnapshot(): QueueMetricsSnapshot {
    return {
      ...this.metrics,
      queueName: this.queueName,
      uptime: this.metrics.initializationTime ? Date.now() - this.metrics.initializationTime : 0,
      successRate: this.metrics.totalJobsProcessed > 0 
        ? this.metrics.totalJobsSucceeded / this.metrics.totalJobsProcessed 
        : 0
    };
  }

  private updateAverage(field: keyof typeof this.metrics, newValue: number, count: number): void {
    const current = this.metrics[field] as number;
    (this.metrics as any)[field] = ((current * (count - 1)) + newValue) / count;
  }
}

// Type definitions
interface JobPayload {
  jobId: string;
  userId: string;
}

interface QueueConfig {
  fallbackTimeoutMs: number;
  maxRetries: number;
  retryDelaySeconds: number;
  enableEventDriven: boolean;
  fallbackPollingIntervalMs: number;
  maxFallbackAttempts: number;
  jobTimeoutSeconds: number;
}

export interface QueueMetricsSnapshot {
  queueName: string;
  uptime: number;
  totalJobsProcessed: number;
  totalJobsSucceeded: number;
  totalJobsFailed: number;
  totalJobsSkipped: number;
  totalJobsEnqueued: number;
  totalEnqueueFailures: number;
  avgProcessingDuration: number;
  avgEnqueueDuration: number;
  successRate: number;
}

export interface QueueHealthStatus {
  isInitialized: boolean;
  queueName: string;
  circuitBreakerState: string;
  metrics: QueueMetricsSnapshot;
  eventListenerActive: boolean;
}