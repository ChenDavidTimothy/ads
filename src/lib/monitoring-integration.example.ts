/**
 * Example integration of the monitoring system with existing code
 * This file shows how to integrate monitoring into your existing codebase
 */

import { monitor, monitoringHelpers } from './monitoring';
import { logger } from './logger';

// Example: Monitoring Supabase auth operations
export async function monitoredSupabaseAuth(
  operation: () => Promise<any>,
  authMethod: 'email' | 'oauth' | 'magic_link' | 'password_reset',
  step?: string
) {
  try {
    return await monitoringHelpers.timeFunction(
      `auth_${authMethod}`,
      operation,
      2000 // 2 second threshold
    );
  } catch (error) {
    monitor.logAuthError(error as Error, {
      authMethod,
      step,
      userId: 'unknown', // Add actual user ID if available
    });
    throw error;
  }
}

// Example: Monitoring database operations
export async function monitoredDatabaseQuery<T>(
  query: string,
  operation: () => Promise<T>,
  table?: string,
  queryOperation?: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT'
): Promise<T> {
  const start = Date.now();
  try {
    const result = await operation();
    const duration = Date.now() - start;
    
    // Log slow queries
    if (duration > 1000) {
      monitor.trackPerformance(`slow_query_${table}`, duration, {
        unit: 'ms',
        threshold: 1000,
      });
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    monitor.logDatabaseError(error as Error, query, {
      table,
      operation: queryOperation,
      queryDuration: duration,
    });
    throw error;
  }
}

// Example: Monitoring API routes
export function withAPIMonitoring<T extends (...args: any[]) => Promise<any>>(
  handler: T,
  endpoint: string
): T {
  return (async (...args: any[]) => {
    return await monitoringHelpers.monitoredAPICall(
      endpoint,
      () => handler(...args),
      {
        method: 'POST', // Adjust based on your API
      }
    );
  }) as T;
}

// Example: Integration with existing error handling
export function enhanceExistingErrorHandler(error: Error, context: any) {
  // Use your existing logger
  logger.errorWithStack('Enhanced error handling', error, context);
  
  // Add monitoring on top
  if (context.type === 'auth') {
    monitor.logAuthError(error, {
      authMethod: context.authMethod,
      step: context.step,
    });
  } else if (context.type === 'database') {
    monitor.logDatabaseError(error, context.query, {
      table: context.table,
      operation: context.operation,
    });
  } else {
    monitor.logAPIError(error, context.endpoint || 'unknown', {
      statusCode: context.statusCode,
    });
  }
}

// Example: Security monitoring for rate limiting
export function checkRateLimit(identifier: string, endpoint: string): boolean {
  // Your existing rate limiting logic
  const isLimited = false; // Replace with actual logic
  
  if (isLimited) {
    monitor.logRateLimitHit(identifier, endpoint, {
      ipAddress: '127.0.0.1', // Get actual IP
    });
    return false;
  }
  
  return true;
}

// Example: Performance monitoring for video generation
export async function monitoredVideoGeneration(
  sceneData: any,
  userId: string
): Promise<string> {
  return await monitoringHelpers.timeFunction(
    'video_generation',
    async () => {
      // Your existing video generation logic
      const videoUrl = 'https://example.com/video.mp4';
      
      // Track additional metrics
      monitor.trackPerformance('video_generation_frames', 120, {
        unit: 'count',
        userId,
      });
      
      return videoUrl;
    },
    30000 // 30 second threshold for video generation
  );
}

// Example: Monitoring storage operations
export async function monitoredStorageUpload(
  file: File,
  bucket: string,
  path: string
): Promise<string> {
  try {
    return await monitoringHelpers.timeFunction(
      'storage_upload',
      async () => {
        // Your existing storage upload logic
        const url = 'https://example.com/uploaded-file.jpg';
        
        // Track file size
        monitor.trackPerformance('storage_upload_size', file.size, {
          unit: 'bytes',
          threshold: 10 * 1024 * 1024, // 10MB threshold
        });
        
        return url;
      },
      10000 // 10 second threshold
    );
  } catch (error) {
    // Use existing storage error handling but add monitoring
    monitor.logAPIError(error as Error, `storage/${bucket}`, {
      method: 'PUT',
      userId: 'current-user-id', // Add actual user ID
    });
    throw error;
  }
}
