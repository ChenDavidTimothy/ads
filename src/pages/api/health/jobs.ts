import type { NextApiRequest, NextApiResponse } from "next";
import {
  checkJobSystemHealth,
  checkJobSystemStatus,
} from "@/server/jobs/health";

interface HealthResponse {
  healthy: boolean;
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  message?: string;
  details?: {
    events: {
      listenerConnected: boolean;
      publisherConnected: boolean;
      subscribedChannels: string[];
    };
    queue: {
      pending: number;
      active: number;
      completed: number;
      failed: number;
    };
  };
  recommendations?: string[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthResponse | { error: string }>,
) {
  // Only allow GET requests
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Check if detailed health info is requested
    const detailed = req.query.detailed === "true";

    if (detailed) {
      // Full health check with all details
      const health = await checkJobSystemHealth();

      const response: HealthResponse = {
        healthy: health.overall === "healthy",
        status: health.overall,
        timestamp: health.timestamp,
        details: {
          events: {
            listenerConnected: health.components.events.listenerConnected,
            publisherConnected: health.components.events.publisherConnected,
            subscribedChannels: health.components.events.subscribedChannels,
          },
          queue: health.components.queue.stats ?? {
            pending: 0,
            active: 0,
            completed: 0,
            failed: 0,
          },
        },
        recommendations: health.recommendations,
      };

      // Set appropriate HTTP status based on health
      const statusCode =
        health.overall === "healthy"
          ? 200
          : health.overall === "degraded"
            ? 200
            : 503;

      return res.status(statusCode).json(response);
    } else {
      // Quick health check
      const status = await checkJobSystemStatus();

      const response: HealthResponse = {
        healthy: status.healthy,
        status: status.healthy ? "healthy" : "unhealthy",
        timestamp: new Date().toISOString(),
        message: status.message,
      };

      // Set appropriate HTTP status
      const statusCode = status.healthy ? 200 : 503;

      return res.status(statusCode).json(response);
    }
  } catch (error) {
    console.error("Health check API error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return res.status(500).json({
      error: `Health check failed: ${errorMessage}`,
    });
  }
}

// Add CORS headers for monitoring tools
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "1mb",
    },
  },
};
