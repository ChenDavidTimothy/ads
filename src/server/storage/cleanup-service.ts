// src/server/storage/cleanup-service.ts
import os from "os";
import * as fs from "fs";
import * as path from "path";
import { createServiceClient } from "@/utils/supabase/service";
import { StorageCleanupRunner } from "./cleanup-runner";

class CleanupService {
  private cleanupRunner: StorageCleanupRunner | null = null;
  private cleanupTempDir: string | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private readonly lockFile: string;
  private readonly processId: string;
  private listenersAdded = false;

  constructor() {
    this.processId = `${process.pid}-${Date.now()}`;
    this.lockFile = path.join(process.cwd(), ".cleanup-service.lock");
  }

  private ensureListenersAdded(): void {
    if (this.listenersAdded) return;

    process.once("exit", () => this.releaseLock());
    process.once("SIGINT", () => this.releaseLock());
    process.once("SIGTERM", () => this.releaseLock());
    process.once("SIGUSR2", () => this.releaseLock());

    this.listenersAdded = true;
  }

  private ensureCleanupRunner(): StorageCleanupRunner {
    if (!this.cleanupRunner) {
      const tempDir =
        this.cleanupTempDir ??
        path.join(os.tmpdir(), `storage-${process.pid}-${Date.now()}`);

      try {
        fs.mkdirSync(tempDir, { recursive: true });
      } catch (error) {
        console.error(
          "[cleanup-service] Failed to initialize cleanup temp directory:",
          error,
        );
        throw error;
      }

      this.cleanupTempDir = tempDir;
      this.cleanupRunner = new StorageCleanupRunner({
        supabase: createServiceClient(),
        logger: console,
        tempDir,
      });
    }

    return this.cleanupRunner;
  }

  private acquireLock(): boolean {
    try {
      if (fs.existsSync(this.lockFile)) {
        const lockData = fs.readFileSync(this.lockFile, "utf8");
        const [lockPid] = lockData.split("-");

        try {
          if (lockPid) {
            process.kill(parseInt(lockPid, 10), 0);
            return false;
          }
        } catch {
          console.log(
            `[cleanup-service] Previous cleanup service (PID: ${lockPid}) is not running, acquiring lock`,
          );
        }
      }

      fs.writeFileSync(this.lockFile, this.processId);
      return true;
    } catch (error) {
      console.error(
        "[cleanup-service] Failed to acquire cleanup service lock:",
        error,
      );
      return false;
    }
  }

  private releaseLock(): void {
    try {
      if (fs.existsSync(this.lockFile)) {
        const lockData = fs.readFileSync(this.lockFile, "utf8");
        if (lockData === this.processId) {
          fs.unlinkSync(this.lockFile);
          console.log("[cleanup-service] Cleanup service lock released");
        }
      }
    } catch (error) {
      console.error(
        "[cleanup-service] Failed to release cleanup service lock:",
        error,
      );
    }
  }

  start(): void {
    if (this.isRunning) {
      console.log(
        "[cleanup-service] Cleanup service is already running - skipping duplicate start",
      );
      return;
    }

    this.ensureListenersAdded();

    if (!this.acquireLock()) {
      console.log(
        "[cleanup-service] Another cleanup service is already running - skipping start",
      );
      return;
    }

    console.log("[cleanup-service] Starting background cleanup service...");
    this.isRunning = true;

    this.cleanupInterval = setInterval(
      () => {
        void this.runCleanup();
      },
      10 * 60 * 1000,
    );

    console.log("[cleanup-service] Background cleanup service started");
  }

  stop(): void {
    if (!this.isRunning) {
      console.log("[cleanup-service] Cleanup service is not running");
      return;
    }

    console.log("[cleanup-service] Stopping background cleanup service...");
    this.isRunning = false;

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.releaseLock();
    console.log("[cleanup-service] Background cleanup service stopped");
  }

  private async runCleanup(): Promise<void> {
    try {
      console.log("[cleanup-service] Background cleanup cycle starting...");

      const cleanupRunner = this.ensureCleanupRunner();
      await cleanupRunner.performComprehensiveCleanup();

      console.log("[cleanup-service] Background cleanup cycle completed");
    } catch (error) {
      console.error(
        "[cleanup-service] Background cleanup cycle failed:",
        error,
      );
    }
  }

  getStatus(): { isRunning: boolean; lastCleanup?: Date } {
    return {
      isRunning: this.isRunning,
    };
  }
}

let _cleanupServiceInstance: CleanupService | null = null;

export const getCleanupService = (): CleanupService => {
  _cleanupServiceInstance ??= new CleanupService();
  return _cleanupServiceInstance;
};

export const cleanupService = getCleanupService();

// Graceful shutdown is now handled by the service registry
