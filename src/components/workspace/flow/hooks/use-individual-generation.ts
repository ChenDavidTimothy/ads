import { useCallback } from 'react';
import { useReactFlow } from 'reactflow';
import { api } from '@/trpc/react';
import { useNotifications } from '@/hooks/use-notifications';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/utils/supabase/client';
import type { NodeData } from '@/shared/types';

// Minimal types (reuse pattern from existing hooks)
type RFEdge = { 
  id: string; 
  source: string; 
  target: string; 
  sourceHandle?: string | null; 
  targetHandle?: string | null 
};
type RFNode<T> = { 
  id: string; 
  type?: string; 
  position: { x: number; y: number }; 
  data: T 
};

export function useIndividualGeneration() {
  const { getNodes, getEdges } = useReactFlow();
  const { toast } = useNotifications();
  const router = useRouter();
  
  // PERFORMANCE OPTIMIZATION: Reuse existing polling infrastructure
  const utils = api.useUtils();

  // High-performance scene generation mutation
  const generateSceneMutation = api.animation.generateSceneNode.useMutation({
    onSuccess: async (data) => {
      if (!data.success) {
        const errorMessages = data.errors?.filter(e => e.type === 'error') ?? [];
        if (errorMessages.length > 0) {
          const primaryError = errorMessages[0];
          toast.error('Cannot generate scene', primaryError?.message || 'Unknown error');
        }
        return;
      }
      
      if ('videoUrl' in data && data.videoUrl) {
        // Immediate preview available
        toast.success('Scene generated successfully!', 'Opening preview...');
        
        // PERFORMANCE OPTIMIZATION: Show preview in new tab instead of auto-download
        window.open(data.videoUrl, '_blank');
      } else if ('jobId' in data && data.jobId) {
        // Job is still processing, start polling
        toast.success('Scene generation started', 'Processing your video...');
        startIndividualJobPolling(data.jobId, 'scene');
      }
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : 'Scene generation failed';
      if (errorMessage.includes('UNAUTHORIZED') || errorMessage.includes('401')) {
        toast.warning('Please log in', 'Your session has expired');
        router.push('/login');
        return;
      }
      toast.error('Scene generation failed', errorMessage);
    },
  });

  // High-performance frame generation mutation
  const generateFrameMutation = api.animation.generateFrameNode.useMutation({
    onSuccess: async (data) => {
      if (!data.success) {
        const errorMessages = data.errors?.filter(e => e.type === 'error') ?? [];
        if (errorMessages.length > 0) {
          const primaryError = errorMessages[0];
          toast.error('Cannot generate frame', primaryError?.message || 'Unknown error');
        }
        return;
      }
      
      if ('imageUrl' in data && data.imageUrl) {
        // Immediate preview available
        toast.success('Frame generated successfully!', 'Opening preview...');
        
        // PERFORMANCE OPTIMIZATION: Show preview in new tab instead of auto-download
        window.open(data.imageUrl, '_blank');
      } else if ('jobId' in data && data.jobId) {
        // Job is still processing, start polling
        toast.success('Frame generation started', 'Processing your image...');
        startIndividualJobPolling(data.jobId, 'frame');
      }
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : 'Frame generation failed';
      if (errorMessage.includes('UNAUTHORIZED') || errorMessage.includes('401')) {
        toast.warning('Please log in', 'Your session has expired');
        router.push('/login');
        return;
      }
      toast.error('Frame generation failed', errorMessage);
    },
  });

  // PERFORMANCE OPTIMIZATION: Lightweight polling for individual jobs
  const startIndividualJobPolling = useCallback((jobId: string, nodeType: 'scene' | 'frame') => {
    let pollAttempts = 0;
    const maxPollAttempts = 60; // 1 minute polling
    
    const poll = async () => {
      pollAttempts++;
      
      try {
        const supabase = createBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast.warning('Session expired', 'Please log in and try again');
          router.push('/login');
          return;
        }
        
        // PERFORMANCE OPTIMIZATION: Invalidate and fetch in one operation
        await utils.animation.getRenderJobStatus.invalidate({ jobId });
        const res = await utils.animation.getRenderJobStatus.fetch({ jobId });
        
        if (res.status === 'completed' && res.videoUrl) {
          toast.success(
            `${nodeType === 'scene' ? 'Scene' : 'Frame'} generated successfully!`,
            'Opening preview...'
          );
          
          // PERFORMANCE OPTIMIZATION: Show preview in new tab instead of auto-download
          window.open(res.videoUrl, '_blank');
          return;
        }
        
        if (res.status === 'failed') {
          toast.error(
            `${nodeType === 'scene' ? 'Scene' : 'Frame'} generation failed`,
            res.error ?? 'Unknown error occurred'
          );
          return;
        }
        
        // Continue polling if still processing
        if (res.status === 'processing' || res.status === 'queued') {
          if (pollAttempts < maxPollAttempts) {
            setTimeout(poll, 1000);
          } else {
            toast.error('Generation timeout', 'Please check your jobs and try again');
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
        if (pollAttempts < maxPollAttempts) {
          setTimeout(poll, 2000); // Slower retry on error
        } else {
          toast.error('Failed to check generation status', 'Please refresh and try again');
        }
      }
    };
    
    // Start polling with short delay
    setTimeout(poll, 500);
  }, [utils.animation.getRenderJobStatus, toast, router]);

  // PERFORMANCE OPTIMIZATION: Efficient scene generation function
  const generateSceneNode = useCallback(async (reactFlowNodeId: string) => {
    try {
      const supabase = createBrowserClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        toast.warning('Please log in', 'Authentication required to generate scenes');
        router.push('/login');
        return;
      }

      const nodes = getNodes() as RFNode<NodeData>[];
      const edges = getEdges() as RFEdge[];
      
      // PERFORMANCE OPTIMIZATION: Minimal conversion for targeted generation
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
      }));

      await generateSceneMutation.mutateAsync({
        nodes: backendNodes,
        edges: backendEdges,
        targetSceneNodeId: reactFlowNodeId, // React Flow ID
      });
    } catch (error) {
      console.error('Scene generation error:', error);
      // Error handling in mutation callbacks
    }
  }, [getNodes, getEdges, generateSceneMutation, toast, router]);

  // PERFORMANCE OPTIMIZATION: Efficient frame generation function
  const generateFrameNode = useCallback(async (reactFlowNodeId: string) => {
    try {
      const supabase = createBrowserClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        toast.warning('Please log in', 'Authentication required to generate frames');
        router.push('/login');
        return;
      }

      const nodes = getNodes() as RFNode<NodeData>[];
      const edges = getEdges() as RFEdge[];
      
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
      }));

      await generateFrameMutation.mutateAsync({
        nodes: backendNodes,
        edges: backendEdges,
        targetFrameNodeId: reactFlowNodeId, // React Flow ID
      });
    } catch (error) {
      console.error('Frame generation error:', error);
      // Error handling in mutation callbacks
    }
  }, [getNodes, getEdges, generateFrameMutation, toast, router]);

  return {
    generateSceneNode,
    generateFrameNode,
    isGeneratingScene: generateSceneMutation.isPending,
    isGeneratingFrame: generateFrameMutation.isPending,
    isGenerating: generateSceneMutation.isPending || generateFrameMutation.isPending,
  };
}
