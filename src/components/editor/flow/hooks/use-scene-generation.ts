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

// Backend graceful error response type
interface ValidationError {
  type: 'error' | 'warning';
  code: string;
  message: string;
  suggestions?: string[];
  nodeId?: string;
  nodeName?: string;
}

interface GracefulErrorResponse {
  success: false;
  errors: ValidationError[];
  canRetry: boolean;
}

interface SuccessResponse {
  success: true;
  videoUrl?: string;
  jobId?: string;
  scene: unknown;
  config: unknown;
}

type GenerationResponse = GracefulErrorResponse | SuccessResponse;

export function useSceneGeneration(nodes: RFNode<NodeData>[], edges: RFEdge[]) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
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

  // Simplified auth state monitoring - remove complex interval logic that causes memory leaks
  useEffect(() => {
    // Remove complex auth monitoring that was causing memory leaks
    // Basic auth check only when needed, no intervals
    return () => {
      // Cleanup any auth-related listeners if needed
    };
  }, []);

  const generateScene = api.animation.generateScene.useMutation({
    onMutate: () => {
      setIsGenerating(true);
      setLastError(null);
      setValidationErrors([]);
      setVideoUrl(null);
      generationAttemptRef.current += 1;
      console.log(`[GENERATION] Starting attempt #${generationAttemptRef.current}`);
    },
    onSuccess: (data: GenerationResponse) => {
      const currentAttempt = generationAttemptRef.current;
      console.log(`[GENERATION] Success response for attempt #${currentAttempt}:`, data);
      
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
      
      const jobId = 'jobId' in data ? data.jobId : null;
      if (!jobId) {
        setIsGenerating(false);
        setLastError('Invalid response from server');
        toast.error('Generation failed', 'Invalid response from server');
        return;
      }
      
      // Start polling job status with timeout and retry logic
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
              setLastError(res.error || 'Generation failed on server');
              toast.error('Video generation failed', res.error || 'Unknown server error');
            }
            return;
          }
          
          if (pollAttempts < maxPollAttempts) {
            const delay = Math.min(1000 + (pollAttempts * 100), 4000);
            pollTimeoutRef.current = setTimeout(poll, delay);
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

      const sceneNode = validateSceneNodes();
      const sceneData = sceneNode.data as unknown as SceneNodeData;
      const config: Partial<SceneConfig> = {
        width: sceneData.width,
        height: sceneData.height,
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
      primaryError: errors[0] || null,
      allSuggestions: [...errors, ...warnings].flatMap(e => e.suggestions || [])
    };
  }, [validationErrors]);

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