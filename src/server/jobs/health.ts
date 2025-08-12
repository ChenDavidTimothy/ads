import { getBossHealth, runMaintenance } from './pgboss-client';
import { checkEventSystemHealth } from './pg-events';
import { getWorkerStatus } from './render-worker';
import { renderQueue } from './render-queue';
import { logger } from '@/lib/logger';

export interface JobSystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  components: {
    pgboss: {
      status: 'healthy' | 'unhealthy';
      connected: boolean;
      queueCount?: number;
      error?: string;
    };
    events: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      listenerConnected: boolean;
      publisherConnected: boolean;
      subscribedChannels: string[];
    };
    worker: {
      status: 'healthy' | 'degraded' | 'not_running';
      registered: boolean;
      activeJobs: number;
      concurrency: number;
      shutdownRequested: boolean;
    };
    queue: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      stats?: {
        pending: number;
        active: number;
        completed: number;
        failed: number;
      };
      error?: string;
    };
  };
  recommendations: string[];
}

// Check the health of the entire job system
export async function checkJobSystemHealth(): Promise<JobSystemHealth> {
  const timestamp = new Date().toISOString();
  const recommendations: string[] = [];

  // Check PgBoss health
  const bossHealth = await getBossHealth();
  const pgbossComponent = {
    status: bossHealth.connected ? 'healthy' as const : 'unhealthy' as const,
    connected: bossHealth.connected,
    queueCount: bossHealth.queueCount,
    error: bossHealth.error
  };

  if (!bossHealth.connected) {
    recommendations.push('PgBoss connection is down - check database connectivity');
  }

  // Check event system health
  const eventHealth = await checkEventSystemHealth();
  let eventStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  
  if (!eventHealth.listenerConnected && !eventHealth.publisherConnected) {
    eventStatus = 'unhealthy';
    recommendations.push('Event system is completely down - jobs will not be processed');
  } else if (!eventHealth.listenerConnected || !eventHealth.publisherConnected) {
    eventStatus = 'degraded';
    if (!eventHealth.listenerConnected) {
      recommendations.push('Event listener is down - workers may miss new jobs');
    }
    if (!eventHealth.publisherConnected) {
      recommendations.push('Event publisher is down - job completion notifications may fail');
    }
  }

  const eventsComponent = {
    status: eventStatus,
    listenerConnected: eventHealth.listenerConnected,
    publisherConnected: eventHealth.publisherConnected,
    subscribedChannels: eventHealth.subscribedChannels
  };

  // Check worker health (may not be running in all processes)
  let workerComponent;
  try {
    const workerStatus = getWorkerStatus();
    let workerHealthStatus: 'healthy' | 'degraded' | 'not_running' = 'not_running';
    
    if (workerStatus.registered) {
      if (workerStatus.shutdownRequested) {
        workerHealthStatus = 'degraded';
        recommendations.push('Worker is shutting down');
      } else {
        workerHealthStatus = 'healthy';
      }
      
      if (workerStatus.activeJobs >= workerStatus.concurrency) {
        recommendations.push('Worker is at capacity - consider increasing concurrency');
      }
    } else {
      recommendations.push('Worker is not registered - jobs will not be processed');
    }

    workerComponent = {
      status: workerHealthStatus,
      registered: workerStatus.registered,
      activeJobs: workerStatus.activeJobs,
      concurrency: workerStatus.concurrency,
      shutdownRequested: workerStatus.shutdownRequested
    };
  } catch {
    // Worker functions not available (not in worker process)
    workerComponent = {
      status: 'not_running' as const,
      registered: false,
      activeJobs: 0,
      concurrency: 0,
      shutdownRequested: false
    };
  }

  // Check queue health
  let queueComponent;
  try {
    const queueStats = await renderQueue.getQueueStats();
    let queueStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    // Check for concerning queue conditions
    if (queueStats.pending > 100) {
      queueStatus = 'degraded';
      recommendations.push(`High number of pending jobs (${queueStats.pending}) - consider scaling workers`);
    }
    
    if (queueStats.failed > queueStats.completed && queueStats.failed > 10) {
      queueStatus = 'degraded';
      recommendations.push(`High failure rate (${queueStats.failed} failed vs ${queueStats.completed} completed)`);
    }

    queueComponent = {
      status: queueStatus,
      stats: queueStats
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    queueComponent = {
      status: 'unhealthy' as const,
      error: errorMessage
    };
    recommendations.push('Cannot access queue statistics - check database connectivity');
  }

  // Determine overall health
  let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  
  if (pgbossComponent.status === 'unhealthy' || 
      eventsComponent.status === 'unhealthy' || 
      queueComponent.status === 'unhealthy') {
    overall = 'unhealthy';
  } else if (pgbossComponent.status === 'degraded' || 
             eventsComponent.status === 'degraded' || 
             queueComponent.status === 'degraded' ||
             workerComponent.status === 'degraded') {
    overall = 'degraded';
  }

  // Add general recommendations
  if (overall === 'unhealthy') {
    recommendations.unshift('Job system is unhealthy - immediate attention required');
  } else if (overall === 'degraded') {
    recommendations.unshift('Job system is degraded - some functionality may be impacted');
  }

  return {
    overall,
    timestamp,
    components: {
      pgboss: pgbossComponent,
      events: eventsComponent,
      worker: workerComponent,
      queue: queueComponent
    },
    recommendations
  };
}

// Simplified health check for quick status
export async function checkJobSystemStatus(): Promise<{
  healthy: boolean;
  message: string;
}> {
  try {
    const health = await checkJobSystemHealth();
    return {
      healthy: health.overall === 'healthy',
      message: health.overall === 'healthy' 
        ? 'Job system is healthy' 
        : `Job system is ${health.overall}: ${health.recommendations[0] ?? 'Unknown issue'}`
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      healthy: false,
      message: `Health check failed: ${errorMessage}`
    };
  }
}

// Auto-maintenance based on health status
export async function performHealthBasedMaintenance(): Promise<{
  maintenancePerformed: boolean;
  actions: string[];
  errors: string[];
}> {
  const actions: string[] = [];
  const errors: string[] = [];
  let maintenancePerformed = false;

  try {
    const health = await checkJobSystemHealth();
    
    // Run maintenance if queue has too many completed/failed jobs
    const queueStats = health.components.queue.stats;
    if (queueStats && (queueStats.completed > 1000 || queueStats.failed > 100)) {
      try {
        await runMaintenance();
        actions.push('Executed database maintenance (archive/cleanup)');
        maintenancePerformed = true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`Maintenance failed: ${errorMessage}`);
      }
    }

    // Log health status if not healthy
    if (health.overall !== 'healthy') {
      logger.warn('Job system health check', {
        status: health.overall,
        recommendations: health.recommendations,
        components: health.components
      });
      actions.push(`Logged health warning (${health.overall})`);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(`Health check failed: ${errorMessage}`);
  }

  return {
    maintenancePerformed,
    actions,
    errors
  };
}

// Monitor job system continuously
export function startHealthMonitor(intervalMs: number = 300000): () => void {
  let isRunning = true;
  
  const monitor = async () => {
    if (!isRunning) return;
    
    try {
      const result = await performHealthBasedMaintenance();
      
      if (result.errors.length > 0) {
        logger.error('Health monitor errors', { errors: result.errors });
      }
      
      if (result.actions.length > 0 && process.env.JOB_HEALTH_DEBUG === '1') {
        logger.info('Health monitor actions', { actions: result.actions });
      }
      
    } catch (error) {
      logger.errorWithStack('Health monitor failed', error);
    }
    
    // Schedule next check
    if (isRunning) {
      setTimeout(monitor, intervalMs);
    }
  };

  // Start monitoring
  setTimeout(monitor, intervalMs);
  
  // Return stop function
  return () => {
    isRunning = false;
  };
}