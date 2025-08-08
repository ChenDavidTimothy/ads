import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
// Minimal local types to avoid dependency on reactflow types at build time
type RFEdge = { id: string; source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null };
type RFNode<T> = { id: string; type?: string; position: { x: number; y: number }; data: T };
import { api } from '@/trpc/react';
import { useNotifications } from '@/hooks/use-notifications';
import { extractDomainError } from '@/shared/errors/client';
import type { NodeData, SceneNodeData } from '@/shared/types';
import type { SceneConfig } from '../types';
import { createBrowserClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export function useSceneGeneration(nodes: RFNode<NodeData>[], edges: RFEdge[]) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
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

  // Reset error state when nodes/edges change (user is actively working)
  useEffect(() => {
    if (lastError) {
      setLastError(null);
    }
  }, [nodes, edges, lastError]);

  // Auth state monitoring with automatic session refresh
  useEffect(() => {
    const supabase = createBrowserClient();
    
    const checkAndRefreshAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) {
          console.warn('[AUTH] Session invalid, redirecting to login');
          toast.warning('Session expired', 'Please log in again to continue');
          router.push('/auth');
          return false;
        }
        
        // Refresh session if it expires soon (within 5 minutes)
        const expiresAt = new Date(session.expires_at! * 1000);
        const now = new Date();
        const timeUntilExpiry = expiresAt.getTime() - now.getTime();
        const fiveMinutes = 5 * 60 * 1000;
        
        if (timeUntilExpiry < fiveMinutes) {
          console.log('[AUTH] Refreshing session preventively');
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            console.error('[AUTH] Session refresh failed:', refreshError);
            toast.error('Session refresh failed', 'Please log in again');
            router.push('/auth');
            return false;
          }
        }
        
        return true;
      } catch (error) {
        console.error('[AUTH] Auth check failed:', error);
        toast.error('Authentication error', 'Please log in again');
        router.push('/auth');
        return false;
      }
    };

    // Check auth immediately and then every 2 minutes
    checkAndRefreshAuth();
    const authInterval = setInterval(checkAndRefreshAuth, 2 * 60 * 1000);
    
    return () => clearInterval(authInterval);
  }, [router, toast]);

  const generateScene = api.animation.generateScene.useMutation({
    onMutate: () => {
      // Optimistic update - start loading immediately
      setIsGenerating(true);
      setLastError(null);
      setVideoUrl(null);
      generationAttemptRef.current += 1;
      console.log(`[GENERATION] Starting attempt #${generationAttemptRef.current}`);
    },
    onSuccess: (data: { jobId: string } | { videoUrl: string }) => {
      const currentAttempt = generationAttemptRef.current;
      console.log(`[GENERATION] Success for attempt #${currentAttempt}`);
      
      // Backward-compatible: support immediate videoUrl or new async jobId flow
      if ('videoUrl' in data && data.videoUrl) {
        setVideoUrl(data.videoUrl);
        setIsGenerating(false);
        toast.success('Video generated successfully!');
        return;
      }
      
      const jobId = 'jobId' in data ? data.jobId : null;
      if (!jobId) {
        setIsGenerating(false);
        setLastError('Invalid response from server');
        toast.error('Generation failed', 'Invalid response from server');
        return;
      }
      
      // Start polling job status with timeout and retry logic
      let pollAttempts = 0;
      const maxPollAttempts = 60; // 60 attempts = ~90 seconds with backoff
      
      const poll = async () => {
        // Check if this poll is still for the current generation attempt
        if (currentAttempt !== generationAttemptRef.current) {
          console.log(`[GENERATION] Cancelling poll for old attempt #${currentAttempt}`);
          return;
        }
        
        pollAttempts++;
        console.log(`[GENERATION] Polling attempt ${pollAttempts}/${maxPollAttempts} for job ${jobId}`);
        
        try {
          // Check auth before each poll
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
          
          const res = await utils.animation.getRenderJobStatus.fetch({ jobId });
          
          if (res.status === 'completed' && res.videoUrl) {
            if (currentAttempt === generationAttemptRef.current) {
              setVideoUrl(res.videoUrl);
              setIsGenerating(false);
              toast.success('Video generated successfully!');
            }
            return; // stop polling
          }
          
          if (res.status === 'failed') {
            if (currentAttempt === generationAttemptRef.current) {
              setIsGenerating(false);
              setLastError(res.error || 'Generation failed on server');
              toast.error('Video generation failed', res.error || 'Unknown server error');
            }
            return;
          }
          
          // Continue polling if still processing
          if (pollAttempts < maxPollAttempts) {
            // Exponential backoff: start at 1s, max 4s
            const delay = Math.min(1000 + (pollAttempts * 100), 4000);
            pollTimeoutRef.current = setTimeout(poll, delay);
          } else {
            // Polling timeout
            if (currentAttempt === generationAttemptRef.current) {
              setIsGenerating(false);
              setLastError('Generation timeout - please try again');
              toast.error('Generation timeout', 'The server is taking longer than expected. Please try again.');
            }
          }
        } catch (error) {
          console.error(`[GENERATION] Poll attempt ${pollAttempts} failed:`, error);
          
          // Distinguish between network errors and auth errors
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
          
          // For network/temporary errors, continue polling with backoff
          if (pollAttempts < maxPollAttempts) {
            const delay = Math.min(2000 + (pollAttempts * 200), 8000); // Longer delay for errors
            pollTimeoutRef.current = setTimeout(poll, delay);
          } else {
            if (currentAttempt === generationAttemptRef.current) {
              setIsGenerating(false);
              setLastError('Network error during polling');
              toast.error('Network error', 'Please check your connection and try again');
            }
          }
        }
      };
      
      // Start polling after a short delay
      pollTimeoutRef.current = setTimeout(poll, 500);
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
      toast.error('Generation failed', errorMessage || genericMessage);
    },
    // Disable automatic retries to prevent infinite loops
    retry: false,
  });

  const isSceneConnected = useMemo(() => {
    const sceneNode = nodes.find((n) => n.type === 'scene');
    if (!sceneNode) return false;
    const sceneTargetId = (sceneNode as unknown as { id: string }).id;
    const legacyId: string | undefined = (sceneNode.data?.identifier?.id as string | undefined);
    return edges.some((edge) => edge.target === sceneTargetId || (legacyId ? edge.target === legacyId : false));
  }, [nodes, edges]);

  const canGenerate = useMemo(() => {
    const hasScene = nodes.some((n) => n.type === 'scene');
    return hasScene && isSceneConnected && !isGenerating;
  }, [nodes, isSceneConnected, isGenerating]);

  const validateSceneNodes = useCallback(() => {
    const sceneNodes = nodes.filter((node) => node.type === 'scene');
    if (sceneNodes.length === 0) {
      throw new Error('Scene node is required. Please add a scene node to generate video.');
    }
    if (sceneNodes.length > 1) {
      throw new Error('Only one scene node allowed per workspace. Please remove extra scene nodes.');
    }
    return sceneNodes[0]!;
  }, [nodes]);

  const handleGenerateScene = useCallback(async () => {
    // Reset any previous errors
    setLastError(null);
    
    try {
      // Verify authentication first
      const supabase = createBrowserClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        toast.warning('Please log in', 'Authentication required to generate videos');
        router.push('/auth');
        return;
      }

      const sceneNode = validateSceneNodes();
      const sceneData = sceneNode.data as unknown as SceneNodeData;
      const config: Partial<SceneConfig> = {
        width: sceneData.width,
        height: sceneData.height,
        // Coerce fps in case the select stored it as a string (e.g., '60')
        fps: typeof (sceneData as unknown as Record<string, unknown>).fps === 'string'
          ? Number((sceneData as unknown as Record<string, unknown>).fps)
          : (sceneData.fps as number),
        backgroundColor: sceneData.backgroundColor,
        videoPreset: sceneData.videoPreset,
        videoCrf: sceneData.videoCrf,
      };

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

      // Mutation will handle the rest via onMutate/onSuccess/onError
      generateScene.mutate({ nodes: backendNodes, edges: backendEdges, config });
      
    } catch (error) {
      setLastError(error instanceof Error ? error.message : 'Validation failed');
      toast.error('Validation failed', error instanceof Error ? error.message : 'Unknown validation error');
    }
  }, [nodes, edges, generateScene, validateSceneNodes, toast, router]);

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
    } catch (error) {
      toast.error('Download failed', 'Please try right-clicking the video and selecting "Save video as..."');
    }
  }, [videoUrl, toast]);

  // Force reset function for when things get stuck
  const resetGeneration = useCallback(() => {
    console.log('[GENERATION] Force reset triggered');
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    setIsGenerating(false);
    setLastError(null);
    generationAttemptRef.current = 0;
    toast.info('Generation reset', 'You can now try generating again');
  }, [toast]);

  return { 
    videoUrl, 
    canGenerate, 
    generateScene: {
      ...generateScene,
      isPending: isGenerating,
    }, 
    handleGenerateScene, 
    handleDownload, 
    isSceneConnected,
    lastError,
    resetGeneration,
    isGenerating,
  } as const;
}

// User-friendly error messages for domain errors
function getUserFriendlyErrorMessage(code: string, originalMessage?: string): string {
  switch (code) {
    case 'ERR_SCENE_REQUIRED':
      return 'Please add a Scene node to generate video';
    case 'ERR_TOO_MANY_SCENES':
      return 'Only one Scene node allowed - please remove extra Scene nodes';
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
      return originalMessage || 'An error occurred while generating the video';
  }
}