import { checkEventSystemHealth } from './pg-events';
import { renderQueue } from './render-queue';
import { logger } from '@/lib/logger';

export interface JobSystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  components: {
    events: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      listenerConnected: boolean;
      publisherConnected: boolean;
      subscribedChannels: string[];
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

  // Check event system health
  const eventHealth = await checkEventSystemHealth();
  let eventStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  
  if (!eventHealth.listenerConnected && !eventHealth.publisherConnected) {
    eventStatus = 'unhealthy';
    recommendations.push('Event system is completely down - job completion notifications will fail');
  } else if (!eventHealth.listenerConnected || !eventHealth.publisherConnected) {
    eventStatus = 'degraded';
    if (!eventHealth.listenerConnected) {
      recommendations.push('Event listener is down - clients may not receive completion events');
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

  // Check queue health with proper typing
  let queueComponent;
  try {
    const queueStats = await renderQueue.getQueueStats?.();
    let queueStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (queueStats) {
      if (queueStats.pending > 100) {
        queueStatus = 'degraded';
        recommendations.push(`High number of pending jobs (${queueStats.pending}) - consider scaling workers`);
      }
      if (queueStats.failed > queueStats.completed && queueStats.failed > 10) {
        queueStatus = 'degraded';
        recommendations.push(`High failure rate (${queueStats.failed} failed vs ${queueStats.completed} completed)`);
      }
    }

    queueComponent = {
      status: queueStats ? queueStatus : 'healthy',
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
  
  if (eventsComponent.status === 'unhealthy' || queueComponent.status === 'unhealthy') {
    overall = 'unhealthy';
  } else if (eventsComponent.status === 'degraded' || queueComponent.status === 'degraded') {
    overall = 'degraded';
  }

  if (overall === 'unhealthy') {
    recommendations.unshift('Job system is unhealthy - immediate attention required');
  } else if (overall === 'degraded') {
    recommendations.unshift('Job system is degraded - some functionality may be impacted');
  }

  return {
    overall,
    timestamp,
    components: {
      events: eventsComponent,
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

// Auto-maintenance placeholder (to be implemented with Graphile Worker if needed)
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

    const queueStats = health.components.queue.stats;
    if (queueStats && (queueStats.completed > 1000 || queueStats.failed > 100)) {
      // Placeholder: implement cleanup suitable for Graphile Worker if required
      actions.push('Queue appears large; consider manual cleanup or retention tuning');
      maintenancePerformed = false;
    }

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

export function startHealthMonitor(intervalMs = 300000): () => void {
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
    
    if (isRunning) {
      setTimeout(() => {
        void monitor();
      }, intervalMs);
    }
  };

  setTimeout(() => {
    void monitor();
  }, intervalMs);
  
  return () => {
    isRunning = false;
  };
}