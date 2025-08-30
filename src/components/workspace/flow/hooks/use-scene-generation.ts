import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { useNotifications } from "@/hooks/use-notifications";
import { extractDomainError } from "@/shared/errors/client";
import { buildContentBasename } from "@/shared/utils/naming";
import type { NodeData } from "@/shared/types";
import { createBrowserClient } from "@/utils/supabase/client";

// Minimal local types to avoid dependency on reactflow types at build time
type RFEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};
type RFNode<T> = {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: T;
};

// Backend graceful error response type
interface ValidationError {
  type: "error" | "warning";
  code: string;
  message: string;
  suggestions?: string[];
  nodeId?: string;
  nodeName?: string;
}

// GracefulErrorResponse type removed as unused

// SuccessResponse type removed as unused

// GenerationResponse type removed as it was unused

interface VideoJob {
  jobId: string;
  sceneName: string;
  sceneId: string;
  status: "pending" | "processing" | "completed" | "failed";
  videoUrl?: string;
  error?: string;
  renderJobId?: string; // Add this field
}

interface ImageJob {
  jobId: string;
  frameName: string;
  frameId: string;
  status: "pending" | "processing" | "completed" | "failed";
  imageUrl?: string;
  error?: string;
  renderJobId?: string; // Add this field
}

export function useSceneGeneration(nodes: RFNode<NodeData>[], edges: RFEdge[]) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null); // Legacy: primary video URL
  const [videos, setVideos] = useState<VideoJob[]>([]); // New: all videos
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [images, setImages] = useState<ImageJob[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>(
    [],
  );
  const { toast } = useNotifications();
  const router = useRouter();
  const utils = api.useUtils();
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const generationAttemptRef = useRef(0);

  // Clear any pending timeouts on unmount
  useEffect(() => {
    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    };
  }, []);

  // Reset errors when nodes/edges change (user is actively working)
  useEffect(() => {
    if (lastError || validationErrors.length > 0) {
      setLastError(null);
      setValidationErrors([]);
    }
  }, [nodes, edges, lastError, validationErrors.length]);

  const generateScene = api.animation.generateScene.useMutation({
    onMutate: () => {
      setIsGenerating(true);
      setLastError(null);
      setValidationErrors([]);
      setVideoUrl(null);
      setVideos([]);
      generationAttemptRef.current += 1;
      console.log(
        `[GENERATION] Starting attempt #${generationAttemptRef.current}`,
      );
    },
    onSuccess: (data) => {
      const currentAttempt = generationAttemptRef.current;
      console.log(
        `[GENERATION] Success response for attempt #${currentAttempt}:`,
        data,
      );
      console.log(`[GENERATION] Response type analysis:`, {
        hasVideoUrl: "videoUrl" in data,
        hasJobId: "jobId" in data,
        hasJobIds: "jobIds" in data,
        success: data.success,
      });

      // Handle graceful validation errors
      if (!data.success) {
        console.log(`[GENERATION] Validation errors detected:`, data.errors);
        setIsGenerating(false);
        setValidationErrors(data.errors);

        // Show user-friendly error notifications
        const errorMessages = data.errors.filter((e) => e.type === "error");
        const warningMessages = data.errors.filter((e) => e.type === "warning");

        if (errorMessages.length > 0) {
          const primaryError = errorMessages[0];
          toast.error("Cannot generate video", primaryError!.message);
          setLastError(primaryError!.message);
        }

        if (warningMessages.length > 0) {
          warningMessages.forEach((warning) => {
            toast.warning("Warning", warning.message);
          });
        }

        return;
      }

      // Handle immediate result (fast completion)
      if ("immediateResult" in data && data.immediateResult) {
        const videoJob: VideoJob = {
          jobId: data.immediateResult.jobId,
          sceneName: buildContentBasename(
            data.immediateResult.nodeName,
            undefined,
          ),
          sceneId: data.immediateResult.nodeId,
          status: "completed",
          videoUrl: data.immediateResult.contentUrl,
          renderJobId: data.immediateResult.jobId,
        };
        setVideos([videoJob]);
        setVideoUrl(data.immediateResult.contentUrl);
        setIsGenerating(false);
        toast.success("Video generated successfully!");
        return;
      }

      // Handle legacy videoUrl format
      if (
        "videoUrl" in data &&
        data.videoUrl &&
        typeof data.videoUrl === "string"
      ) {
        setVideoUrl(data.videoUrl);
        setIsGenerating(false);
        toast.success("Video generated successfully!");
        return;
      }

      // Handle enhanced job response format
      if ("jobs" in data && data.jobs) {
        const videoJobs: VideoJob[] = data.jobs.map((job) => ({
          jobId: job.jobId,
          sceneName: buildContentBasename(
            job.nodeName,
            (job as { batchKey?: string | null }).batchKey ?? undefined,
          ),
          sceneId: job.nodeId,
          status: "pending" as const,
          renderJobId: job.jobId, // Map jobId to renderJobId for save functionality
        }));

        setVideos(videoJobs);

        if (data.totalNodes > 1) {
          toast.success(
            `Processing ${data.totalNodes} scenes`,
            "Videos will appear as they complete",
          );
        }

        const jobIds = data.jobs.map((job) => job.jobId);
        startMultiJobPolling(jobIds, currentAttempt);
        return;
      }

      // Handle multi-scene response (legacy jobIds array)
      if ("jobIds" in data && data.jobIds && Array.isArray(data.jobIds)) {
        console.warn(
          "[GENERATION] Using legacy response format - migration incomplete",
        );
        const sceneNodes = nodes.filter((n) => n.type === "scene");
        const videoJobs: VideoJob[] = data.jobIds.map(
          (jobId: string, index: number) => {
            const sceneNode = sceneNodes[index]!;
            const idData = sceneNode
              ? (
                  sceneNode.data as {
                    identifier: { id: string; displayName: string };
                  }
                ).identifier
              : { id: `legacy-${index}`, displayName: `Scene ${index + 1}` };
            return {
              jobId,
              sceneName: idData.displayName,
              sceneId: idData.id,
              status: "pending" as const,
              renderJobId: jobId,
            };
          },
        );

        setVideos(videoJobs);
        startMultiJobPolling(data.jobIds as string[], currentAttempt);
        return;
      }

      // Handle single scene response (legacy jobId format)
      if ("jobId" in data && data.jobId && typeof data.jobId === "string") {
        const jobId = data.jobId;
        if (!jobId) {
          setIsGenerating(false);
          setLastError("Invalid response from server - no job ID");
          toast.error("Generation failed", "Invalid response from server");
          return;
        }

        startJobPolling(jobId, currentAttempt);
        return;
      }

      // No valid response format found
      setIsGenerating(false);
      setLastError("Invalid response format from server");
      toast.error(
        "Generation failed",
        "Server returned unexpected response format",
      );
      console.error("[GENERATION] Unknown response format:", data);
    },
    onError: (error: unknown) => {
      console.error("[GENERATION] Mutation error:", error);

      setIsGenerating(false);

      // Handle domain errors with user-friendly messages
      const domain = extractDomainError(error);
      if (domain?.code) {
        const userFriendlyMessage = getUserFriendlyErrorMessage(
          domain.code,
          domain.message,
        );
        setLastError(userFriendlyMessage);
        toast.error("Cannot generate video", userFriendlyMessage);
        return;
      }

      // Handle auth errors
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (
        errorMessage.includes("UNAUTHORIZED") ||
        errorMessage.includes("401")
      ) {
        setLastError("Authentication required");
        toast.warning("Please log in", "Your session has expired");
        router.push("/login");
        return;
      }

      // Handle network/server errors
      if (errorMessage.includes("fetch")) {
        setLastError("Network error - please check your connection");
        toast.error(
          "Network error",
          "Please check your internet connection and try again",
        );
        return;
      }

      // Generic error fallback
      const genericMessage = "Generation failed - please try again";
      setLastError(genericMessage);
      toast.error("Generation failed", errorMessage ?? genericMessage);
    },
    retry: false,
  });

  const generateImage = api.animation.generateImage.useMutation({
    onMutate: () => {
      setIsGeneratingImage(true);
      setLastError(null);
      setValidationErrors([]);
      setImageUrl(null);
      setImages([]);
    },
    onSuccess: async (data) => {
      if (!data.success) {
        setIsGeneratingImage(false);
        setValidationErrors(data.errors);

        // Show user-friendly error notifications
        const errorMessages = data.errors.filter((e) => e.type === "error");
        const warningMessages = data.errors.filter((e) => e.type === "warning");

        if (errorMessages.length > 0) {
          const primaryError = errorMessages[0];
          if (primaryError?.message) {
            toast.error("Cannot generate image", primaryError.message);
            setLastError(primaryError.message);
          }
        }

        if (warningMessages.length > 0) {
          warningMessages.forEach((warning) => {
            toast.warning("Warning", warning.message);
          });
        }

        return;
      }
      // Handle immediate result (fast completion)
      if ("immediateResult" in data && data.immediateResult) {
        const job: ImageJob = {
          jobId: data.immediateResult.jobId,
          frameName: buildContentBasename(
            data.immediateResult.nodeName,
            undefined,
          ),
          frameId: data.immediateResult.nodeId,
          status: "completed",
          imageUrl: data.immediateResult.contentUrl,
          renderJobId: data.immediateResult.jobId,
        };
        setImages([job]);
        setImageUrl(data.immediateResult.contentUrl);
        setIsGeneratingImage(false);
        toast.success("Image generated successfully!");
        return;
      }

      // Handle legacy imageUrl format
      if (
        "imageUrl" in data &&
        data.imageUrl &&
        typeof data.imageUrl === "string"
      ) {
        setImageUrl(data.imageUrl);
        setIsGeneratingImage(false);
        toast.success("Image generated successfully!");
        return;
      }
      // Handle enhanced job response format
      if ("jobs" in data && data.jobs) {
        const imageJobs: ImageJob[] = data.jobs.map((job) => ({
          jobId: job.jobId,
          frameName: buildContentBasename(
            job.nodeName,
            (job as { batchKey?: string | null }).batchKey ?? undefined,
          ),
          frameId: job.nodeId,
          status: "pending" as const,
          renderJobId: job.jobId, // Map jobId to renderJobId for save functionality
        }));

        setImages(imageJobs);

        if (data.totalNodes > 1) {
          toast.success(
            `Processing ${data.totalNodes} frames`,
            "Images will appear as they complete",
          );
        }

        const jobIds = data.jobs.map((job) => job.jobId);
        pollImages(jobIds);
        return;
      }

      // Handle legacy jobIds array format
      if ("jobIds" in data) {
        console.warn(
          "[GENERATION] Using legacy response format - migration incomplete",
        );
        const jobIds = (data as unknown as { jobIds?: string[] }).jobIds ?? [];
        if (jobIds.length > 0) {
          setImages(
            jobIds.map((jobId, index) => {
              const frameNode = nodes.filter((n) => n.type === "frame")[index]!;
              const idData = frameNode
                ? (
                    frameNode.data as {
                      identifier: { id: string; displayName: string };
                    }
                  ).identifier
                : { id: `legacy-${index}`, displayName: `Frame ${index + 1}` };
              return {
                jobId,
                frameName: idData.displayName,
                frameId: idData.id,
                status: "pending",
                renderJobId: jobId,
              };
            }),
          );
          pollImages(jobIds);
        } else {
          setIsGeneratingImage(false);
          setLastError("No frames could be processed");
        }
      }
    },
    onError: (error) => {
      setIsGeneratingImage(false);
      const msg =
        error instanceof Error
          ? error.message
          : `Image generation failed: ${error instanceof Error ? error.message : "Unknown error"}`;
      setLastError(msg);
      toast.error("Image generation failed", msg);
    },
  });

  // NEW: Selective generation handler
  const handleGenerateSelected = useCallback(
    async (sceneIds: string[], frameIds: string[]) => {
      if (sceneIds.length === 0 && frameIds.length === 0) {
        toast.warning(
          "No content selected",
          "Please select at least one scene or frame",
        );
        return;
      }

      try {
        const supabase = createBrowserClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError || !user) {
          toast.warning(
            "Please log in",
            "Authentication required to generate content",
          );
          router.push("/login");
          return;
        }

        // Calculate dependencies for selected targets
        const allSelectedIds = [...sceneIds, ...frameIds];
        const visited = new Set<string>();
        const requiredNodeIds = new Set<string>();

        // Traverse dependencies
        allSelectedIds.forEach((targetId) => {
          const traverse = (nodeId: string) => {
            if (visited.has(nodeId)) return;
            visited.add(nodeId);
            requiredNodeIds.add(nodeId);

            const incomingEdges = edges.filter((e) => {
              const targetNode = nodes.find((n) => n.id === e.target);
              return targetNode && targetNode.data.identifier.id === nodeId;
            });

            incomingEdges.forEach((edge) => {
              const sourceNode = nodes.find((n) => n.id === edge.source);
              if (sourceNode) {
                traverse(sourceNode.data.identifier.id);
              }
            });
          };

          traverse(targetId);
        });

        // Filter to required nodes and edges
        const requiredNodes = nodes.filter((n) =>
          requiredNodeIds.has(n.data.identifier.id),
        );
        const requiredEdges = edges.filter((e) => {
          const sourceNode = nodes.find((n) => n.id === e.source);
          const targetNode = nodes.find((n) => n.id === e.target);
          return (
            sourceNode &&
            targetNode &&
            requiredNodeIds.has(sourceNode.data.identifier.id) &&
            requiredNodeIds.has(targetNode.data.identifier.id)
          );
        });

        console.log(
          `[SELECTIVE] Generating ${sceneIds.length} scenes + ${frameIds.length} frames:`,
          {
            totalWorkspace: { nodes: nodes.length, edges: edges.length },
            filtered: {
              nodes: requiredNodes.length,
              edges: requiredEdges.length,
            },
          },
        );

        // Convert to backend format
        const backendNodes = requiredNodes.map((node) => ({
          id: node.id,
          type: node.type,
          position: node.position,
          data: node.data,
        }));

        const backendEdges = requiredEdges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle ?? undefined,
          targetHandle: edge.targetHandle ?? undefined,
          kind: "data" as const,
        }));

        // Execute generation
        const promises = [];

        if (sceneIds.length > 0) {
          promises.push(
            generateScene.mutateAsync({
              nodes: backendNodes,
              edges: backendEdges,
            }),
          );
        }

        if (frameIds.length > 0) {
          promises.push(
            generateImage.mutateAsync({
              nodes: backendNodes,
              edges: backendEdges,
            }),
          );
        }

        await Promise.all(promises);

        toast.success(
          "Selective generation started",
          `Processing ${sceneIds.length + frameIds.length} selected items`,
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Selective generation failed";
        setLastError(message);
        toast.error("Selective generation failed", message);
      }
    },
    [nodes, edges, generateScene, generateImage, toast, router],
  );

  // Multi-job polling for multiple videos
  const startMultiJobPolling = useCallback(
    (jobIds: string[], currentAttempt: number) => {
      const pendingJobs = new Set(jobIds);
      let pollAttempts = 0;
      const maxPollAttempts = 60;

      const pollAllJobs = async () => {
        if (currentAttempt !== generationAttemptRef.current) {
          console.log(
            `[GENERATION] Cancelling multi-poll for old attempt #${currentAttempt}`,
          );
          return;
        }

        pollAttempts++;
        console.log(
          `[GENERATION] Multi-poll attempt ${pollAttempts}/${maxPollAttempts} for ${pendingJobs.size} jobs`,
        );

        try {
          const supabase = createBrowserClient();
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) {
            console.warn("[GENERATION] User logged out during polling");
            setIsGenerating(false);
            setLastError("Authentication expired during generation");
            toast.warning("Session expired", "Please log in and try again");
            router.push("/login");
            return;
          }

          // Poll all pending jobs
          const jobPromises = Array.from(pendingJobs).map(async (jobId) => {
            try {
              await utils.animation.getRenderJobStatus.invalidate({ jobId });
              const res = await utils.animation.getRenderJobStatus.fetch({
                jobId,
              });
              return { jobId, ...res };
            } catch (error) {
              console.error(`[GENERATION] Failed to poll job ${jobId}:`, error);
              return {
                jobId,
                status: "failed",
                error: "Failed to check status",
              };
            }
          });

          const results = await Promise.all(jobPromises);
          // hasUpdates tracking removed as it was unused
          let completedCount = 0;
          let failedCount = 0;

          // Update video states
          setVideos((prevVideos) => {
            return prevVideos.map((video) => {
              const result = results.find((r) => r.jobId === video.jobId);
              if (!result) return video;

              const newStatus =
                result.status === "completed"
                  ? "completed"
                  : result.status === "failed"
                    ? "failed"
                    : result.status === "processing"
                      ? "processing"
                      : "pending";

              if (newStatus !== video.status) {
                // Status change detected

                if (newStatus === "completed") {
                  completedCount++;
                  // Set primary video URL for backward compatibility
                  if (!videoUrl && "videoUrl" in result && result.videoUrl) {
                    setVideoUrl(result.videoUrl);
                  }
                } else if (newStatus === "failed") {
                  failedCount++;
                }
              }

              return {
                ...video,
                status: newStatus,
                videoUrl:
                  ("videoUrl" in result ? result.videoUrl : undefined) ??
                  video.videoUrl,
                error: result.error ?? video.error,
              };
            });
          });

          // Remove completed/failed jobs from pending set
          results.forEach((result) => {
            if (result.status === "completed" || result.status === "failed") {
              pendingJobs.delete(result.jobId);
            }
          });

          // Check if all jobs are done
          if (pendingJobs.size === 0) {
            setIsGenerating(false);
            if (completedCount > 0 && failedCount === 0) {
              toast.success(
                `All ${completedCount} videos generated successfully!`,
              );
            } else if (completedCount > 0 && failedCount > 0) {
              toast.warning(
                `${completedCount} videos completed, ${failedCount} failed`,
              );
            } else if (failedCount > 0) {
              toast.error(`All ${failedCount} videos failed to generate`);
            }
            return;
          }

          // Continue polling if there are pending jobs
          if (pollAttempts < maxPollAttempts) {
            const delay = Math.min(1000 + pollAttempts * 100, 4000);
            pollTimeoutRef.current = setTimeout(
              () => void pollAllJobs(),
              delay,
            );
          } else {
            setIsGenerating(false);
            setLastError(
              "Generation timeout - some videos may still be processing",
            );
            toast.error(
              "Generation timeout",
              `${pendingJobs.size} videos are taking longer than expected`,
            );
          }
        } catch (error) {
          console.error(
            `[GENERATION] Multi-poll attempt ${pollAttempts} failed:`,
            error,
          );

          const errorMessage =
            error instanceof Error ? error.message : String(error);
          if (
            errorMessage.includes("UNAUTHORIZED") ||
            errorMessage.includes("401")
          ) {
            if (currentAttempt === generationAttemptRef.current) {
              setIsGenerating(false);
              setLastError("Authentication expired");
              toast.warning("Session expired", "Please log in again");
              router.push("/login");
            }
            return;
          }

          if (pollAttempts < maxPollAttempts) {
            const delay = Math.min(2000 + pollAttempts * 200, 8000);
            pollTimeoutRef.current = setTimeout(
              () => void pollAllJobs(),
              delay,
            );
          } else {
            if (currentAttempt === generationAttemptRef.current) {
              setIsGenerating(false);
              setLastError("Network error during polling");
              toast.error(
                "Network error",
                "Please check your connection and try again",
              );
            }
          }
        }
      };

      pollTimeoutRef.current = setTimeout(() => void pollAllJobs(), 500);
    },
    [utils.animation.getRenderJobStatus, toast, router, videoUrl],
  );

  const pollImages = useCallback(
    (jobIds: string[]) => {
      const pending = new Set(jobIds);
      const poll = async () => {
        try {
          const res = await Promise.all(
            Array.from(pending).map(async (jobId) => {
              try {
                await utils.animation.getRenderJobStatus.invalidate({ jobId });
                const status = await utils.animation.getRenderJobStatus.fetch({
                  jobId,
                });
                return { jobId, ...status };
              } catch {
                return { jobId, status: "failed" as const };
              }
            }),
          );
          setImages((prev) =>
            prev.map((img) => {
              const s = res.find((r) => r.jobId === img.jobId);
              if (!s) return img;
              const newStatus = (
                s.status === "completed"
                  ? "completed"
                  : s.status === "failed"
                    ? "failed"
                    : s.status
              ) as ImageJob["status"];

              // Handle response with proper typing
              const responseWithUrl = s as typeof s & {
                videoUrl?: string;
                error?: string;
              };

              return {
                ...img,
                status: newStatus,
                imageUrl: responseWithUrl.videoUrl ?? img.imageUrl,
                error: responseWithUrl.error ?? img.error,
              };
            }),
          );
          res.forEach((s) => {
            if (s.status === "completed" || s.status === "failed")
              pending.delete(s.jobId);
          });
          if (pending.size > 0) setTimeout(() => void poll(), 1000);
          else setIsGeneratingImage(false);
        } catch {
          setIsGeneratingImage(false);
        }
      };
      setTimeout(() => void poll(), 500);
    },
    [utils.animation.getRenderJobStatus],
  );

  // Extract polling logic into a separate function (legacy single job)
  const startJobPolling = useCallback(
    (jobId: string, currentAttempt: number) => {
      let pollAttempts = 0;
      const maxPollAttempts = 60;

      const poll = async () => {
        if (currentAttempt !== generationAttemptRef.current) {
          console.log(
            `[GENERATION] Cancelling poll for old attempt #${currentAttempt}`,
          );
          return;
        }

        pollAttempts++;
        console.log(
          `[GENERATION] Polling attempt ${pollAttempts}/${maxPollAttempts} for job ${jobId}`,
        );

        try {
          const supabase = createBrowserClient();
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) {
            console.warn("[GENERATION] User logged out during polling");
            setIsGenerating(false);
            setLastError("Authentication expired during generation");
            toast.warning("Session expired", "Please log in and try again");
            router.push("/login");
            return;
          }

          await utils.animation.getRenderJobStatus.invalidate({ jobId });
          const res = await utils.animation.getRenderJobStatus.fetch({ jobId });

          if (res.status === "completed" && res.videoUrl) {
            if (currentAttempt === generationAttemptRef.current) {
              setVideoUrl(res.videoUrl);
              setIsGenerating(false);
              toast.success("Video generated successfully!");
            }
            return;
          }

          if (res.status === "failed") {
            if (currentAttempt === generationAttemptRef.current) {
              setIsGenerating(false);
              setLastError(res.error ?? "Generation failed on server");
              toast.error(
                "Video generation failed",
                res.error ?? "Unknown server error",
              );
            }
            return;
          }

          if (pollAttempts < maxPollAttempts) {
            const delay = Math.min(1000 + pollAttempts * 100, 4000);
            pollTimeoutRef.current = setTimeout(() => void poll(), delay);
          } else {
            if (currentAttempt === generationAttemptRef.current) {
              setIsGenerating(false);
              setLastError("Generation timeout - please try again");
              toast.error(
                "Generation timeout",
                "The server is taking longer than expected. Please try again.",
              );
            }
          }
        } catch (error) {
          console.error(
            `[GENERATION] Poll attempt ${pollAttempts} failed:`,
            error,
          );

          const errorMessage =
            error instanceof Error ? error.message : String(error);
          if (
            errorMessage.includes("UNAUTHORIZED") ||
            errorMessage.includes("401")
          ) {
            if (currentAttempt === generationAttemptRef.current) {
              setIsGenerating(false);
              setLastError("Authentication expired");
              toast.warning("Session expired", "Please log in again");
              router.push("/login");
            }
            return;
          }

          if (pollAttempts < maxPollAttempts) {
            const delay = Math.min(2000 + pollAttempts * 200, 8000);
            pollTimeoutRef.current = setTimeout(() => void poll(), delay);
          } else {
            if (currentAttempt === generationAttemptRef.current) {
              setIsGenerating(false);
              setLastError("Network error during polling");
              toast.error(
                "Network error",
                "Please check your connection and try again",
              );
            }
          }
        }
      };

      pollTimeoutRef.current = setTimeout(() => void poll(), 2000); // Increased from 500ms to 2 seconds
    },
    [utils.animation.getRenderJobStatus, toast, router],
  );

  const isSceneConnected = useMemo(() => {
    const sceneNode = nodes.find((n) => n.type === "scene");
    if (!sceneNode) return false;
    const sceneTargetId = (sceneNode as unknown as { id: string }).id;
    return edges.some((edge) => edge.target === sceneTargetId);
  }, [nodes, edges]);

  const canGenerate = useMemo(() => {
    const sceneNodes = nodes.filter((n) => n.type === "scene");
    const hasScenes = sceneNodes.length > 0;
    const maxScenes = Number(
      process.env.NEXT_PUBLIC_MAX_SCENES_PER_EXECUTION ?? "8",
    );
    const withinLimits = sceneNodes.length <= maxScenes;
    return hasScenes && withinLimits && isSceneConnected && !isGenerating;
  }, [nodes, isSceneConnected, isGenerating]);

  const handleGenerateScene = useCallback(async () => {
    setLastError(null);
    setValidationErrors([]);

    try {
      const supabase = createBrowserClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        toast.warning(
          "Please log in",
          "Authentication required to generate videos",
        );
        router.push("/login");
        return;
      }

      // Sanitize edges to prevent dangling references before sending to backend
      const nodeIdSet = new Set(nodes.map((n) => n.id));
      const backendNodes = nodes.map((node) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data,
      }));
      const backendEdges = edges
        .filter((e) => nodeIdSet.has(e.source) && nodeIdSet.has(e.target))
        .map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle ?? undefined,
          targetHandle: edge.targetHandle ?? undefined,
          kind: "data" as const,
        }));

      generateScene.mutate({ nodes: backendNodes, edges: backendEdges });
    } catch (error) {
      setLastError(
        error instanceof Error ? error.message : "Validation failed",
      );
      toast.error(
        "Validation failed",
        error instanceof Error ? error.message : "Unknown validation error",
      );
    }
  }, [nodes, edges, generateScene, toast, router]);

  const resetGeneration = useCallback(() => {
    console.log("[GENERATION] Force reset triggered");
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    setIsGenerating(false);
    setLastError(null);
    setValidationErrors([]);
    generationAttemptRef.current = 0;
    // No toast for reset - it's a frequent user action
  }, []);

  const isFrameConnected = useMemo(() => {
    const frameNode = nodes.find((n) => n.type === "frame");
    if (!frameNode) return false;
    const frameTargetId = (frameNode as unknown as { id: string }).id;
    return edges.some((edge) => edge.target === frameTargetId);
  }, [nodes, edges]);

  const canGenerateImage = useMemo(() => {
    const frameNodes = nodes.filter((n) => n.type === "frame");
    const hasFrames = frameNodes.length > 0;
    const withinLimits = frameNodes.length <= 8;
    return hasFrames && withinLimits && isFrameConnected && !isGeneratingImage;
  }, [nodes, isFrameConnected, isGeneratingImage]);

  const handleGenerateImage = useCallback(async () => {
    setLastError(null);
    setValidationErrors([]);
    try {
      const supabase = createBrowserClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        toast.warning(
          "Please log in",
          "Authentication required to generate images",
        );
        router.push("/login");
        return;
      }
      const nodeIdSet = new Set(nodes.map((n) => n.id));
      const backendNodes = nodes.map((node) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data,
      }));
      const backendEdges = edges
        .filter((e) => nodeIdSet.has(e.source) && nodeIdSet.has(e.target))
        .map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle ?? undefined,
          targetHandle: edge.targetHandle ?? undefined,
          kind: "data" as const,
        }));
      generateImage.mutate({ nodes: backendNodes, edges: backendEdges });
    } catch (error) {
      setLastError(
        error instanceof Error ? error.message : "Validation failed",
      );
      toast.error(
        "Validation failed",
        error instanceof Error ? error.message : "Unknown validation error",
      );
    }
  }, [nodes, edges, generateImage, toast, router]);

  // Get detailed validation error information for UI
  const getValidationSummary = useCallback(() => {
    if (validationErrors.length === 0) return null;

    const errors = validationErrors.filter((e) => e.type === "error");
    const warnings = validationErrors.filter((e) => e.type === "warning");

    return {
      hasErrors: errors.length > 0,
      hasWarnings: warnings.length > 0,
      errorCount: errors.length,
      warningCount: warnings.length,
      errors,
      warnings,
      primaryError: errors[0] ?? null,
      allSuggestions: [...errors, ...warnings].flatMap(
        (e) => e.suggestions ?? [],
      ),
    };
  }, [validationErrors]);

  return {
    // Legacy single video support
    videoUrl,
    hasVideo: Boolean(videoUrl),
    // Image support
    imageUrl,
    hasImage: Boolean(imageUrl),
    // Multi-video support
    videos,
    hasVideos: videos.length > 0,
    completedVideos: videos.filter((v) => v.status === "completed"),

    // Multi-image support
    images,
    completedImages: images.filter((i) => i.status === "completed"),

    // Generation state
    canGenerate,
    generateScene: {
      ...generateScene,
      isPending: isGenerating,
    },
    handleGenerateScene,
    isSceneConnected,

    // Image generation
    canGenerateImage,
    generateImage: {
      ...generateImage,
      isPending: isGeneratingImage,
    },
    handleGenerateImage,
    isGeneratingImage,

    lastError,
    resetGeneration,
    isGenerating,
    validationErrors,
    getValidationSummary,

    // NEW: Selective generation
    handleGenerateSelected,

    // Download handlers for multiple videos/images
  } as const;
}

// User-friendly error messages for domain errors
function getUserFriendlyErrorMessage(
  code: string,
  originalMessage?: string,
): string {
  switch (code) {
    case "ERR_SCENE_REQUIRED":
      return "Please add a Scene node to generate video";
    case "ERR_TOO_MANY_SCENES":
      return "Too many Scene nodes - please reduce the number of scenes";
    case "ERR_DUPLICATE_OBJECT_IDS":
      return "Some objects reach nodes through multiple paths. Use a Merge node to combine them.";
    case "ERR_MISSING_INSERT_CONNECTION":
      return "Geometry objects must connect to Insert nodes to control when they appear";
    case "ERR_CIRCULAR_DEPENDENCY":
      return "Circular connections detected - please remove loops in your node graph";
    case "ERR_INVALID_CONNECTION":
      return "Invalid connection between nodes - check port compatibility";
    case "ERR_NODE_VALIDATION_FAILED":
      return "Some nodes have invalid properties - check the property panel";
    case "ERR_SCENE_VALIDATION_FAILED":
      return "Scene validation failed - check your animation setup";
    default:
      return originalMessage ?? "An error occurred while generating the video";
  }
}
