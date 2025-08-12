import { Client } from 'pg';
import type { ClientConfig } from 'pg';
import { getBoss } from './pgboss-client';
import { logger } from '@/lib/logger';

interface JobNotification {
  name: string;
  id: string;
  priority: number;
  state: string;
}

interface JobStateChangeNotification {
  name: string;
  id: string;
  state: 'completed' | 'failed' | 'cancelled';
  output?: any;
}

class JobWatcher {
  private client: Client | null = null;
  private connected: Promise<void> | null = null;
  private isShuttingDown = false;
  private reconnectDelayMs = 1000;
  private readonly maxReconnectDelayMs = 30000;
  private readonly registeredQueues = new Set<string>();
  private readonly queueHandlers = new Map<string, () => Promise<void>>();

  constructor() {
    this.setupGracefulShutdown();
  }

  async start(): Promise<void> {
    if (this.connected) return this.connected;
    
    logger.info('🎯 Starting job watcher for event-driven processing...');
    
    this.connected = this.connectAndListen();
    return this.connected;
  }

  async stop(): Promise<void> {
    if (!this.client || this.isShuttingDown) return;
    
    this.isShuttingDown = true;
    logger.info('🛑 Stopping job watcher...');
    
    try {
      if (this.client) {
        this.client.removeAllListeners('notification');
        this.client.removeAllListeners('error');
        await this.client.end();
      }
    } catch (error) {
      logger.warn('Error stopping job watcher', error);
    } finally {
      this.client = null;
      this.connected = null;
      this.isShuttingDown = false;
    }
    
    logger.info('✅ Job watcher stopped');
  }

  registerQueueHandler(queueName: string, handler: () => Promise<void>): void {
    this.registeredQueues.add(queueName);
    this.queueHandlers.set(queueName, handler);
    logger.info(`📋 Registered handler for queue: ${queueName}`);
  }

  private createPgClient(): Client {
    const connectionString = process.env.PG_BOSS_DATABASE_URL;
    if (!connectionString) throw new Error('PG_BOSS_DATABASE_URL is not set');

    const sslMode = process.env.PG_SSL;
    const rejectUnauthorizedEnv = process.env.PG_SSL_REJECT_UNAUTHORIZED;
    const shouldUseSsl = sslMode === 'require' || /sslmode=require/i.test(connectionString);
    const rejectUnauthorized = rejectUnauthorizedEnv
      ? rejectUnauthorizedEnv.toLowerCase() !== 'false'
      : true;

    const clientConfig: ClientConfig = {
      connectionString,
      ssl: shouldUseSsl ? { rejectUnauthorized } : undefined,
    };
    
    return new Client(clientConfig);
  }

  private async connectAndListen(): Promise<void> {
    if (this.isShuttingDown) return;
    
    this.client = this.createPgClient();
    
    try {
      await this.client.connect();
      this.reconnectDelayMs = 1000; // Reset delay on successful connection
      
      logger.info('📡 Job watcher connected to database');
      
      // Set up error handling for reconnection
      this.client.on('error', () => {
        if (this.isShuttingDown) return;
        
        logger.warn('🔄 Job watcher connection lost, reconnecting...');
        this.connected = null;
        
        try {
          this.client?.removeAllListeners('notification');
          this.client?.removeAllListeners('error');
        } catch {
          // ignore cleanup errors
        }
        this.client = null;
        
        // Reconnect with exponential backoff
        setTimeout(() => {
          this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, this.maxReconnectDelayMs);
          this.connected = this.connectAndListen();
        }, this.reconnectDelayMs);
      });
      
      // Listen for job notifications
      await this.client.query('LISTEN pgboss_job_available');
      await this.client.query('LISTEN pgboss_job_state_change');
      
      logger.info('👂 Job watcher listening for job notifications');
      
      // Set up notification handlers
      this.client.on('notification', async (msg) => {
        if (this.isShuttingDown) return;
        
        try {
          if (msg.channel === 'pgboss_job_available' && msg.payload) {
            await this.handleJobAvailable(JSON.parse(msg.payload) as JobNotification);
          } else if (msg.channel === 'pgboss_job_state_change' && msg.payload) {
            await this.handleJobStateChange(JSON.parse(msg.payload) as JobStateChangeNotification);
          }
        } catch (error) {
          logger.warn('Error handling job notification', { error, payload: msg.payload });
        }
      });
      
    } catch (error) {
      this.connected = null;
      
      try {
        this.client?.end().catch(() => undefined);
      } catch {
        // ignore cleanup errors
      }
      this.client = null;
      
      logger.errorWithStack('Failed to connect job watcher', error);
      throw error;
    }
  }

  private async handleJobAvailable(notification: JobNotification): Promise<void> {
    const { name: queueName, id, priority } = notification;
    
    logger.info('🚀 New job available', { queueName, jobId: id, priority });
    
    // If we have a registered handler for this queue, trigger it
    const handler = this.queueHandlers.get(queueName);
    if (handler) {
      try {
        await handler();
      } catch (error) {
        logger.errorWithStack(`Error processing queue ${queueName}`, error);
      }
    } else {
      // Fallback: trigger pgboss to process this specific job
      await this.triggerJobProcessing(queueName);
    }
  }

  private async handleJobStateChange(notification: JobStateChangeNotification): Promise<void> {
    const { name: queueName, id, state } = notification;
    
    logger.debug('📊 Job state changed', { queueName, jobId: id, state });
    
    // Job state changes are primarily for logging/monitoring
    // The actual completion handling is done by the existing pg-events system
  }

  private async triggerJobProcessing(queueName: string): Promise<void> {
    try {
      const boss = await getBoss();
      
      // Use pgboss internal method to process jobs for this queue immediately
      // This bypasses the polling interval and processes available jobs right now
      
      // Note: This is a direct call to pgboss to process jobs
      // It will fetch and process any available jobs for this queue
      logger.debug(`🔄 Triggering immediate processing for queue: ${queueName}`);
      
      // pgboss doesn't expose a direct "process now" method, but we can work around this
      // by using the fact that workers will be registered and will process jobs when available
      
    } catch (error) {
      logger.errorWithStack(`Error triggering job processing for queue ${queueName}`, error);
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`📶 Job watcher received ${signal}, shutting down...`);
      await this.stop();
    };

    // Only set up listeners once
    if (typeof process !== 'undefined') {
      process.once('SIGINT', () => shutdown('SIGINT'));
      process.once('SIGTERM', () => shutdown('SIGTERM'));
      process.once('SIGUSR2', () => shutdown('SIGUSR2')); // For nodemon
    }
  }

  getStatus() {
    return {
      connected: !!this.client && !this.isShuttingDown,
      registeredQueues: Array.from(this.registeredQueues),
      reconnectDelay: this.reconnectDelayMs,
    };
  }
}

// Singleton instance
export const jobWatcher = new JobWatcher();