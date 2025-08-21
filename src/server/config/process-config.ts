// src/server/config/process-config.ts
// Process configuration and detection

export interface ProcessConfig {
  isWorker: boolean;
  isMainApp: boolean;
  processType: "main" | "worker" | "unknown";
}

export function detectProcessType(): ProcessConfig {
  // Check if this is a worker process by examining the process
  const isWorker = process.argv.some(
    (arg) =>
      arg.includes("worker") ||
      arg.includes("graphile-worker") ||
      process.title.includes("worker"),
  );

  // Check if this is the main Next.js application
  const isMainApp =
    !isWorker &&
    (process.argv.some((arg) => arg.includes("next")) ||
      process.title.includes("next") ||
      process.env.NODE_ENV === "development");

  const processType: "main" | "worker" | "unknown" = isWorker
    ? "worker"
    : isMainApp
      ? "main"
      : "unknown";

  // Debug logging removed for cleaner console output

  return {
    isWorker,
    isMainApp,
    processType,
  };
}

// Export the detected configuration
export const processConfig = detectProcessType();
