// src/server/services/service-registry.ts
// Clean service registry for managing background services

import { cleanupService } from '../storage/cleanup-service';

export interface ServiceRegistry {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  getStatus(): Record<string, { isRunning: boolean; status: string }>;
}

class ServiceRegistryImpl implements ServiceRegistry {
  private isInitialized = false;
  private listenersAdded = false;
  private services = new Map<
    string,
    { start: () => void; stop: () => void; getStatus: () => unknown }
  >();

  constructor() {
    // Register services
    this.services.set('cleanup', cleanupService);
  }

  private ensureListenersAdded(): void {
    if (this.listenersAdded) return;

    // Graceful shutdown handling - only add once per process
    process.once('SIGINT', () => {
      console.log('🛑 Received SIGINT - shutting down gracefully...');
      void this.shutdown();
      process.exit(0);
    });

    process.once('SIGTERM', () => {
      console.log('🛑 Received SIGTERM - shutting down gracefully...');
      void this.shutdown();
      process.exit(0);
    });

    this.listenersAdded = true;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('✅ Services already initialized - skipping');
      return;
    }

    // Ensure event listeners are added (only once per process)
    this.ensureListenersAdded();

    console.log('🚀 Initializing background services...');

    // Start all registered services
    for (const [name, service] of this.services) {
      try {
        service.start();
        console.log(`✅ Started service: ${name}`);
      } catch {
        console.error(`❌ Failed to start service ${name}`);
      }
    }

    this.isInitialized = true;
    console.log('✅ All background services initialized successfully');
  }

  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    console.log('🛑 Shutting down background services...');

    // Stop all registered services
    for (const [name, service] of this.services) {
      try {
        service.stop();
        console.log(`✅ Stopped service: ${name}`);
      } catch {
        console.error(`❌ Failed to stop service ${name}`);
      }
    }

    this.isInitialized = false;
    console.log('✅ All background services shut down');
  }

  getStatus(): Record<string, { isRunning: boolean; status: string }> {
    const status: Record<string, { isRunning: boolean; status: string }> = {};

    for (const [name, service] of this.services) {
      try {
        const serviceStatus = service.getStatus();
        const isRunning =
          serviceStatus &&
          typeof serviceStatus === 'object' &&
          'isRunning' in serviceStatus &&
          typeof serviceStatus.isRunning === 'boolean'
            ? serviceStatus.isRunning
            : false;
        status[name] = {
          isRunning,
          status: isRunning ? 'Running' : 'Stopped',
        };
      } catch {
        status[name] = { isRunning: false, status: 'Error' };
      }
    }

    return status;
  }
}

// Export singleton instance
export const serviceRegistry = new ServiceRegistryImpl();
