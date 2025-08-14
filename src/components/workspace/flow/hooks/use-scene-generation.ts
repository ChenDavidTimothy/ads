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

interface ImageJob {
  jobId: string;
  frameName: string;
  frameId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  imageUrl?: string;
  error?: string;
}

export function useSceneGeneration(nodes: RFNode<NodeData>[], edges: RFEdge[]) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null); // Legacy: primary video URL
  const [videos, setVideos] = useState<VideoJob[]>([]); // New: all videos
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [images, setImages] = useState<ImageJob[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
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
        startMultiJobPolling(jobIds, currentAttempt);
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
        
        startJobPolling(jobId, currentAttempt);
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
        const errorMessages = data.errors.filter(e => e.type === 'error');
        const warningMessages = data.errors.filter(e => e.type === 'warning');
        
        if (errorMessages.length > 0) {
          const primaryError = errorMessages[0];
          if (primaryError && primaryError.message) {
            toast.error('Cannot generate image', primaryError.message);
            setLastError(primaryError.message);
          }
        }
        
        if (warningMessages.length > 0) {
          warningMessages.forEach(warning => {
            toast.warning('Warning', warning.message);
          });
        }
        
        return;
      }
      if ('imageUrl' in data && data.imageUrl) {
        setImageUrl(data.imageUrl);
        setIsGeneratingImage(false);
        toast.success('Image generated successfully!');
        return;
      }
      if ('jobIds' in data) {
        const jobIds = (data as unknown as { jobIds?: string[] }).jobIds ?? [];
        if (jobIds.length > 0) {
          setImages(jobIds.map((jobId, index) => {
            const frameNode = nodes.filter(n => n.type === 'frame')[index] as RFNode<NodeData>;
            const idData = (frameNode.data as { identifier: { id: string; displayName: string } }).identifier;
            return { jobId, frameName: idData.displayName, frameId: idData.id, status: 'pending' };
          }));
          pollImages(jobIds);
        } else {
          setIsGeneratingImage(false);
          setLastError('No frames could be processed');
        }
      }
    },
    onError: (error) => {
      setIsGeneratingImage(false);
      const msg = error instanceof Error ? error.message : String(error);
      setLastError(msg);
      toast.error('Image generation failed', msg);
    }
  });

  // Multi-job polling for multiple videos
  const startMultiJobPolling = useCallback((jobIds: string[], currentAttempt: number) => {
    const pendingJobs = new Set(jobIds);
    let pollAttempts = 0;
    const maxPollAttempts = 60;
    
    const pollAllJobs = async () => {
      if (currentAttempt !== generationAttemptRef.current) {
        console.log(`[GENERATION] Cancelling multi-poll for old attempt #${currentAttempt}`);
        return;
      }
      
      pollAttempts++;
      console.log(`[GENERATION] Multi-poll attempt ${pollAttempts}/${maxPollAttempts} for ${pendingJobs.size} jobs`);
      
      try {
        const supabase = createBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.warn('[GENERATION] User logged out during polling');
          setIsGenerating(false);
          setLastError('Authentication expired during generation');
          toast.warning('Session expired', 'Please log in and try again');
          router.push('/auth');
          return;
        }
        
        // Poll all pending jobs
        const jobPromises = Array.from(pendingJobs).map(async (jobId) => {
          try {
            await utils.animation.getRenderJobStatus.invalidate({ jobId });
            const res = await utils.animation.getRenderJobStatus.fetch({ jobId });
            return { jobId, ...res };
          } catch (error) {
            console.error(`[GENERATION] Failed to poll job ${jobId}:`, error);
            return { jobId, status: 'failed', error: 'Failed to check status' };
          }
        });
        
        const results = await Promise.all(jobPromises);
        // hasUpdates tracking removed as it was unused
        let completedCount = 0;
        let failedCount = 0;
        
        // Update video states
        setVideos(prevVideos => {
          return prevVideos.map(video => {
            const result = results.find(r => r.jobId === video.jobId);
            if (!result) return video;
            
            const newStatus = result.status === 'completed' ? 'completed' : 
                             result.status === 'failed' ? 'failed' : 
                             result.status === 'processing' ? 'processing' : 'pending';
            
            if (newStatus !== video.status) {
              // Status change detected
              
              if (newStatus === 'completed') {
                completedCount++;
                // Set primary video URL for backward compatibility
                if (!videoUrl && 'videoUrl' in result && result.videoUrl) {
                  setVideoUrl(result.videoUrl);
                }
              } else if (newStatus === 'failed') {
                failedCount++;
              }
            }
            
            return {
              ...video,
              status: newStatus,
              videoUrl: ('videoUrl' in result ? result.videoUrl : undefined) ?? video.videoUrl,
              error: result.error ?? video.error
            };
          });
        });
        
        // Remove completed/failed jobs from pending set
        results.forEach(result => {
          if (result.status === 'completed' || result.status === 'failed') {
            pendingJobs.delete(result.jobId);
          }
        });
        
        // Check if all jobs are done
        if (pendingJobs.size === 0) {
          setIsGenerating(false);
          if (completedCount > 0 && failedCount === 0) {
            toast.success(`All ${completedCount} videos generated successfully!`);
          } else if (completedCount > 0 && failedCount > 0) {
            toast.warning(`${completedCount} videos completed, ${failedCount} failed`);
          } else if (failedCount > 0) {
            toast.error(`All ${failedCount} videos failed to generate`);
          }
          return;
        }
        
        // Continue polling if there are pending jobs
        if (pollAttempts < maxPollAttempts) {
          const delay = Math.min(1000 + (pollAttempts * 100), 4000);
          pollTimeoutRef.current = setTimeout(() => void pollAllJobs(), delay);
        } else {
          setIsGenerating(false);
          setLastError('Generation timeout - some videos may still be processing');
          toast.error('Generation timeout', `${pendingJobs.size} videos are taking longer than expected`);
        }
        
      } catch (error) {
        console.error(`[GENERATION] Multi-poll attempt ${pollAttempts} failed:`, error);
        
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
          const delay = Math.min(2000 + (pollAttempts * 200), 8000);
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
    
    pollTimeoutRef.current = setTimeout(() => void pollAllJobs(), 500);
  }, [utils.animation.getRenderJobStatus, toast, router, videoUrl]);

  const pollImages = useCallback((jobIds: string[]) => {
    const pending = new Set(jobIds);
    const poll = async () => {
      try {
        const res = await Promise.all(Array.from(pending).map(async (jobId) => {
          try {
            await utils.animation.getRenderJobStatus.invalidate({ jobId });
            const status = await utils.animation.getRenderJobStatus.fetch({ jobId });
            return { jobId, ...status };
          } catch {
            return { jobId, status: 'failed' as const };
          }
        }));
        setImages(prev => prev.map(img => {
          const s = res.find(r => r.jobId === img.jobId);
          if (!s) return img;
          const newStatus = (s.status === 'completed' ? 'completed' : s.status === 'failed' ? 'failed' : s.status) as ImageJob['status'];
          if (newStatus === 'completed' && 'videoUrl' in s && (s as any).videoUrl) {
            // ignore videoUrl for images
          }
          return { ...img, status: newStatus, imageUrl: (s as any).videoUrl ?? img.imageUrl, error: (s as any).error ?? img.error };
        }));
        res.forEach(s => { if (s.status === 'completed' || s.status === 'failed') pending.delete(s.jobId); });
        if (pending.size > 0) setTimeout(poll, 1000);
        else setIsGeneratingImage(false);
      } catch {
        setIsGeneratingImage(false);
      }
    };
    setTimeout(poll, 500);
  }, [utils.animation.getRenderJobStatus]);

  // Extract polling logic into a separate function (legacy single job)
  const startJobPolling = useCallback((jobId: string, currentAttempt: number) => {
    let pollAttempts = 0;
    const maxPollAttempts = 60;
      
    const poll = async () => {
      if (currentAttempt !== generationAttemptRef.current) {
        console.log(`[GENERATION] Cancelling poll for old attempt #${currentAttempt}`);
        return;
      }
      
      pollAttempts++;
      console.log(`[GENERATION] Polling attempt ${pollAttempts}/${maxPollAttempts} for job ${jobId}`);
      
      try {
        const supabase = createBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.warn('[GENERATION] User logged out during polling');
          setIsGenerating(false);
          setLastError('Authentication expired during generation');
          toast.warning('Session expired', 'Please log in and try again');
          router.push('/auth');
          return;
        }
        
        await utils.animation.getRenderJobStatus.invalidate({ jobId });
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
          const delay = Math.min(1000 + (pollAttempts * 100), 4000);
          pollTimeoutRef.current = setTimeout(() => void poll(), delay);
        } else {
          if (currentAttempt === generationAttemptRef.current) {
            setIsGenerating(false);
            setLastError('Generation timeout - please try again');
            toast.error('Generation timeout', 'The server is taking longer than expected. Please try again.');
          }
        }
      } catch (error) {
        console.error(`[GENERATION] Poll attempt ${pollAttempts} failed:`, error);
        
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
          const delay = Math.min(2000 + (pollAttempts * 200), 8000);
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
    
    pollTimeoutRef.current = setTimeout(() => void poll(), 2000); // Increased from 500ms to 2 seconds
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

  const isFrameConnected = useMemo(() => {
    const frameNode = nodes.find((n) => n.type === 'frame');
    if (!frameNode) return false;
    const frameTargetId = (frameNode as unknown as { id: string }).id;
    return edges.some((edge) => edge.target === frameTargetId);
  }, [nodes, edges]);

  const canGenerateImage = useMemo(() => {
    const frameNodes = nodes.filter((n) => n.type === 'frame');
    const hasFrames = frameNodes.length > 0;
    const withinLimits = frameNodes.length <= 8;
    return hasFrames && withinLimits && isFrameConnected && !isGeneratingImage;
  }, [nodes, isFrameConnected, isGeneratingImage]);

  const handleGenerateImage = useCallback(async () => {
    setLastError(null);
    setValidationErrors([]);
    try {
      const supabase = createBrowserClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        toast.warning('Please log in', 'Authentication required to generate images');
        router.push('/auth');
        return;
      }
      const backendNodes = nodes.map((node) => ({ id: node.id, type: node.type, position: node.position, data: node.data }));
      const backendEdges = edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, sourceHandle: edge.sourceHandle ?? undefined, targetHandle: edge.targetHandle ?? undefined, kind: 'data' as const }));
      generateImage.mutate({ nodes: backendNodes, edges: backendEdges });
    } catch (error) {
      setLastError(error instanceof Error ? error.message : 'Validation failed');
      toast.error('Validation failed', error instanceof Error ? error.message : 'Unknown validation error');
    }
  }, [nodes, edges, generateImage, toast, router]);

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

  // Image download helpers
  const handleDownloadAllImages = useCallback(async () => {
    const completedImages = images.filter(i => i.status === 'completed' && i.imageUrl);
    if (completedImages.length === 0) {
      toast.warning('No images to download', 'Wait for images to complete first');
      return;
    }
    try {
      for (const img of completedImages) {
        const link = document.createElement('a');
        link.href = img.imageUrl!;
        const ext = img.imageUrl!.toLowerCase().includes('jpeg') || img.imageUrl!.toLowerCase().includes('jpg') ? 'jpg' : 'png';
        link.download = `${img.frameName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.${ext}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      toast.success(`Downloading ${completedImages.length} images`, 'Check your downloads folder');
    } catch {
      toast.error('Download failed', 'Please try downloading images individually');
    }
  }, [images, toast]);

  const handleDownloadImage = useCallback((jobId: string) => {
    const img = images.find(i => i.jobId === jobId);
    if (!img?.imageUrl) {
      toast.warning('Image not ready', 'Please wait for the image to complete');
      return;
    }
    try {
      const link = document.createElement('a');
      link.href = img.imageUrl;
      const ext = img.imageUrl.toLowerCase().includes('jpeg') || img.imageUrl.toLowerCase().includes('jpg') ? 'jpg' : 'png';
      link.download = `${img.frameName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Downloading ${img.frameName}`, 'Check your downloads folder');
    } catch {
      toast.error('Download failed', 'Please try right-clicking the image and selecting "Save image as..."');
    }
  }, [images, toast]);

  return { 
    // Legacy single video support
    videoUrl, 
    handleDownload,
    hasVideo: Boolean(videoUrl),
    // Image support
    imageUrl,
    hasImage: Boolean(imageUrl),
    // Multi-video support
    videos,
    hasVideos: videos.length > 0,
    completedVideos: videos.filter(v => v.status === 'completed'),
    handleDownloadAll,
    handleDownloadVideo,
    
    // Multi-image support
    images,
    completedImages: images.filter(i => i.status === 'completed'),
    handleDownloadAllImages,
    handleDownloadImage,
    
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