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
  private services = new Map<string, { start: () => void; stop: () => void; getStatus: () => any }>();

  constructor() {
    // Register services
    this.services.set('cleanup', cleanupService);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('✅ Services already initialized - skipping');
      return;
    }

    console.log('🚀 Initializing background services...');
    
    // Start all registered services
    for (const [name, service] of this.services) {
      try {
        service.start();
        console.log(`✅ Started service: ${name}`);
      } catch (error) {
        console.error(`❌ Failed to start service ${name}:`, error);
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
      } catch (error) {
        console.error(`❌ Failed to stop service ${name}:`, error);
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
        status[name] = {
          isRunning: serviceStatus.isRunning,
          status: serviceStatus.isRunning ? 'Running' : 'Stopped'
        };
      } catch (error) {
        status[name] = { isRunning: false, status: 'Error' };
      }
    }

    return status;
  }
}

// Export singleton instance
export const serviceRegistry = new ServiceRegistryImpl();

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT - shutting down gracefully...');
  await serviceRegistry.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM - shutting down gracefully...');
  await serviceRegistry.shutdown();
  process.exit(0);
});
