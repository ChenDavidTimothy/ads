/**
 * Production monitoring and error tracking system
 * Integrates with existing logger and provides specialized error handling
 */

import { logger } from './logger';

interface BaseErrorContext {
  userId?: string;
  path?: string;
  userAgent?: string;
  timestamp: string;
  environment: string;
  sessionId?: string;
  requestId?: string;
}

interface AuthErrorContext extends BaseErrorContext {
  authMethod?: 'email' | 'oauth' | 'magic_link' | 'password_reset';
  step?: string;
}

interface DatabaseErrorContext extends BaseErrorContext {
  table?: string;
  operation?: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT';
  queryDuration?: number;
}

interface APIErrorContext extends BaseErrorContext {
  method?: string;
  statusCode?: number;
  responseTime?: number;
  endpoint: string;
  reason?: string;
  filename?: string;
  line?: number;
  column?: number;
  stack?: string;
  promise?: string;
}

interface SecurityEventContext extends BaseErrorContext {
  event: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  identifier?: string;
  ipAddress?: string;
  endpoint?: string;
}

interface PerformanceMetric extends BaseErrorContext {
  metric: string;
  value: number;
  unit?: 'ms' | 'bytes' | 'count';
  threshold?: number;
}

type MonitoringEvent = 
  | { type: 'AUTH_ERROR'; error: Error; context: AuthErrorContext }
  | { type: 'DATABASE_ERROR'; error: Error; query?: string; context: DatabaseErrorContext }
  | { type: 'API_ERROR'; error: Error; context: APIErrorContext }
  | { type: 'SECURITY_EVENT'; context: SecurityEventContext }
  | { type: 'PERFORMANCE'; context: PerformanceMetric }
  | { type: 'RATE_LIMIT'; identifier: string; endpoint: string; context: BaseErrorContext };

// Helper function to safely stringify errors for logging
function safeStringifyError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (typeof error === 'object' && error !== null) {
    try {
      return JSON.stringify(error);
    } catch {
      return '[Object - could not stringify]';
    }
  }
  return String(error);
}

// Helper function to safely convert promises for logging
function safeStringifyPromise(promise: Promise<unknown>): string {
  try {
    return `[Promise object: ${promise.constructor.name}]`;
  } catch {
    return '[Promise object - details unavailable]';
  }
}

class ProductionMonitor {
  private static instance: ProductionMonitor;
  private isProduction = process.env.NODE_ENV === 'production';
  private alertThresholds = {
    criticalErrors: 5, // per minute
    apiErrorRate: 0.1, // 10%
    responseTime: 5000, // 5 seconds
  };

  static getInstance(): ProductionMonitor {
    if (!ProductionMonitor.instance) {
      ProductionMonitor.instance = new ProductionMonitor();
    }
    return ProductionMonitor.instance;
  }

  private createBaseContext(): BaseErrorContext {
    return {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV ?? 'development',
      ...(typeof window !== 'undefined' && {
        path: window.location.pathname,
        userAgent: navigator.userAgent,
      }),
    };
  }

  // Log authentication errors with specialized context
  logAuthError(
    error: Error, 
    context: Partial<AuthErrorContext> = {}
  ): void {
    const fullContext: AuthErrorContext = {
      ...this.createBaseContext(),
      ...context,
    };

    const event: MonitoringEvent = {
      type: 'AUTH_ERROR',
      error,
      context: fullContext,
    };

    this.processEvent(event);

    // Use existing logger with enhanced metadata
    logger.errorWithStack('Authentication error', error, {
      type: 'AUTH_ERROR',
      authMethod: context.authMethod,
      step: context.step,
      userId: context.userId,
    });
  }

  // Log database errors with query context
  logDatabaseError(
    error: Error, 
    query?: string, 
    context: Partial<DatabaseErrorContext> = {}
  ): void {
    const fullContext: DatabaseErrorContext = {
      ...this.createBaseContext(),
      ...context,
    };

    const event: MonitoringEvent = {
      type: 'DATABASE_ERROR',
      error,
      query: query ? this.sanitizeQuery(query) : undefined,
      context: fullContext,
    };

    this.processEvent(event);

    logger.errorWithStack('Database error', error, {
      type: 'DATABASE_ERROR',
      table: context.table,
      operation: context.operation,
      queryDuration: context.queryDuration,
      sanitizedQuery: query ? this.sanitizeQuery(query) : undefined,
    });
  }

  // Log API errors with request context
  logAPIError(
    error: Error, 
    endpoint: string, 
    context: Partial<Omit<APIErrorContext, 'endpoint'>> = {}
  ): void {
    const fullContext: APIErrorContext = {
      ...this.createBaseContext(),
      endpoint,
      ...context,
    };

    const event: MonitoringEvent = {
      type: 'API_ERROR',
      error,
      context: fullContext,
    };

    this.processEvent(event);

    logger.errorWithStack('API error', error, {
      type: 'API_ERROR',
      endpoint,
      method: context.method,
      statusCode: context.statusCode,
      responseTime: context.responseTime,
    });
  }

  // Track performance metrics with thresholds
  trackPerformance(
    metric: string, 
    value: number, 
    context: Partial<Omit<PerformanceMetric, 'metric' | 'value'>> = {}
  ): void {
    const fullContext: PerformanceMetric = {
      ...this.createBaseContext(),
      metric,
      value,
      unit: 'ms',
      ...context,
    };

    const event: MonitoringEvent = {
      type: 'PERFORMANCE',
      context: fullContext,
    };

    this.processEvent(event);

    // Check if performance exceeds threshold
    const threshold = context.threshold ?? this.alertThresholds.responseTime;
    const logLevel = value > threshold ? 'warn' : 'info';
    
    logger[logLevel](`Performance metric: ${metric}`, {
      type: 'PERFORMANCE',
      metric,
      value,
      unit: context.unit ?? 'ms',
      threshold,
      exceedsThreshold: value > threshold,
    });
  }

  // Security event logging with severity handling
  logSecurityEvent(
    event: string, 
    severity: 'low' | 'medium' | 'high' | 'critical', 
    context: Partial<Omit<SecurityEventContext, 'event' | 'severity'>> = {}
  ): void {
    const fullContext: SecurityEventContext = {
      ...this.createBaseContext(),
      event,
      severity,
      ...context,
    };

    const monitoringEvent: MonitoringEvent = {
      type: 'SECURITY_EVENT',
      context: fullContext,
    };

    this.processEvent(monitoringEvent);

    // Always log security events with appropriate level
    const logLevel = (severity === 'critical' || severity === 'high') ? 'error' : 'warn';
    logger[logLevel](`Security event: ${event}`, {
      type: 'SECURITY_EVENT',
      event,
      severity,
      identifier: context.identifier,
      ipAddress: context.ipAddress,
    });

    // Send immediate alerts for critical security events
    if (severity === 'critical' && this.isProduction) {
      // FIX: Add .catch() to handle promise properly
      this.sendCriticalAlert(monitoringEvent).catch((alertError) => {
        logger.errorWithStack('Failed to send critical security alert', alertError);
      });
    }
  }

  // Rate limiting detection
  logRateLimitHit(
    identifier: string, 
    endpoint: string, 
    context: Partial<BaseErrorContext> = {}
  ): void {
    this.logSecurityEvent('RATE_LIMIT_EXCEEDED', 'medium', {
      ...context,
      identifier,
      endpoint,
    });
  }

  // Process monitoring events (send to external services)
  private processEvent(event: MonitoringEvent): void {
    if (!this.isProduction) {
      // Development logging with emojis for easy identification
      const emoji = this.getEventEmoji(event.type);
      console.log(`${emoji} [${event.type}]`, event);
      return;
    }

    // Production: send to monitoring services
    // FIX: Add .catch() to handle promise properly
    this.sendToMonitoringService(event).catch((serviceError) => {
      logger.errorWithStack('Failed to send monitoring event to service', serviceError);
    });
  }

  private getEventEmoji(type: MonitoringEvent['type']): string {
    switch (type) {
      case 'AUTH_ERROR': return '🔐';
      case 'DATABASE_ERROR': return '🗃️';
      case 'API_ERROR': return '🔌';
      case 'SECURITY_EVENT': return '🚨';
      case 'PERFORMANCE': return '📊';
      case 'RATE_LIMIT': return '⚡';
      default: return '📝';
    }
  }

  // Send to external monitoring service
  private async sendToMonitoringService(event: MonitoringEvent): Promise<void> {
    try {
      // Integration points for monitoring services
      // Uncomment and configure as needed:
      
      // Sentry integration
      // if (typeof Sentry !== 'undefined') {
      //   Sentry.captureException(event.error ?? new Error(event.type));
      // }
      
      // Custom monitoring service
      // await fetch('/api/monitoring', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(event)
      // });
      
      logger.debug('Monitoring event sent to external service', { type: event.type });
    } catch (error) {
      // FIX: Properly type the error parameter instead of using 'any'
      const errorMessage = error instanceof Error ? error : new Error(String(error));
      logger.errorWithStack('Failed to send monitoring event', errorMessage);
    }
  }

  // Send critical alerts (email, SMS, etc.)
  private async sendCriticalAlert(event: MonitoringEvent): Promise<void> {
    try {
      // In production, integrate with alerting systems
      // For now, just log with high priority
      logger.error('CRITICAL ALERT', { 
        type: event.type,
        context: event.context,
        timestamp: new Date().toISOString()
      });

      console.error('[CRITICAL ALERT]', JSON.stringify(event, null, 2));
      
    } catch (error) {
      logger.errorWithStack('Failed to send critical alert', error);
    }
  }

  // Sanitize SQL queries for logging (remove sensitive data)
  private sanitizeQuery(query: string): string {
    return query
      .replace(/password\s*=\s*'[^']*'/gi, "password='[REDACTED]'")
      .replace(/email\s*=\s*'[^']*'/gi, "email='[REDACTED]'")
      .replace(/token\s*=\s*'[^']*'/gi, "token='[REDACTED]'")
      .replace(/key\s*=\s*'[^']*'/gi, "key='[REDACTED]'")
      // Handle parameterized queries
      .replace(/\$\d+/g, '[PARAM]');
  }
}

// Global error boundary for unhandled errors
export function setupGlobalErrorHandling(): void {
  const monitor = ProductionMonitor.getInstance();

  // Browser-side error handling
  if (typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', (event) => {
      monitor.logAPIError(
        new Error(`Unhandled Promise Rejection: ${safeStringifyError(event.reason)}`),
        'global/unhandled-rejection',
        { 
          path: window.location.pathname,
          reason: safeStringifyError(event.reason),
        }
      );
    });

    window.addEventListener('error', (event) => {
      monitor.logAPIError(
        new Error(`Global Error: ${event.message}`),
        'global/javascript-error',
        { 
          path: window.location.pathname,
          filename: event.filename,
          line: event.lineno,
          column: event.colno,
          stack: event.error instanceof Error ? event.error.stack : undefined,
        }
      );
    });
  }

  // Server-side error handling
  if (typeof process !== 'undefined') {
    process.on('unhandledRejection', (reason, promise) => {
      monitor.logAPIError(
        new Error(`Unhandled Rejection: ${safeStringifyError(reason)}`),
        'server/unhandled-rejection',
        { 
          reason: safeStringifyError(reason),
          // FIX: Use safe promise stringification instead of .toString()
          promise: safeStringifyPromise(promise),
        }
      );
    });

    process.on('uncaughtException', (error) => {
      monitor.logAPIError(error, 'server/uncaught-exception');
      
      // In production, gracefully shutdown after logging
      if (process.env.NODE_ENV === 'production') {
        logger.error('Uncaught Exception, initiating graceful shutdown...');
        setTimeout(() => process.exit(1), 1000);
      }
    });
  }
}

// Export singleton instance and setup function
export const monitor = ProductionMonitor.getInstance();

// Convenience functions for common use cases
export const monitoringHelpers = {
  // Time a function and track performance
  timeFunction: async <T>(
    name: string,
    fn: () => Promise<T>,
    threshold?: number
  ): Promise<T> => {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      monitor.trackPerformance(name, duration, { threshold });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      monitor.trackPerformance(`${name}_error`, duration, { threshold });
      throw error;
    }
  },

  // Wrap API calls with monitoring
  monitoredAPICall: async <T>(
    endpoint: string,
    fn: () => Promise<T>,
    context?: Partial<APIErrorContext>
  ): Promise<T> => {
    const start = Date.now();
    try {
      const result = await fn();
      const responseTime = Date.now() - start;
      monitor.trackPerformance(`api_${endpoint}`, responseTime);
      return result;
    } catch (error) {
      const responseTime = Date.now() - start;
      monitor.logAPIError(error as Error, endpoint, {
        ...context,
        responseTime,
      });
      throw error;
    }
  },
};
