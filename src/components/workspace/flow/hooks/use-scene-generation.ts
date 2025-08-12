import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
// Minimal local types to avoid dependency on reactflow types at build time
type RFEdge = { id: string; source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null };
type RFNode<T> = { id: string; type?: string; position: { x: number; y: number }; data: T };
import { api } from '@/trpc/react';
import { useNotifications } from '@/hooks/use-notifications';
import { extractDomainError } from '@/shared/errors/client';
import type { NodeData } from '@/shared/types';
import { createBrowserClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

// Backend graceful error response type
interface ValidationError {
  type: 'error' | 'warning';
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
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
}

export function useSceneGeneration(nodes: RFNode<NodeData>[], edges: RFEdge[]) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null); // Legacy: primary video URL
  const [videos, setVideos] = useState<VideoJob[]>([]); // New: all videos
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const { toast } = useNotifications();
  const router = useRouter();
  const utils = api.useUtils();
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const generationAttemptRef = useRef(0);
  const realtimeChannelRef = useRef<any>(null);
  const pendingJobsRef = useRef<Set<string>>(new Set());

  // Clear any pending timeouts on unmount
  useEffect(() => {
    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
      if (realtimeChannelRef.current) {
        try {
          void realtimeChannelRef.current.unsubscribe?.();
        } catch {}
        try {
          const supabase = createBrowserClient();
          // removeChannel is a no-op if already unsubscribed
          void supabase.removeChannel?.(realtimeChannelRef.current);
        } catch {}
        realtimeChannelRef.current = null;
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
      console.log(`[GENERATION] Starting attempt #${generationAttemptRef.current}`);
    },
    onSuccess: (data) => {
      const currentAttempt = generationAttemptRef.current;
      console.log(`[GENERATION] Success response for attempt #${currentAttempt}:`, data);
      console.log(`[GENERATION] Response type analysis:`, {
        hasVideoUrl: 'videoUrl' in data,
        hasJobId: 'jobId' in data,
        hasJobIds: 'jobIds' in data,
        success: data.success
      });
      
      // Handle graceful validation errors
      if (!data.success) {
        console.log(`[GENERATION] Validation errors detected:`, data.errors);
        setIsGenerating(false);
        setValidationErrors(data.errors);
        
        // Show user-friendly error notifications
        const errorMessages = data.errors.filter(e => e.type === 'error');
        const warningMessages = data.errors.filter(e => e.type === 'warning');
        
        if (errorMessages.length > 0) {
          const primaryError = errorMessages[0];
          toast.error('Cannot generate video', primaryError!.message);
          setLastError(primaryError!.message);
        }
        
        if (warningMessages.length > 0) {
          warningMessages.forEach(warning => {
            toast.warning('Warning', warning.message);
          });
        }
        
        return;
      }
      
      // Handle successful generation
      if ('videoUrl' in data && data.videoUrl) {
        setVideoUrl(data.videoUrl);
        setIsGenerating(false);
        toast.success('Video generated successfully!');
        return;
      }
      
      // Handle multi-scene response (jobIds array)
      if ('jobIds' in data) {
        const { jobIds, totalScenes } = data;
        if (!jobIds || jobIds.length === 0) {
          setIsGenerating(false);
          setLastError('Invalid multi-scene response - no jobs created');
          toast.error('Generation failed', 'No render jobs were created');
          return;
        }
        
        // Create video job entries for tracking
        const sceneNodes = nodes.filter(n => n.type === 'scene');
        const videoJobs: VideoJob[] = jobIds.map((jobId, index) => {
          const sceneNode = sceneNodes[index] as RFNode<NodeData>;
          const idData = (sceneNode.data as { identifier: { id: string; displayName: string } }).identifier;
          return {
            jobId,
            sceneName: idData.displayName,
            sceneId: idData.id,
            status: 'pending' as const
          };
        });
        
        setVideos(videoJobs);
        
        if (totalScenes && totalScenes > 1) {
          toast.success(`Processing ${totalScenes} scenes`, 'Multiple videos will be generated');
        }
        
        // Start polling all jobs
        startRealtimeTracking(jobIds, currentAttempt);
        return;
      }
      
      // Handle single scene response (legacy jobId format)
      if ('jobId' in data) {
        const jobId = data.jobId;
        if (!jobId) {
          setIsGenerating(false);
          setLastError('Invalid response from server - no job ID');
          toast.error('Generation failed', 'Invalid response from server');
          return;
        }
        
        startRealtimeTracking([jobId], currentAttempt);
        return;
      }
      
      // No valid response format found
      setIsGenerating(false);
      setLastError('Invalid response format from server');
      toast.error('Generation failed', 'Server returned unexpected response format');
      console.error('[GENERATION] Unknown response format:', data);
    },
    onError: (error: unknown) => {
      console.error('[GENERATION] Mutation error:', error);
      
      setIsGenerating(false);
      
      // Handle domain errors with user-friendly messages
      const domain = extractDomainError(error);
      if (domain?.code) {
        const userFriendlyMessage = getUserFriendlyErrorMessage(domain.code, domain.message);
        setLastError(userFriendlyMessage);
        toast.error('Cannot generate video', userFriendlyMessage);
        return;
      }
      
      // Handle auth errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('UNAUTHORIZED') || errorMessage.includes('401')) {
        setLastError('Authentication required');
        toast.warning('Please log in', 'Your session has expired');
        router.push('/auth');
        return;
      }
      
      // Handle network/server errors
      if (errorMessage.includes('fetch')) {
        setLastError('Network error - please check your connection');
        toast.error('Network error', 'Please check your internet connection and try again');
        return;
      }
      
      // Generic error fallback
      const genericMessage = 'Generation failed - please try again';
      setLastError(genericMessage);
      toast.error('Generation failed', errorMessage ?? genericMessage);
    },
    retry: false,
  });

  // Realtime tracking to eliminate polling
  const startRealtimeTracking = useCallback((jobIds: string[], currentAttempt: number) => {
    pendingJobsRef.current = new Set(jobIds);

    // Cleanup any previous channel
    if (realtimeChannelRef.current) {
      try { void realtimeChannelRef.current.unsubscribe?.(); } catch {}
      try {
        const supabase = createBrowserClient();
        void supabase.removeChannel?.(realtimeChannelRef.current);
      } catch {}
      realtimeChannelRef.current = null;
    }

    const supabase = createBrowserClient();

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsGenerating(false);
        setLastError('Authentication required');
        toast.warning('Please log in', 'Your session has expired');
        router.push('/auth');
        return;
      }

      const channel = supabase
        .channel(`render-jobs-${currentAttempt}-${Date.now()}`)
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'render_jobs', filter: `user_id=eq.${user.id}` },
          (payload: any) => {
            if (currentAttempt !== generationAttemptRef.current) return;
            const row = payload?.new as { id?: string; status?: string; output_url?: string; error?: string } | undefined;
            const jobId = row?.id;
            if (!jobId || !pendingJobsRef.current.has(jobId)) return;

            const status = row?.status;
            const videoUrlFromRow = (row as any)?.output_url as string | undefined;
            if (status === 'processing') {
              setVideos(prev => prev.map(v => v.jobId === jobId ? { ...v, status: 'processing' } : v));
              return;
            }

            if (status === 'completed') {
              // Update videos state and primary videoUrl if first
              setVideos(prev => prev.map(v => v.jobId === jobId ? { ...v, status: 'completed', videoUrl: v.videoUrl ?? videoUrlFromRow } : v));
              if (!videoUrl && videoUrlFromRow) setVideoUrl(videoUrlFromRow);
              pendingJobsRef.current.delete(jobId);
            } else if (status === 'failed') {
              setVideos(prev => prev.map(v => v.jobId === jobId ? { ...v, status: 'failed', error: row?.error } : v));
              pendingJobsRef.current.delete(jobId);
            }

            // If all done, finalize
            if (pendingJobsRef.current.size === 0) {
              setIsGenerating(false);

              // Toast summary
              const counts = { completed: 0, failed: 0 };
              setVideos(prev => {
                counts.completed = prev.filter(v => v.status === 'completed').length;
                counts.failed = prev.filter(v => v.status === 'failed').length;
                return prev;
              });

              if (counts.completed > 0 && counts.failed === 0) {
                toast.success(counts.completed > 1 ? `All ${counts.completed} videos generated successfully!` : 'Video generated successfully!');
              } else if (counts.completed > 0 && counts.failed > 0) {
                toast.warning(`${counts.completed} videos completed, ${counts.failed} failed`);
              } else if (counts.failed > 0) {
                toast.error(`${counts.failed} videos failed to generate`);
              }

              // Cleanup channel
              try { void channel.unsubscribe(); } catch {}
              try { void supabase.removeChannel?.(channel); } catch {}
              if (realtimeChannelRef.current === channel) realtimeChannelRef.current = null;
            }
          }
        );

      realtimeChannelRef.current = channel;

      const sub = channel.subscribe((status: string) => {
        if (status !== 'SUBSCRIBED') return;
        // Optional: set a safety timeout to avoid waiting forever
        if (pollTimeoutRef.current) {
          clearTimeout(pollTimeoutRef.current);
          pollTimeoutRef.current = null;
        }
        pollTimeoutRef.current = setTimeout(() => {
          if (currentAttempt !== generationAttemptRef.current) return;
          if (pendingJobsRef.current.size > 0) {
            setIsGenerating(false);
            setLastError('Generation taking longer than expected');
            toast.warning('Still processing', 'This is taking longer than expected. Check back later.');
            try { void channel.unsubscribe(); } catch {}
            try { void supabase.removeChannel?.(channel); } catch {}
            if (realtimeChannelRef.current === channel) realtimeChannelRef.current = null;
          }
        }, 5 * 60 * 1000); // 5 minutes safety timeout
      });

      // If subscribe call returned an error
      if ((sub as any)?.error) {
        console.error('[GENERATION] Realtime subscription error:', (sub as any).error);
      }
    })();
  }, [router, toast, videoUrl]);

  // Multi-job polling for multiple videos (replaced by realtime subscription)
  const startMultiJobPolling = useCallback((jobIds: string[], currentAttempt: number) => {
    // Deprecated: replaced by startRealtimeTracking
    startRealtimeTracking(jobIds, currentAttempt);
  }, [startRealtimeTracking]);

  // Extract polling logic into a separate function (legacy single job)
  const startJobPolling = useCallback((jobId: string, currentAttempt: number) => {
    // Deprecated: replaced by startRealtimeTracking
    startRealtimeTracking([jobId], currentAttempt);
  }, [startRealtimeTracking]);

  const isSceneConnected = useMemo(() => {
    const sceneNode = nodes.find((n) => n.type === 'scene');
    if (!sceneNode) return false;
    const sceneTargetId = (sceneNode as unknown as { id: string }).id;
    return edges.some((edge) => edge.target === sceneTargetId);
  }, [nodes, edges]);

  const canGenerate = useMemo(() => {
    const sceneNodes = nodes.filter((n) => n.type === 'scene');
    const hasScenes = sceneNodes.length > 0;
    const maxScenes = Number(process.env.NEXT_PUBLIC_MAX_SCENES_PER_EXECUTION ?? '8');
    const withinLimits = sceneNodes.length <= maxScenes;
    return hasScenes && withinLimits && isSceneConnected && !isGenerating;
  }, [nodes, isSceneConnected, isGenerating]);

  const handleGenerateScene = useCallback(async () => {
    setLastError(null);
    setValidationErrors([]);
    
    try {
      const supabase = createBrowserClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        toast.warning('Please log in', 'Authentication required to generate videos');
        router.push('/auth');
        return;
      }

      // Scene validation is now handled by the backend

      const backendNodes = nodes.map((node) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data,
      }));
      const backendEdges = edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle ?? undefined,
        targetHandle: edge.targetHandle ?? undefined,
        kind: 'data' as const,
      }));

      generateScene.mutate({ nodes: backendNodes, edges: backendEdges });
      
    } catch (error) {
      setLastError(error instanceof Error ? error.message : 'Validation failed');
      toast.error('Validation failed', error instanceof Error ? error.message : 'Unknown validation error');
    }
  }, [nodes, edges, generateScene, toast, router]);

  const handleDownload = useCallback(() => {
    if (!videoUrl) return;
    try {
      const link = document.createElement('a');
      link.href = videoUrl;
      link.download = `animation_${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Download started', 'Your video is being downloaded');
    } catch {
      toast.error('Download failed', 'Please try right-clicking the video and selecting "Save video as..."');
    }
  }, [videoUrl, toast]);

  const resetGeneration = useCallback(() => {
    console.log('[GENERATION] Force reset triggered');
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

  // Get detailed validation error information for UI
  const getValidationSummary = useCallback(() => {
    if (validationErrors.length === 0) return null;
    
    const errors = validationErrors.filter(e => e.type === 'error');
    const warnings = validationErrors.filter(e => e.type === 'warning');
    
    return {
      hasErrors: errors.length > 0,
      hasWarnings: warnings.length > 0,
      errorCount: errors.length,
      warningCount: warnings.length,
      errors,
      warnings,
      primaryError: errors[0] ?? null,
      allSuggestions: [...errors, ...warnings].flatMap(e => e.suggestions ?? [])
    };
  }, [validationErrors]);

  // Multi-video download functions
  const handleDownloadAll = useCallback(async () => {
    const completedVideos = videos.filter(v => v.status === 'completed' && v.videoUrl);
    if (completedVideos.length === 0) {
      toast.warning('No videos to download', 'Wait for videos to complete first');
      return;
    }

    try {
      for (const video of completedVideos) {
        const link = document.createElement('a');
        link.href = video.videoUrl!;
        link.download = `${video.sceneName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Small delay between downloads to avoid browser blocking
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      toast.success(`Downloading ${completedVideos.length} videos`, 'Check your downloads folder');
    } catch {
      toast.error('Download failed', 'Please try downloading videos individually');
    }
  }, [videos, toast]);

  const handleDownloadVideo = useCallback((jobId: string) => {
    const video = videos.find(v => v.jobId === jobId);
    if (!video?.videoUrl) {
      toast.warning('Video not ready', 'Please wait for the video to complete');
      return;
    }

    try {
      const link = document.createElement('a');
      link.href = video.videoUrl;
      link.download = `${video.sceneName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Downloading ${video.sceneName}`, 'Check your downloads folder');
    } catch {
      toast.error('Download failed', 'Please try right-clicking the video and selecting "Save video as..."');
    }
  }, [videos, toast]);

  return { 
    // Legacy single video support
    videoUrl, 
    handleDownload,
    hasVideo: Boolean(videoUrl),
    
    // Multi-video support
    videos,
    hasVideos: videos.length > 0,
    completedVideos: videos.filter(v => v.status === 'completed'),
    handleDownloadAll,
    handleDownloadVideo,
    
    // Generation state
    canGenerate, 
    generateScene: {
      ...generateScene,
      isPending: isGenerating,
    }, 
    handleGenerateScene, 
    isSceneConnected,
    lastError,
    resetGeneration,
    isGenerating,
    validationErrors,
    getValidationSummary,
  } as const;
}

// User-friendly error messages for domain errors
function getUserFriendlyErrorMessage(code: string, originalMessage?: string): string {
  switch (code) {
    case 'ERR_SCENE_REQUIRED':
      return 'Please add a Scene node to generate video';
    case 'ERR_TOO_MANY_SCENES':
      return 'Too many Scene nodes - please reduce the number of scenes';
    case 'ERR_DUPLICATE_OBJECT_IDS':
      return 'Some objects reach nodes through multiple paths. Use a Merge node to combine them.';
    case 'ERR_MISSING_INSERT_CONNECTION':
      return 'Geometry objects must connect to Insert nodes to control when they appear';
    case 'ERR_CIRCULAR_DEPENDENCY':
      return 'Circular connections detected - please remove loops in your node graph';
    case 'ERR_INVALID_CONNECTION':
      return 'Invalid connection between nodes - check port compatibility';
    case 'ERR_NODE_VALIDATION_FAILED':
      return 'Some nodes have invalid properties - check the property panel';
    case 'ERR_SCENE_VALIDATION_FAILED':
      return 'Scene validation failed - check your animation setup';
    default:
      return originalMessage ?? 'An error occurred while generating the video';
  }
}