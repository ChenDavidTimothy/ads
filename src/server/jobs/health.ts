import { checkEventSystemHealth } from './pg-events';
import { renderQueue } from './render-queue';

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
    recommendations.push(
      'Event system is completely down - job completion notifications will fail'
    );
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
    subscribedChannels: eventHealth.subscribedChannels,
  };

  // Check queue health with proper typing
  let queueComponent;
  try {
    const queueStats = await renderQueue.getQueueStats?.();
    let queueStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (queueStats) {
      if (queueStats.pending > 100) {
        queueStatus = 'degraded';
        recommendations.push(
          `High number of pending jobs (${queueStats.pending}) - consider scaling workers`
        );
      }
      if (queueStats.failed > queueStats.completed && queueStats.failed > 10) {
        queueStatus = 'degraded';
        recommendations.push(
          `High failure rate (${queueStats.failed} failed vs ${queueStats.completed} completed)`
        );
      }
    }

    queueComponent = {
      status: queueStats ? queueStatus : 'healthy',
      stats: queueStats,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    queueComponent = {
      status: 'unhealthy' as const,
      error: errorMessage,
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
      queue: queueComponent,
    },
    recommendations,
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
      message:
        health.overall === 'healthy'
          ? 'Job system is healthy'
          : `Job system is ${health.overall}: ${health.recommendations[0] ?? 'Unknown issue'}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      healthy: false,
      message: `Health check failed: ${errorMessage}`,
    };
  }
}
