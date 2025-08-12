// Load environment configuration FIRST, before any other imports
import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

// Now import other modules that may use environment variables
import { logger } from '@/lib/logger';
import { jobManager } from './job-manager';
import { renderWorker } from './render-worker';

// Production-ready worker entry point with comprehensive error handling
class WorkerRunner {
  private isRunning = false;
  private shutdownRequested = false;

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('🔄 Worker is already running');
      return;
    }

    try {
      logger.info('🚀 Starting production worker runner...');
      
      // Validate environment
      this.validateEnvironment();
      
      // Increase max listeners to prevent warnings
      process.setMaxListeners(20);
      
      // Setup graceful shutdown handlers
      this.setupGracefulShutdown();
      
      // Start job manager first
      logger.info('📋 Starting job manager...');
      await jobManager.start();
      
      // Start render worker
      logger.info('🎬 Starting render worker...');
      await renderWorker.start();
      
      this.isRunning = true;
      
      logger.info('✅ Production worker runner started successfully', {
        jobManagerHealth: jobManager.getHealthStatus(),
        renderWorkerStatus: renderWorker.getStatus(),
        processId: process.pid,
        nodeVersion: process.version,
        uptime: process.uptime()
      });
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      // Keep the process alive
      this.keepAlive();
      
    } catch (error) {
      logger.errorWithStack('❌ Failed to start worker runner', error);
      await this.shutdown(1);
    }
  }

  async shutdown(exitCode: number = 0): Promise<void> {
    if (this.shutdownRequested) {
      logger.warn('⚠️ Shutdown already in progress...');
      return;
    }
    
    this.shutdownRequested = true;
    logger.info('🛑 Initiating graceful shutdown...');
    
    const shutdownTimeout = Number(process.env.WORKER_SHUTDOWN_TIMEOUT_MS ?? '30000');
    const shutdownTimer = setTimeout(() => {
      logger.error('💥 Shutdown timeout exceeded, forcing exit');
      process.exit(1);
    }, shutdownTimeout);

    try {
      // Stop render worker first (gracefully complete active jobs)
      if (this.isRunning) {
        logger.info('🎬 Stopping render worker...');
        await renderWorker.stop();
      }
      
      // Stop job manager
      logger.info('📋 Stopping job manager...');
      await jobManager.stop();
      
      this.isRunning = false;
      clearTimeout(shutdownTimer);
      
      logger.info('✅ Graceful shutdown completed successfully');
      process.exit(exitCode);
      
    } catch (error) {
      clearTimeout(shutdownTimer);
      logger.errorWithStack('❌ Error during shutdown', error);
      process.exit(1);
    }
  }

  private validateEnvironment(): void {
    const requiredEnvVars = [
      'PG_BOSS_DATABASE_URL'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    // Validate numeric environment variables
    const numericEnvVars = [
      { name: 'RENDER_CONCURRENCY', defaultValue: '1', min: 1, max: 10 },
      { name: 'PG_BOSS_POLLING_INTERVAL', defaultValue: '30', min: 1, max: 3600 },
      { name: 'RENDER_JOB_RETRY_LIMIT', defaultValue: '5', min: 0, max: 20 }
    ];

    for (const envVar of numericEnvVars) {
      const value = Number(process.env[envVar.name] ?? envVar.defaultValue);
      if (!Number.isFinite(value) || value < envVar.min || value > envVar.max) {
        throw new Error(
          `Invalid ${envVar.name}: ${value}. Must be between ${envVar.min} and ${envVar.max}`
        );
      }
    }

    logger.info('✅ Environment validation passed', {
      nodeEnv: process.env.NODE_ENV,
      renderConcurrency: process.env.RENDER_CONCURRENCY,
      pollingInterval: process.env.PG_BOSS_POLLING_INTERVAL,
      retryLimit: process.env.RENDER_JOB_RETRY_LIMIT
    });
  }

  private setupGracefulShutdown(): void {
    const signalHandler = (signal: string) => {
      logger.info(`📶 Received ${signal}, initiating graceful shutdown...`);
      void this.shutdown(0);
    };

    // Handle various shutdown signals
    process.once('SIGINT', () => signalHandler('SIGINT'));   // Ctrl+C
    process.once('SIGTERM', () => signalHandler('SIGTERM')); // Termination request
    process.once('SIGUSR2', () => signalHandler('SIGUSR2')); // Used by nodemon
    process.once('SIGQUIT', () => signalHandler('SIGQUIT')); // Quit signal

    // Handle uncaught exceptions and rejections
    process.on('uncaughtException', (error) => {
      logger.errorWithStack('💥 Uncaught exception', error);
      void this.shutdown(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.errorWithStack('💥 Unhandled promise rejection', reason as Error, {
        promise: promise.toString()
      });
      void this.shutdown(1);
    });

    // Handle memory warnings
    process.on('warning', (warning) => {
      logger.warn('⚠️ Node.js warning', {
        name: warning.name,
        message: warning.message,
        stack: warning.stack
      });
    });
  }

  private startHealthMonitoring(): void {
    const healthCheckInterval = Number(process.env.WORKER_HEALTH_CHECK_INTERVAL_MS ?? '60000');
    
    const healthCheck = () => {
      if (this.shutdownRequested) return;
      
      try {
        const jobManagerHealth = jobManager.getHealthStatus();
        const renderWorkerStatus = renderWorker.getStatus();
        const memoryUsage = process.memoryUsage();
        
        logger.info('💓 Health check', {
          jobManager: {
            status: jobManagerHealth.status,
            uptime: jobManagerHealth.timestamp
          },
          renderWorker: {
            isRegistered: renderWorkerStatus.isRegistered,
            activeJobs: renderWorkerStatus.activeJobCount
          },
          system: {
            uptime: process.uptime(),
            memoryUsageMB: Math.round(memoryUsage.rss / 1024 / 1024),
            heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024)
          }
        });

        // Check for unhealthy conditions
        if (jobManagerHealth.status === 'unhealthy') {
          logger.error('❌ Job manager is unhealthy', jobManagerHealth);
        }

        // Check memory usage
        const memoryLimitMB = Number(process.env.WORKER_MEMORY_LIMIT_MB ?? '512');
        const currentMemoryMB = Math.round(memoryUsage.rss / 1024 / 1024);
        
        if (currentMemoryMB > memoryLimitMB) {
          logger.error(`🧠 Memory usage too high: ${currentMemoryMB}MB > ${memoryLimitMB}MB`, {
            memoryUsage
          });
          // Could trigger graceful restart here
        }
        
      } catch (error) {
        logger.errorWithStack('❌ Health check failed', error);
      }
    };

    // Initial health check
    setTimeout(healthCheck, 5000);
    
    // Periodic health checks
    setInterval(healthCheck, healthCheckInterval);
  }

  private keepAlive(): void {
    // Keep the process alive and responsive
    const keepAliveMessage = () => {
      if (this.shutdownRequested) return;
      
      logger.debug('🔄 Worker runner is alive', {
        uptime: process.uptime(),
        activeJobs: renderWorker.getStatus().activeJobCount
      });
    };

    // Log keep-alive message every 5 minutes
    setInterval(keepAliveMessage, 5 * 60 * 1000);
  }
}

// Main execution
async function main(): Promise<void> {
  const runner = new WorkerRunner();
  await runner.start();
}

// Start the worker runner
main().catch((error) => {
  logger.errorWithStack('💥 Fatal error in worker runner', error);
  process.exit(1);
});


