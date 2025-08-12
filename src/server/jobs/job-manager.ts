import PgBoss from 'pg-boss';
import { logger } from '@/lib/logger';
import { createServiceClient } from '@/utils/supabase/service';
import type { Database } from '@/types/supabase';

// Production-ready job manager with comprehensive error handling and observability
export class JobManager {
  private boss: PgBoss | null = null;
  private isStarted = false;
  private isShuttingDown = false;
  private connectionPool: Map<string, any> = new Map();
  private circuitBreaker: CircuitBreaker;
  private metrics: JobMetrics;
  private healthCheck: HealthChecker;
  
  // Configuration with production defaults - using getter to read at runtime
  private get config() {
    return {
      connectionString: process.env.PG_BOSS_DATABASE_URL!,
      // Optimized for production scalability
      newJobCheckIntervalSeconds: Number(process.env.PG_BOSS_POLLING_INTERVAL ?? '30'),
      maintenanceIntervalSeconds: Number(process.env.PG_BOSS_MAINTENANCE_INTERVAL ?? '600'),
      monitorStateIntervalSeconds: Number(process.env.PG_BOSS_MONITOR_INTERVAL ?? '300'),
      
      // Robust error handling
      deleteAfterDays: Number(process.env.PG_BOSS_DELETE_AFTER_DAYS ?? '7'),
      archiveCompletedAfterSeconds: Number(process.env.PG_BOSS_ARCHIVE_AFTER ?? '3600'),
      
      // Connection optimization
      max: Number(process.env.PG_BOSS_MAX_CONNECTIONS ?? '10'),
      connectionTimeoutMillis: Number(process.env.PG_BOSS_CONNECTION_TIMEOUT ?? '30000'),
      idleTimeoutMillis: Number(process.env.PG_BOSS_IDLE_TIMEOUT ?? '300000'),
      
      // Retry and reliability
      retryLimit: Number(process.env.PG_BOSS_RETRY_LIMIT ?? '5'),
      retryDelay: Number(process.env.PG_BOSS_RETRY_DELAY ?? '30'),
      retryBackoff: true,
      
      // Monitoring and observability
      noSupervisor: false,
      noScheduling: false,
      schema: process.env.PG_BOSS_SCHEMA ?? 'pgboss',
    };
  }

  constructor() {
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeoutMs: 60000,
      monitoringPeriodMs: 10000
    });
    this.metrics = new JobMetrics();
    this.healthCheck = new HealthChecker(this);
    
    // Graceful shutdown handling
    this.setupGracefulShutdown();
  }

  async start(): Promise<void> {
    if (this.isStarted) return;
    
    try {
      logger.info('🚀 Starting production job manager...');
      
      // Validate configuration
      this.validateConfiguration();
      
      // Initialize pg-boss with production settings
      this.boss = new PgBoss(this.config);
      
      // Setup comprehensive error handling
      this.setupErrorHandling();
      
      // Start the boss
      await this.boss.start();
      
      // Setup health monitoring
      await this.healthCheck.start();
      
      this.isStarted = true;
      this.metrics.recordStartup();
      
      logger.info('✅ Production job manager started successfully', {
        config: this.sanitizeConfig(),
        metrics: this.metrics.getSnapshot()
      });
      
    } catch (error) {
      this.metrics.recordStartupFailure();
      logger.errorWithStack('❌ Failed to start job manager', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isStarted || this.isShuttingDown) return;
    
    this.isShuttingDown = true;
    logger.info('🛑 Gracefully shutting down job manager...');
    
    try {
      // Stop health checks first
      await this.healthCheck.stop();
      
      // Stop accepting new jobs
      if (this.boss) {
        await this.boss.stop();
      }
      
      // Close connection pools
      this.connectionPool.clear();
      
      this.isStarted = false;
      this.metrics.recordShutdown();
      
      logger.info('✅ Job manager shut down gracefully');
      
    } catch (error) {
      logger.errorWithStack('❌ Error during shutdown', error);
      throw error;
    } finally {
      this.isShuttingDown = false;
    }
  }

  async enqueueJob<T = any>(
    queueName: string, 
    payload: T, 
    options: JobOptions = {}
  ): Promise<JobResult> {
    if (!this.isStarted || this.isShuttingDown) {
      throw new Error('Job manager is not ready');
    }

    const startTime = Date.now();
    const jobId = options.jobId || this.generateJobId();
    
    try {
      // Circuit breaker protection
      await this.circuitBreaker.execute(async () => {
        if (!this.boss) throw new Error('Job manager not initialized');
        
        const jobOptions: PgBoss.SendOptions = {
          ...options,
          singletonKey: options.singletonKey || jobId,
          retryLimit: options.retryLimit ?? this.config.retryLimit,
          retryDelay: options.retryDelay ?? this.config.retryDelay,
          retryBackoff: options.retryBackoff ?? true,
          expireInSeconds: options.expireInSeconds ?? 7200,
          priority: options.priority ?? 0,
        };

        // Debug: Log what we're sending to pgBoss
        logger.info('🔍 DEBUG: Sending job to pgBoss', {
          queueName,
          jobId,
          payloadExists: !!payload,
          payloadKeys: payload && typeof payload === 'object' ? Object.keys(payload) : [],
          payload: JSON.stringify(payload, null, 2),
          jobOptions
        });

        await this.boss.send(queueName, payload, jobOptions);
      });
      
      this.metrics.recordJobEnqueued(queueName, Date.now() - startTime);
      
      logger.info('📋 Job enqueued successfully', {
        jobId,
        queueName,
        duration: Date.now() - startTime
      });
      
      return { jobId, queueName, status: 'enqueued' };
      
    } catch (error) {
      this.metrics.recordJobEnqueueFailure(queueName);
      logger.errorWithStack('❌ Failed to enqueue job', error, {
        jobId,
        queueName,
        payload: this.sanitizePayload(payload)
      });
      throw error;
    }
  }

  async registerWorker<T = any>(
    queueName: string,
    handler: JobHandler<T>,
    options: WorkerOptions = {}
  ): Promise<void> {
    if (!this.boss) throw new Error('Job manager not initialized');
    
    const workerOptions: PgBoss.WorkOptions = {
      teamSize: options.teamSize ?? 1,
      teamConcurrency: options.teamConcurrency ?? 1,
      includeMetadata: true,
      ...options
    };

    const wrappedHandler = this.wrapHandler(queueName, handler);
    
    await this.boss.work(queueName, workerOptions, wrappedHandler);
    
    logger.info('👷 Worker registered successfully', {
      queueName,
      options: workerOptions
    });
  }

  getHealthStatus(): HealthStatus {
    return this.healthCheck.getStatus();
  }

  getMetrics(): JobMetricsSnapshot {
    return this.metrics.getSnapshot();
  }

  private validateConfiguration(): void {
    if (!this.config.connectionString) {
      throw new Error('PG_BOSS_DATABASE_URL is required');
    }
    
    // Validate numeric configurations
    const numericConfigs = [
      'newJobCheckIntervalSeconds',
      'maintenanceIntervalSeconds',
      'monitorStateIntervalSeconds'
    ];
    
    for (const config of numericConfigs) {
      const value = (this.config as any)[config];
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`Invalid configuration: ${config} must be a positive number`);
      }
    }
  }

  private setupErrorHandling(): void {
    if (!this.boss) return;
    
    this.boss.on('error', (error) => {
      this.metrics.recordSystemError();
      logger.errorWithStack('🔥 PgBoss system error', error);
      
      // Trigger circuit breaker if needed
      this.circuitBreaker.recordFailure();
    });

    this.boss.on('wip', (jobs) => {
      this.metrics.recordActiveJobs(jobs.length);
    });
  }

  private wrapHandler<T>(queueName: string, handler: JobHandler<T>) {
    return async (job: PgBoss.Job<T>) => {
      const startTime = Date.now();
      const jobId = job.id;
      
      try {
        logger.info('🔄 Processing job', {
          jobId,
          queueName,
          attemptNumber: (job as any).retrycount || 0
        });
        
        const result = await handler(job);
        
        const duration = Date.now() - startTime;
        this.metrics.recordJobCompleted(queueName, duration);
        
        logger.info('✅ Job completed successfully', {
          jobId,
          queueName,
          duration
        });
        
        return result;
        
      } catch (error) {
        const duration = Date.now() - startTime;
        this.metrics.recordJobFailed(queueName, duration);
        
        logger.errorWithStack('❌ Job failed', error, {
          jobId,
          queueName,
          duration,
          attemptNumber: (job as any).retrycount || 0
        });
        
        throw error;
      }
    };
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`📶 Received ${signal}, initiating graceful shutdown...`);
      try {
        await this.stop();
        process.exit(0);
      } catch (error) {
        logger.errorWithStack('❌ Error during graceful shutdown', error);
        process.exit(1);
      }
    };

    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGUSR2', () => shutdown('SIGUSR2')); // For nodemon
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeConfig() {
    const { connectionString, ...safeConfig } = this.config;
    return {
      ...safeConfig,
      connectionString: connectionString ? '[REDACTED]' : undefined
    };
  }

  private sanitizePayload(payload: any): any {
    // Remove sensitive data from logs
    if (typeof payload === 'object' && payload !== null) {
      const sanitized = { ...payload };
      // Remove common sensitive fields
      delete sanitized.password;
      delete sanitized.token;
      delete sanitized.secret;
      delete sanitized.apiKey;
      return sanitized;
    }
    return payload;
  }
}

// Supporting classes for production features

class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(private config: {
    failureThreshold: number;
    resetTimeoutMs: number;
    monitoringPeriodMs: number;
  }) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.config.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
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
      logger.warn('🚨 Circuit breaker opened due to failures', {
        failures: this.failures,
        threshold: this.config.failureThreshold
      });
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }
}

class JobMetrics {
  private metrics = {
    startupTime: 0,
    totalJobsEnqueued: 0,
    totalJobsCompleted: 0,
    totalJobsFailed: 0,
    totalEnqueueFailures: 0,
    totalSystemErrors: 0,
    activeJobs: 0,
    queueStats: new Map<string, QueueStats>(),
  };

  recordStartup(): void {
    this.metrics.startupTime = Date.now();
  }

  recordStartupFailure(): void {
    // Could record startup failures to external metrics
  }

  recordShutdown(): void {
    // Could record shutdown metrics
  }

  recordJobEnqueued(queueName: string, duration: number): void {
    this.metrics.totalJobsEnqueued++;
    this.updateQueueStats(queueName, { enqueued: 1, enqueueDuration: duration });
  }

  recordJobEnqueueFailure(queueName: string): void {
    this.metrics.totalEnqueueFailures++;
    this.updateQueueStats(queueName, { enqueueFailures: 1 });
  }

  recordJobCompleted(queueName: string, duration: number): void {
    this.metrics.totalJobsCompleted++;
    this.updateQueueStats(queueName, { completed: 1, processingDuration: duration });
  }

  recordJobFailed(queueName: string, duration: number): void {
    this.metrics.totalJobsFailed++;
    this.updateQueueStats(queueName, { failed: 1, processingDuration: duration });
  }

  recordSystemError(): void {
    this.metrics.totalSystemErrors++;
  }

  recordActiveJobs(count: number): void {
    this.metrics.activeJobs = count;
  }

  getSnapshot(): JobMetricsSnapshot {
    return {
      ...this.metrics,
      uptime: this.metrics.startupTime ? Date.now() - this.metrics.startupTime : 0,
      queueStats: Object.fromEntries(this.metrics.queueStats)
    };
  }

  private updateQueueStats(queueName: string, updates: Partial<QueueStats>): void {
    const existing = this.metrics.queueStats.get(queueName) || {
      enqueued: 0,
      completed: 0,
      failed: 0,
      enqueueFailures: 0,
      avgEnqueueDuration: 0,
      avgProcessingDuration: 0
    };

    const updated = { ...existing };
    
    if (updates.enqueued) updated.enqueued += updates.enqueued;
    if (updates.completed) updated.completed += updates.completed;
    if (updates.failed) updated.failed += updates.failed;
    if (updates.enqueueFailures) updated.enqueueFailures += updates.enqueueFailures;
    
    // Update averages
    if (updates.enqueueDuration) {
      updated.avgEnqueueDuration = this.updateAverage(
        updated.avgEnqueueDuration,
        updates.enqueueDuration,
        updated.enqueued
      );
    }
    
    if (updates.processingDuration) {
      updated.avgProcessingDuration = this.updateAverage(
        updated.avgProcessingDuration,
        updates.processingDuration,
        updated.completed + updated.failed
      );
    }

    this.metrics.queueStats.set(queueName, updated);
  }

  private updateAverage(current: number, newValue: number, count: number): number {
    return ((current * (count - 1)) + newValue) / count;
  }
}

class HealthChecker {
  private status: HealthStatus = {
    status: 'starting',
    timestamp: Date.now(),
    checks: {}
  };
  private interval: NodeJS.Timeout | null = null;

  constructor(private jobManager: JobManager) {}

  async start(): Promise<void> {
    // Initial health check
    await this.performHealthCheck();
    
    // Schedule periodic health checks
    this.interval = setInterval(() => {
      void this.performHealthCheck();
    }, 30000); // Every 30 seconds
  }

  async stop(): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  getStatus(): HealthStatus {
    return { ...this.status };
  }

  private async performHealthCheck(): Promise<void> {
    const checks: Record<string, CheckResult> = {};
    let overallStatus: 'healthy' | 'unhealthy' | 'starting' = 'healthy';

    // Database connectivity check
    try {
      const supabase = createServiceClient();
      await supabase.from('render_jobs').select('count').limit(1);
      checks.database = { status: 'pass', timestamp: Date.now() };
    } catch (error) {
      checks.database = {
        status: 'fail',
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error)
      };
      overallStatus = 'unhealthy';
    }

    // PgBoss health check
    try {
      // This is a simple check - in production you might want more sophisticated checks
      const metrics = this.jobManager.getMetrics();
      if (metrics.totalSystemErrors > 10) {
        throw new Error('Too many system errors');
      }
      checks.pgboss = { status: 'pass', timestamp: Date.now() };
    } catch (error) {
      checks.pgboss = {
        status: 'fail',
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error)
      };
      overallStatus = 'unhealthy';
    }

    this.status = {
      status: overallStatus,
      timestamp: Date.now(),
      checks
    };
  }
}

// Type definitions
export interface JobOptions extends Partial<PgBoss.SendOptions> {
  jobId?: string;
  priority?: number;
  retryLimit?: number;
  retryDelay?: number;
  retryBackoff?: boolean;
  expireInSeconds?: number;
  singletonKey?: string;
}

export interface WorkerOptions extends Partial<PgBoss.WorkOptions> {
  teamSize?: number;
  teamConcurrency?: number;
}

export interface JobResult {
  jobId: string;
  queueName: string;
  status: 'enqueued' | 'processing' | 'completed' | 'failed';
}

export type JobHandler<T = any> = (job: PgBoss.Job<T>) => Promise<any>;

interface QueueStats {
  enqueued: number;
  completed: number;
  failed: number;
  enqueueFailures: number;
  avgEnqueueDuration: number;
  avgProcessingDuration: number;
}

export interface JobMetricsSnapshot {
  startupTime: number;
  uptime: number;
  totalJobsEnqueued: number;
  totalJobsCompleted: number;
  totalJobsFailed: number;
  totalEnqueueFailures: number;
  totalSystemErrors: number;
  activeJobs: number;
  queueStats: Record<string, QueueStats>;
}

export interface CheckResult {
  status: 'pass' | 'fail';
  timestamp: number;
  error?: string;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'starting';
  timestamp: number;
  checks: Record<string, CheckResult>;
}

// Singleton instance for the application
export const jobManager = new JobManager();