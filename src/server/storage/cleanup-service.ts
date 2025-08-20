// src/server/storage/cleanup-service.ts
import { SmartStorageProvider } from './smart-storage-provider';

class CleanupService {
  private storageProvider: SmartStorageProvider | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    // Storage provider will be created lazily when needed
  }

  private getStorageProvider(): SmartStorageProvider {
    if (!this.storageProvider) {
      this.storageProvider = new SmartStorageProvider();
    }
    return this.storageProvider;
  }

  start(): void {
    if (this.isRunning) {
      console.log('✅ Cleanup service is already running - skipping duplicate start');
      return;
    }

    console.log('🚀 Starting background cleanup service...');
    this.isRunning = true;

    // Start the cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.runCleanup();
    }, 3 * 60 * 1000); // Every 3 minutes

    console.log('✅ Background cleanup service started successfully');
  }

  stop(): void {
    if (!this.isRunning) {
      console.log('Cleanup service is not running');
      return;
    }

    console.log('Stopping background cleanup service...');
    this.isRunning = false;

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    console.log('Background cleanup service stopped');
  }

  private async runCleanup(): Promise<void> {
    try {
      console.log('🔄 Background cleanup cycle starting...');
      
      // Run the comprehensive cleanup
      const storageProvider = this.getStorageProvider();
      await storageProvider.performComprehensiveCleanup();
      
      console.log('✅ Background cleanup cycle completed');
    } catch (error) {
      console.error('❌ Background cleanup cycle failed:', error);
    }
  }

  getStatus(): { isRunning: boolean; lastCleanup?: Date } {
    return {
      isRunning: this.isRunning,
    };
  }
}

// Create a singleton instance
let _cleanupServiceInstance: CleanupService | null = null;

export const getCleanupService = (): CleanupService => {
  if (!_cleanupServiceInstance) {
    _cleanupServiceInstance = new CleanupService();
    // Don't auto-start here - let the application decide when to start
  }
  return _cleanupServiceInstance;
};

// Export the service instance without auto-starting
export const cleanupService = getCleanupService();

// Graceful shutdown is now handled by the service registry
