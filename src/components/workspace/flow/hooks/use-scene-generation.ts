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

interface ValidationError {
  type: 'error' | 'warning';
  code: string;
  message: string;
  suggestions?: string[];
  nodeId?: string;
  nodeName?: string;
}

interface VideoJob {
  jobId: string;
  sceneName: string;
  sceneId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
}

export function useSceneGeneration(nodes: RFNode<NodeData>[], edges: RFEdge[]) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videos, setVideos] = useState<VideoJob[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const { toast } = useNotifications();
  const router = useRouter();
  const utils = api.useUtils();
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const generationAttemptRef = useRef(0);

  useEffect(() => {
    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    };
  }, []);

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
    },
    onSuccess: (data) => {
      const currentAttempt = generationAttemptRef.current;
      if (!data.success) {
        setIsGenerating(false);
        setValidationErrors(data.errors);
        const primaryError = data.errors.find(e => e.type === 'error');
        if (primaryError) {
          toast.error('Cannot generate video', primaryError.message);
          setLastError(primaryError.message);
        }
        data.errors.filter(e => e.type === 'warning').forEach(w => toast.warning('Warning', w.message));
        return;
      }
      if ('videoUrl' in data && data.videoUrl) {
        setVideoUrl(data.videoUrl);
        setIsGenerating(false);
        toast.success('Video generated successfully!');
        return;
      }
      if ('jobIds' in data) {
        const { jobIds, totalScenes } = data;
        if (!jobIds || jobIds.length === 0) {
          setIsGenerating(false);
          setLastError('Invalid multi-scene response - no jobs created');
          toast.error('Generation failed', 'No render jobs were created');
          return;
        }
        const sceneNodes = nodes.filter(n => n.type === 'scene');
        const videoJobs: VideoJob[] = jobIds.map((jobId, index) => {
          const sceneNode = sceneNodes[index] as RFNode<NodeData>;
          const idData = (sceneNode.data as { identifier: { id: string; displayName: string } }).identifier;
          return { jobId, sceneName: idData.displayName, sceneId: idData.id, status: 'pending' };
        });
        setVideos(videoJobs);
        if (totalScenes && totalScenes > 1) toast.success(`Processing ${totalScenes} scenes`, 'Multiple videos will be generated');
        startMultiJobPolling(jobIds, currentAttempt);
        return;
      }
      if ('jobId' in data) {
        const jobId = data.jobId;
        if (!jobId) {
          setIsGenerating(false);
          setLastError('Invalid response from server - no job ID');
          toast.error('Generation failed', 'Invalid response from server');
          return;
        }
        startJobPolling(jobId, currentAttempt);
        return;
      }
      setIsGenerating(false);
      setLastError('Invalid response format from server');
      toast.error('Generation failed', 'Server returned unexpected response format');
    },
    onError: (error: unknown) => {
      setIsGenerating(false);
      const domain = extractDomainError(error);
      if (domain?.code) {
        const userFriendlyMessage = getUserFriendlyErrorMessage(domain.code, domain.message);
        setLastError(userFriendlyMessage);
        toast.error('Cannot generate video', userFriendlyMessage);
        return;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('UNAUTHORIZED') || errorMessage.includes('401')) {
        setLastError('Authentication required');
        toast.warning('Please log in', 'Your session has expired');
        router.push('/auth');
        return;
      }
      if (errorMessage.includes('fetch')) {
        setLastError('Network error - please check your connection');
        toast.error('Network error', 'Please check your internet connection and try again');
        return;
      }
      const genericMessage = 'Generation failed - please try again';
      setLastError(genericMessage);
      toast.error('Generation failed', errorMessage ?? genericMessage);
    },
    retry: false,
  });

  const startMultiJobPolling = useCallback((jobIds: string[], currentAttempt: number) => {
    const pendingJobs = new Set(jobIds);
    let pollAttempts = 0;
    const maxPollAttempts = 120;

    const mapStatus = (s: string): VideoJob['status'] => {
      if (s === 'completed') return 'completed';
      if (s === 'failed') return 'failed';
      if (s === 'processing' || s === 'active' || s === 'created' || s === 'retry') return 'processing';
      return 'pending';
    };

    const pollAllJobs = async () => {
      if (currentAttempt !== generationAttemptRef.current) return;
      pollAttempts++;
      try {
        const results = await Promise.all(jobIds.map(async (jobId) => {
          const res = await utils.animation.getRenderJobStatus.fetch({ jobId });
          return { jobId, ...res } as { jobId: string; status: string; videoUrl: string | null; error: string | null };
        }));
        let completedCount = 0;
        let failedCount = 0;
        setVideos(prev => prev.map(video => {
          const result = results.find(r => r.jobId === video.jobId);
          if (!result) return video;
          const newStatus = mapStatus(result.status);
          if (newStatus === 'completed') completedCount++;
          if (newStatus === 'failed') failedCount++;
          // Also set primary videoUrl as soon as the first completes (legacy UI support)
          if (!videoUrl && newStatus === 'completed' && result.videoUrl) setVideoUrl(result.videoUrl);
          return { ...video, status: newStatus, videoUrl: result.videoUrl ?? video.videoUrl, error: result.error ?? video.error };
        }));
        results.forEach(result => {
          const s = mapStatus(result.status);
          if (s === 'completed' || s === 'failed') pendingJobs.delete(result.jobId);
        });
        if (pendingJobs.size === 0) {
          setIsGenerating(false);
          if (completedCount > 0 && failedCount === 0) toast.success(`All ${completedCount} videos generated successfully!`);
          else if (completedCount > 0 && failedCount > 0) toast.warning(`${completedCount} videos completed, ${failedCount} failed`);
          else if (failedCount > 0) toast.error(`All ${failedCount} videos failed to generate`);
          return;
        }
        if (pollAttempts < maxPollAttempts) {
          const delay = Math.min(500 + pollAttempts * 50, 2000);
          pollTimeoutRef.current = setTimeout(() => void pollAllJobs(), delay);
        } else {
          setIsGenerating(false);
          setLastError('Generation timeout - some videos may still be processing');
          toast.error('Generation timeout', `${pendingJobs.size} videos are taking longer than expected`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('UNAUTHORIZED') || errorMessage.includes('401')) {
          if (currentAttempt === generationAttemptRef.current) {
            setIsGenerating(false);
            setLastError('Authentication expired');
            toast.warning('Session expired', 'Please log in again');
            router.push('/auth');
          }
          return;
        }
        if (pollAttempts < maxPollAttempts) {
          const delay = Math.min(1000 + pollAttempts * 100, 4000);
          pollTimeoutRef.current = setTimeout(() => void pollAllJobs(), delay);
        } else {
          if (currentAttempt === generationAttemptRef.current) {
            setIsGenerating(false);
            setLastError('Network error during polling');
            toast.error('Network error', 'Please check your connection and try again');
          }
        }
      }
    };

    pollTimeoutRef.current = setTimeout(() => void pollAllJobs(), 250);
  }, [utils.animation.getRenderJobStatus, toast, router, videoUrl]);

  const startJobPolling = useCallback((jobId: string, currentAttempt: number) => {
    let pollAttempts = 0;
    const maxPollAttempts = 120;

    const poll = async () => {
      if (currentAttempt !== generationAttemptRef.current) return;
      pollAttempts++;
      try {
        const supabase = createBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsGenerating(false);
          setLastError('Authentication expired during generation');
          toast.warning('Session expired', 'Please log in and try again');
          router.push('/auth');
          return;
        }
        const res = await utils.animation.getRenderJobStatus.fetch({ jobId });
        if (res.status === 'completed' && res.videoUrl) {
          if (currentAttempt === generationAttemptRef.current) {
            setVideoUrl(res.videoUrl);
            setIsGenerating(false);
            toast.success('Video generated successfully!');
          }
          return;
        }
        if (res.status === 'failed') {
          if (currentAttempt === generationAttemptRef.current) {
            setIsGenerating(false);
            setLastError(res.error ?? 'Generation failed on server');
            toast.error('Video generation failed', res.error ?? 'Unknown server error');
          }
          return;
        }
        if (pollAttempts < maxPollAttempts) {
          const delay = Math.min(500 + pollAttempts * 50, 2000);
          pollTimeoutRef.current = setTimeout(() => void poll(), delay);
        } else {
          if (currentAttempt === generationAttemptRef.current) {
            setIsGenerating(false);
            setLastError('Generation timeout - please try again');
            toast.error('Generation timeout', 'The server is taking longer than expected. Please try again.');
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('UNAUTHORIZED') || errorMessage.includes('401')) {
          if (currentAttempt === generationAttemptRef.current) {
            setIsGenerating(false);
            setLastError('Authentication expired');
            toast.warning('Session expired', 'Please log in again');
            router.push('/auth');
          }
          return;
        }
        if (pollAttempts < maxPollAttempts) {
          const delay = Math.min(1000 + pollAttempts * 100, 4000);
          pollTimeoutRef.current = setTimeout(() => void poll(), delay);
        } else {
          if (currentAttempt === generationAttemptRef.current) {
            setIsGenerating(false);
            setLastError('Network error during polling');
            toast.error('Network error', 'Please check your connection and try again');
          }
        }
      }
    };

    pollTimeoutRef.current = setTimeout(() => void poll(), 250);
  }, [utils.animation.getRenderJobStatus, toast, router]);

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
      const sceneNodes = nodes.filter((n) => n.type === 'scene');
      if (sceneNodes.length === 0) {
        toast.warning('No scene node', 'Add a Scene node to generate video');
        return;
      }
      generateScene.mutate({
        nodes: nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
        edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? undefined, targetHandle: e.targetHandle ?? undefined })),
      });
    } catch (error) {
      const domain = extractDomainError(error);
      if (domain?.code) {
        const userFriendlyMessage = getUserFriendlyErrorMessage(domain.code, domain.message);
        setLastError(userFriendlyMessage);
        toast.error('Cannot generate video', userFriendlyMessage);
        return;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      setLastError(errorMessage);
      toast.error('Generation failed', errorMessage);
    }
  }, [nodes, edges, generateScene, toast, router]);

  const getValidationSummary = useCallback(() => {
    if (validationErrors.length === 0) return null;
    const errors: ValidationError[] = validationErrors.filter(e => e.type === 'error');
    const warnings: ValidationError[] = validationErrors.filter(e => e.type === 'warning');
    return {
      hasErrors: errors.length > 0,
      hasWarnings: warnings.length > 0,
      errorCount: errors.length,
      warningCount: warnings.length,
      errors,
      warnings,
      primaryError: errors.length > 0 ? errors[0] : null,
      allSuggestions: [...new Set(validationErrors.flatMap(e => e.suggestions ?? []))]
    };
  }, [validationErrors]);

  const handleDownload = useCallback(async () => {
    if (!videoUrl) return;
    try {
      const a = document.createElement('a');
      a.href = videoUrl;
      a.download = 'animation.mp4';
      a.click();
    } catch (error) {
      console.error('Download failed:', error);
    }
  }, [videoUrl]);

  const handleDownloadAll = useCallback(async () => {
    const completed = videos.filter(v => v.status === 'completed' && v.videoUrl);
    if (completed.length === 0) return;
    try {
      for (const v of completed) {
        const a = document.createElement('a');
        a.href = v.videoUrl!;
        a.download = `${v.sceneName}.mp4`;
        a.click();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error('Download all failed:', error);
    }
  }, [videos]);

  const handleDownloadVideo = useCallback(async (jobId: string) => {
    const v = videos.find(v => v.jobId === jobId && v.videoUrl);
    if (!v) return;
    try {
      const a = document.createElement('a');
      a.href = v.videoUrl!;
      a.download = `${v.sceneName}.mp4`;
      a.click();
    } catch (error) {
      console.error('Download failed:', error);
    }
  }, [videos]);

  const resetGeneration = useCallback(() => {
    setVideoUrl(null);
    setVideos([]);
    setIsGenerating(false);
    setLastError(null);
    setValidationErrors([]);
  }, []);

  return {
    videoUrl,
    videos,
    completedVideos: videos.filter(v => v.status === 'completed' && v.videoUrl),
    canGenerate,
    handleGenerateScene,
    handleDownload,
    handleDownloadAll,
    handleDownloadVideo,
    lastError,
    resetGeneration,
    isGenerating,
    getValidationSummary,
  } as const;
}

function getUserFriendlyErrorMessage(code: string, message?: string): string {
  switch (code) {
    case 'NO_SCENE_NODES':
      return 'Add at least one Scene node to generate video';
    case 'INVALID_GRAPH':
      return 'Your graph has invalid connections';
    case 'NODE_EXECUTION_ERROR':
      return 'A node failed during generation';
    default:
      return message ?? 'An error occurred';
  }
}