import { jobManager } from './job-manager';
import { renderWorker } from './render-worker';
import { renderQueue } from './render-queue';
import { logger } from '@/lib/logger';
import { createServiceClient } from '@/utils/supabase/service';

// Comprehensive monitoring and observability system for job queue
export class JobQueueMonitor {
  private metrics: MonitoringMetrics;
  private healthStatus: SystemHealthStatus;
  private alertThresholds: AlertThresholds;
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.metrics = new MonitoringMetrics();
    this.healthStatus = {
      overall: 'starting',
      components: {},
      timestamp: Date.now()
    };
    this.alertThresholds = {
      errorRate: Number(process.env.ALERT_ERROR_RATE_THRESHOLD ?? '0.1'), // 10%
      responseTime: Number(process.env.ALERT_RESPONSE_TIME_MS ?? '30000'), // 30 seconds
      memoryUsageMB: Number(process.env.ALERT_MEMORY_THRESHOLD_MB ?? '512'),
      activeJobsCount: Number(process.env.ALERT_ACTIVE_JOBS_THRESHOLD ?? '50'),
      queueDepth: Number(process.env.ALERT_QUEUE_DEPTH_THRESHOLD ?? '100')
    };
  }

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      logger.warn('📊 Monitoring already started');
      return;
    }

    logger.info('📊 Starting job queue monitoring...');
    
    try {
      // Initial health check
      await this.performHealthCheck();
      
      // Start periodic monitoring (disabled in development to reduce database calls)
      if (process.env.NODE_ENV === 'production') {
        const intervalMs = Number(process.env.MONITORING_INTERVAL_MS ?? '30000'); // 30 seconds
        this.monitoringInterval = setInterval(() => {
          void this.performPeriodicCheck();
        }, intervalMs);
      }
      
      this.isMonitoring = true;
      logger.info('✅ Job queue monitoring started', {
        intervalMs,
        alertThresholds: this.alertThresholds
      });
      
    } catch (error) {
      logger.errorWithStack('❌ Failed to start monitoring', error);
      throw error;
    }
  }

  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) return;
    
    logger.info('🛑 Stopping job queue monitoring...');
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.isMonitoring = false;
    logger.info('✅ Job queue monitoring stopped');
  }

  getHealthStatus(): SystemHealthStatus {
    return { ...this.healthStatus };
  }

  getMetrics(): MonitoringMetricsSnapshot {
    return this.metrics.getSnapshot();
  }

  async getDetailedSystemStatus(): Promise<DetailedSystemStatus> {
    const [
      jobManagerHealth,
      renderWorkerStatus,
      queueHealth,
      databaseStatus,
      systemResources
    ] = await Promise.allSettled([
      this.checkJobManagerHealth(),
      this.checkRenderWorkerHealth(),
      this.checkQueueHealth(),
      this.checkDatabaseHealth(),
      this.checkSystemResources()
    ]);

    return {
      timestamp: Date.now(),
      overall: this.healthStatus.overall,
      components: {
        jobManager: jobManagerHealth.status === 'fulfilled' ? jobManagerHealth.value : { status: 'error', error: String(jobManagerHealth.reason) },
        renderWorker: renderWorkerStatus.status === 'fulfilled' ? renderWorkerStatus.value : { status: 'error', error: String(renderWorkerStatus.reason) },
        queue: queueHealth.status === 'fulfilled' ? queueHealth.value : { status: 'error', error: String(queueHealth.reason) },
        database: databaseStatus.status === 'fulfilled' ? databaseStatus.value : { status: 'error', error: String(databaseStatus.reason) },
        system: systemResources.status === 'fulfilled' ? systemResources.value : { status: 'error', error: String(systemResources.reason) }
      },
      metrics: this.metrics.getSnapshot(),
      alerts: this.checkAlerts()
    };
  }

  private async performPeriodicCheck(): Promise<void> {
    try {
      await this.performHealthCheck();
      this.metrics.recordHealthCheck();
      
      // Check for alerts
      const alerts = this.checkAlerts();
      if (alerts.length > 0) {
        logger.warn('🚨 System alerts detected', { alerts });
        await this.handleAlerts(alerts);
      }
      
    } catch (error) {
      this.metrics.recordHealthCheckFailure();
      logger.errorWithStack('❌ Periodic health check failed', error);
    }
  }

  private async performHealthCheck(): Promise<void> {
    const startTime = Date.now();
    const components: Record<string, ComponentHealth> = {};
    let overallStatus: HealthStatus = 'healthy';

    try {
      // Check job manager
      components.jobManager = await this.checkJobManagerHealth();
      if (components.jobManager.status === 'unhealthy') overallStatus = 'unhealthy';

      // Check render worker
      components.renderWorker = await this.checkRenderWorkerHealth();
      if (components.renderWorker.status === 'unhealthy') overallStatus = 'unhealthy';

      // Check queue
      components.queue = await this.checkQueueHealth();
      if (components.queue.status === 'unhealthy') overallStatus = 'unhealthy';

      // Check database
      components.database = await this.checkDatabaseHealth();
      if (components.database.status === 'unhealthy') overallStatus = 'unhealthy';

      // Check system resources
      components.system = await this.checkSystemResources();
      if (components.system.status === 'unhealthy') overallStatus = 'unhealthy';

      this.healthStatus = {
        overall: overallStatus,
        components,
        timestamp: Date.now(),
        checkDuration: Date.now() - startTime
      };

    } catch (error) {
      this.healthStatus = {
        overall: 'unhealthy',
        components,
        timestamp: Date.now(),
        checkDuration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async checkJobManagerHealth(): Promise<ComponentHealth> {
    try {
      const health = jobManager.getHealthStatus();
      const metrics = jobManager.getMetrics();
      
      return {
        status: health.status === 'healthy' ? 'healthy' : 'unhealthy',
        timestamp: Date.now(),
        details: {
          uptime: metrics.uptime,
          totalJobsProcessed: metrics.totalJobsEnqueued,
          errorRate: metrics.totalSystemErrors / Math.max(metrics.totalJobsEnqueued, 1),
          activeJobs: metrics.activeJobs
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async checkRenderWorkerHealth(): Promise<ComponentHealth> {
    try {
      const status = renderWorker.getStatus();
      
      return {
        status: status.isRegistered && !status.isShuttingDown ? 'healthy' : 'unhealthy',
        timestamp: Date.now(),
        details: {
          isRegistered: status.isRegistered,
          isShuttingDown: status.isShuttingDown,
          activeJobCount: status.activeJobCount,
          concurrency: status.config.concurrency
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async checkQueueHealth(): Promise<ComponentHealth> {
    try {
      const health = renderQueue.getHealthStatus();
      const metrics = renderQueue.getMetrics();
      
      return {
        status: health.isInitialized && health.circuitBreakerState === 'CLOSED' ? 'healthy' : 'unhealthy',
        timestamp: Date.now(),
        details: {
          isInitialized: health.isInitialized,
          circuitBreakerState: health.circuitBreakerState,
          successRate: metrics.successRate,
          avgProcessingDuration: metrics.avgProcessingDuration,
          totalJobsProcessed: metrics.totalJobsProcessed
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async checkDatabaseHealth(): Promise<ComponentHealth> {
    try {
      const startTime = Date.now();
      const supabase = createServiceClient();
      
      // Simple connectivity test
      await supabase.from('render_jobs').select('count').limit(1);
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: responseTime < 5000 ? 'healthy' : 'unhealthy', // 5 second threshold
        timestamp: Date.now(),
        details: {
          responseTimeMs: responseTime,
          isConnected: true
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error),
        details: {
          isConnected: false
        }
      };
    }
  }

  private async checkSystemResources(): Promise<ComponentHealth> {
    try {
      const memoryUsage = process.memoryUsage();
      const memoryUsageMB = Math.round(memoryUsage.rss / 1024 / 1024);
      const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      const uptime = process.uptime();
      
      // Check if memory usage is within limits
      const isHealthy = memoryUsageMB < this.alertThresholds.memoryUsageMB;
      
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: Date.now(),
        details: {
          memoryUsageMB,
          heapUsedMB,
          heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          uptimeSeconds: Math.round(uptime),
          processId: process.pid,
          nodeVersion: process.version
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private checkAlerts(): Alert[] {
    const alerts: Alert[] = [];
    const metrics = this.metrics.getSnapshot();
    const queueMetrics = renderQueue.getMetrics();
    const workerStatus = renderWorker.getStatus();
    
    // High error rate alert
    if (queueMetrics.successRate < (1 - this.alertThresholds.errorRate)) {
      alerts.push({
        type: 'error_rate',
        severity: 'critical',
        message: `High error rate: ${((1 - queueMetrics.successRate) * 100).toFixed(1)}%`,
        value: queueMetrics.successRate,
        threshold: this.alertThresholds.errorRate,
        timestamp: Date.now()
      });
    }
    
    // High response time alert
    if (queueMetrics.avgProcessingDuration > this.alertThresholds.responseTime) {
      alerts.push({
        type: 'response_time',
        severity: 'warning',
        message: `High response time: ${queueMetrics.avgProcessingDuration}ms`,
        value: queueMetrics.avgProcessingDuration,
        threshold: this.alertThresholds.responseTime,
        timestamp: Date.now()
      });
    }
    
    // High memory usage alert
    const memoryUsageMB = Math.round(process.memoryUsage().rss / 1024 / 1024);
    if (memoryUsageMB > this.alertThresholds.memoryUsageMB) {
      alerts.push({
        type: 'memory_usage',
        severity: 'warning',
        message: `High memory usage: ${memoryUsageMB}MB`,
        value: memoryUsageMB,
        threshold: this.alertThresholds.memoryUsageMB,
        timestamp: Date.now()
      });
    }
    
    // High active jobs count alert
    if (workerStatus.activeJobCount > this.alertThresholds.activeJobsCount) {
      alerts.push({
        type: 'active_jobs',
        severity: 'warning',
        message: `High active jobs count: ${workerStatus.activeJobCount}`,
        value: workerStatus.activeJobCount,
        threshold: this.alertThresholds.activeJobsCount,
        timestamp: Date.now()
      });
    }
    
    return alerts;
  }

  private async handleAlerts(alerts: Alert[]): Promise<void> {
    for (const alert of alerts) {
      // Log the alert
      const logLevel = alert.severity === 'critical' ? 'error' : 'warn';
      logger[logLevel](`🚨 Alert: ${alert.message}`, {
        type: alert.type,
        severity: alert.severity,
        value: alert.value,
        threshold: alert.threshold
      });
      
      // Could integrate with external alerting systems here
      // e.g., Slack, PagerDuty, email notifications
      await this.sendAlert(alert);
    }
  }

  private async sendAlert(alert: Alert): Promise<void> {
    // Placeholder for external alerting integration
    // Could implement Slack notifications, emails, webhooks, etc.
    
    if (process.env.SLACK_WEBHOOK_URL) {
      try {
        await this.sendSlackAlert(alert);
      } catch (error) {
        logger.errorWithStack('❌ Failed to send Slack alert', error);
      }
    }
  }

  private async sendSlackAlert(alert: Alert): Promise<void> {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) return;
    
    const color = alert.severity === 'critical' ? 'danger' : 'warning';
    const emoji = alert.severity === 'critical' ? '🚨' : '⚠️';
    
    const payload = {
      text: `${emoji} Job Queue Alert`,
      attachments: [{
        color,
        fields: [
          { title: 'Type', value: alert.type, short: true },
          { title: 'Severity', value: alert.severity, short: true },
          { title: 'Message', value: alert.message, short: false },
          { title: 'Value', value: alert.value?.toString() || 'N/A', short: true },
          { title: 'Threshold', value: alert.threshold?.toString() || 'N/A', short: true }
        ],
        timestamp: Math.floor(alert.timestamp / 1000)
      }]
    };
    
    // Implementation would use fetch or similar to send to Slack
    logger.debug('Would send Slack alert', payload);
  }
}

// Supporting classes
class MonitoringMetrics {
  private metrics = {
    startTime: Date.now(),
    healthChecks: 0,
    healthCheckFailures: 0,
    lastHealthCheck: 0,
  };

  recordHealthCheck(): void {
    this.metrics.healthChecks++;
    this.metrics.lastHealthCheck = Date.now();
  }

  recordHealthCheckFailure(): void {
    this.metrics.healthCheckFailures++;
  }

  getSnapshot(): MonitoringMetricsSnapshot {
    return {
      ...this.metrics,
      uptime: Date.now() - this.metrics.startTime,
      healthCheckSuccessRate: this.metrics.healthChecks > 0 
        ? (this.metrics.healthChecks - this.metrics.healthCheckFailures) / this.metrics.healthChecks
        : 1
    };
  }
}

// Type definitions
type HealthStatus = 'healthy' | 'unhealthy' | 'starting';

interface ComponentHealth {
  status: HealthStatus;
  timestamp: number;
  error?: string;
  details?: Record<string, any>;
}

interface SystemHealthStatus {
  overall: HealthStatus;
  components: Record<string, ComponentHealth>;
  timestamp: number;
  checkDuration?: number;
  error?: string;
}

interface DetailedSystemStatus {
  timestamp: number;
  overall: HealthStatus;
  components: Record<string, ComponentHealth>;
  metrics: MonitoringMetricsSnapshot;
  alerts: Alert[];
}

interface MonitoringMetricsSnapshot {
  startTime: number;
  uptime: number;
  healthChecks: number;
  healthCheckFailures: number;
  healthCheckSuccessRate: number;
  lastHealthCheck: number;
}

interface AlertThresholds {
  errorRate: number;
  responseTime: number;
  memoryUsageMB: number;
  activeJobsCount: number;
  queueDepth: number;
}

interface Alert {
  type: string;
  severity: 'warning' | 'critical';
  message: string;
  value?: number;
  threshold?: number;
  timestamp: number;
}

// Global monitoring instance
export const jobQueueMonitor = new JobQueueMonitor();

// Health check endpoint helpers
export async function getHealthCheck(): Promise<{ status: string; timestamp: number }> {
  const health = jobQueueMonitor.getHealthStatus();
  return {
    status: health.overall,
    timestamp: health.timestamp
  };
}

export async function getReadinessCheck(): Promise<{ 
  ready: boolean; 
  timestamp: number; 
  components: Record<string, boolean> 
}> {
  const status = await jobQueueMonitor.getDetailedSystemStatus();
  const components: Record<string, boolean> = {};
  
  for (const [name, component] of Object.entries(status.components)) {
    components[name] = component.status === 'healthy';
  }
  
  return {
    ready: status.overall === 'healthy',
    timestamp: status.timestamp,
    components
  };
}

export async function getMetricsEndpoint(): Promise<MonitoringMetricsSnapshot & {
  jobManager: any;
  renderQueue: any;
  renderWorker: any;
}> {
  return {
    ...jobQueueMonitor.getMetrics(),
    jobManager: jobManager.getMetrics(),
    renderQueue: renderQueue.getMetrics(),
    renderWorker: renderWorker.getStatus()
  };
}