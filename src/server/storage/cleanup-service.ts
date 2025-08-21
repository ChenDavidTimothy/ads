// src/server/storage/cleanup-service.ts
import { SmartStorageProvider } from "./smart-storage-provider";
import * as fs from "fs";
import * as path from "path";

class CleanupService {
  private storageProvider: SmartStorageProvider | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lockFile: string;
  private processId: string;

  constructor() {
    // Create a unique identifier for this process
    this.processId = `${process.pid}-${Date.now()}`;
    this.lockFile = path.join(process.cwd(), ".cleanup-service.lock");

    // Ensure lock file is released on process exit
    process.on("exit", () => this.releaseLock());
    process.on("SIGINT", () => this.releaseLock());
    process.on("SIGTERM", () => this.releaseLock());
    process.on("SIGUSR2", () => this.releaseLock()); // nodemon restart

    // Storage provider will be created lazily when needed
  }

  private getStorageProvider(): SmartStorageProvider {
    this.storageProvider ??= new SmartStorageProvider();
    return this.storageProvider;
  }

  private acquireLock(): boolean {
    try {
      // Check if lock file exists and is valid
      if (fs.existsSync(this.lockFile)) {
        const lockData = fs.readFileSync(this.lockFile, "utf8");
        const [lockPid] = lockData.split("-");

        // Check if the process is still running
        try {
          if (lockPid) {
            process.kill(parseInt(lockPid), 0); // Signal 0 just checks if process exists
            // Process is still running, don't acquire lock
            return false;
          }
        } catch {
          // Process is not running, we can acquire the lock
          console.log(
            `🔓 Previous cleanup service (PID: ${lockPid}) is not running, acquiring lock`,
          );
        }
      }

      // Create lock file
      fs.writeFileSync(this.lockFile, this.processId);
      return true;
    } catch (error) {
      console.error("❌ Failed to acquire cleanup service lock:", error);
      return false;
    }
  }

  private releaseLock(): void {
    try {
      if (fs.existsSync(this.lockFile)) {
        const lockData = fs.readFileSync(this.lockFile, "utf8");
        if (lockData === this.processId) {
          fs.unlinkSync(this.lockFile);
          console.log("🔓 Cleanup service lock released");
        }
      }
    } catch (error) {
      console.error("❌ Failed to release cleanup service lock:", error);
    }
  }

  start(): void {
    if (this.isRunning) {
      console.log(
        "✅ Cleanup service is already running - skipping duplicate start",
      );
      return;
    }

    // Try to acquire the lock
    if (!this.acquireLock()) {
      console.log(
        "🔒 Another cleanup service is already running - skipping start",
      );
      return;
    }

    console.log("🚀 Starting background cleanup service...");
    this.isRunning = true;

    // Start the cleanup interval
    this.cleanupInterval = setInterval(
      () => {
        void this.runCleanup();
      },
      3 * 60 * 1000,
    ); // Every 3 minutes

    console.log("✅ Background cleanup service started successfully");
  }

  stop(): void {
    if (!this.isRunning) {
      console.log("Cleanup service is not running");
      return;
    }

    console.log("Stopping background cleanup service...");
    this.isRunning = false;

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.releaseLock();
    console.log("Background cleanup service stopped");
  }

  private async runCleanup(): Promise<void> {
    try {
      console.log("🔄 Background cleanup cycle starting...");

      // Run the comprehensive cleanup
      const storageProvider = this.getStorageProvider();
      await storageProvider.performComprehensiveCleanup();

      console.log("✅ Background cleanup cycle completed");
    } catch (error) {
      console.error("❌ Background cleanup cycle failed:", error);
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
  _cleanupServiceInstance ??= new CleanupService();
  // Don't auto-start here - let the application decide when to start
  return _cleanupServiceInstance;
};

// Export the service instance without auto-starting
export const cleanupService = getCleanupService();

// Graceful shutdown is now handled by the service registry
