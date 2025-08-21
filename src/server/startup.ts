// src/server/startup.ts
// Clean application startup initialization

import { serviceRegistry } from "./services/service-registry";
import { processConfig } from "./config/process-config";

// Process-based detection - only run in main Next.js process
function shouldInitializeServices(): boolean {
  // Skip if this is a worker process
  if (processConfig.isWorker) {
    console.log(
      `🔧 ${processConfig.processType} process detected - skipping service initialization`,
    );
    return false;
  }

  // Skip if explicitly disabled
  if (process.env.DISABLE_BACKGROUND_SERVICES === "true") {
    console.log("🔧 Background services disabled via environment variable");
    return false;
  }

  return true;
}

export async function initializeBackgroundServices(): Promise<void> {
  if (!shouldInitializeServices()) {
    return;
  }

  try {
    await serviceRegistry.initialize();
  } catch (error) {
    console.error("❌ Failed to initialize background services:", error);
  }
}

// Auto-initialize when this module is imported
void initializeBackgroundServices();
