// src/components/workspace/flow/hooks/use-generation-service.ts
import { useCallback } from 'react';
import { useReactFlow } from 'reactflow';
import { useRouter } from 'next/navigation';
import { api } from '@/trpc/react';
import { useNotifications } from '@/hooks/use-notifications';
import { createBrowserClient } from '@/utils/supabase/client';
import type { NodeData } from '@/shared/types';

type RFNode<T = NodeData> = { id: string; type?: string; position: { x: number; y: number }; data: T };
type RFEdge = { id: string; source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null };

// ==================== SHARED GENERATION SERVICE HOOK ====================

export function useGenerationService() {
  const { getNodes, getEdges } = useReactFlow();
  const { toast } = useNotifications();
  const router = useRouter();

  // ==================== SHARED PREPROCESSING ====================
  
  const preprocessFlow = useCallback(() => {
    const nodes = getNodes() as RFNode<NodeData>[];
    const edges = getEdges() as RFEdge[];
    
    return {
      nodes: nodes.map((node) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data,
      })),
      edges: edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle ?? undefined,
        targetHandle: edge.targetHandle ?? undefined,
      }))
    };
  }, [getNodes, getEdges]);

  // ==================== SHARED AUTH CHECK ====================
  
  const checkAuth = useCallback(async () => {
    const supabase = createBrowserClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      toast.warning('Please log in', 'Authentication required for generation');
      router.push('/login');
      return false;
    }
    
    return true;
  }, [toast, router]);

  // ==================== SHARED ERROR HANDLING ====================
  
  const handleGenerationError = useCallback((error: unknown, action: string) => {
    console.error(`${action} error:`, error);
    
    // Errors are handled in mutation callbacks via the shared service
    // This is just for client-side logging and debugging
  }, []);

  return {
    preprocessFlow,
    checkAuth,
    handleGenerationError
  };
}

// ==================== INDIVIDUAL GENERATION HOOK (OPTIMIZED) ====================

export function useIndividualGeneration() {
  const { preprocessFlow, checkAuth, handleGenerationError } = useGenerationService();
  const { toast } = useNotifications();
  
  // Mutations using the optimized backend
  const generateSceneMutation = api.animation.generateSceneNode.useMutation({
    onSuccess: (data) => {
      if (data.success && data.videoUrl) {
        toast.success('Scene generated successfully!');
      } else if (data.success && data.jobId) {
        toast.info('Scene generation started', 'Your video is being processed');
      }
    },
    onError: (error) => {
      toast.error('Scene generation failed', error.message);
    }
  });

  const generateFrameMutation = api.animation.generateFrameNode.useMutation({
    onSuccess: (data) => {
      if (data.success && data.imageUrl) {
        toast.success('Frame generated successfully!');
      } else if (data.success && data.jobId) {
        toast.info('Frame generation started', 'Your image is being processed');
      }
    },
    onError: (error) => {
      toast.error('Frame generation failed', error.message);
    }
  });

  // ==================== OPTIMIZED GENERATION FUNCTIONS ====================
  
  const generateSceneNode = useCallback(async (reactFlowNodeId: string) => {
    try {
      const authenticated = await checkAuth();
      if (!authenticated) return;

      const { nodes, edges } = preprocessFlow();
      
      await generateSceneMutation.mutateAsync({
        nodes,
        edges,
        targetSceneNodeId: reactFlowNodeId,
      });
      
    } catch (error) {
      handleGenerationError(error, 'Scene generation');
    }
  }, [checkAuth, preprocessFlow, generateSceneMutation, handleGenerationError]);

  const generateFrameNode = useCallback(async (reactFlowNodeId: string) => {
    try {
      const authenticated = await checkAuth();
      if (!authenticated) return;

      const { nodes, edges } = preprocessFlow();
      
      await generateFrameMutation.mutateAsync({
        nodes,
        edges,
        targetFrameNodeId: reactFlowNodeId,
      });
      
    } catch (error) {
      handleGenerationError(error, 'Frame generation');
    }
  }, [checkAuth, preprocessFlow, generateFrameMutation, handleGenerationError]);

  return {
    generateSceneNode,
    generateFrameNode,
    isGeneratingScene: generateSceneMutation.isPending,
    isGeneratingFrame: generateFrameMutation.isPending,
    isGenerating: generateSceneMutation.isPending || generateFrameMutation.isPending,
  };
}

// ==================== BULK GENERATION HOOK (OPTIMIZED) ====================

export function useBulkGeneration() {
  const { preprocessFlow, checkAuth, handleGenerationError } = useGenerationService();
  const { toast } = useNotifications();

  // Mutations using the optimized backend
  const generateScenesMutation = api.animation.generateScene.useMutation({
    onSuccess: (data) => {
      if (data.success && data.videoUrl) {
        toast.success('Video generated successfully!');
      } else if (data.success && data.jobIds) {
        toast.info(`${data.totalScenes} scenes queued`, 'Your videos are being processed');
      }
    },
    onError: (error) => {
      toast.error('Video generation failed', error.message);
    }
  });

  const generateImagesMutation = api.animation.generateImage.useMutation({
    onSuccess: (data) => {
      if (data.success && data.imageUrl) {
        toast.success('Image generated successfully!');
      } else if (data.success && data.jobIds) {
        toast.info(`${data.totalFrames} frames queued`, 'Your images are being processed');
      }
    },
    onError: (error) => {
      toast.error('Image generation failed', error.message);
    }
  });

  // ==================== OPTIMIZED GENERATION FUNCTIONS ====================
  
  const generateAllScenes = useCallback(async (config?: Record<string, unknown>) => {
    try {
      const authenticated = await checkAuth();
      if (!authenticated) return;

      const { nodes, edges } = preprocessFlow();
      
      await generateScenesMutation.mutateAsync({
        nodes,
        edges,
        config,
      });
      
    } catch (error) {
      handleGenerationError(error, 'Bulk scene generation');
    }
  }, [checkAuth, preprocessFlow, generateScenesMutation, handleGenerationError]);

  const generateAllImages = useCallback(async () => {
    try {
      const authenticated = await checkAuth();
      if (!authenticated) return;

      const { nodes, edges } = preprocessFlow();
      
      await generateImagesMutation.mutateAsync({
        nodes,
        edges,
      });
      
    } catch (error) {
      handleGenerationError(error, 'Bulk image generation');
    }
  }, [checkAuth, preprocessFlow, generateImagesMutation, handleGenerationError]);

  return {
    generateAllScenes,
    generateAllImages,
    isGeneratingScenes: generateScenesMutation.isPending,
    isGeneratingImages: generateImagesMutation.isPending,
    isGenerating: generateScenesMutation.isPending || generateImagesMutation.isPending,
  };
}

// ==================== ENHANCED SCENE NODE COMPONENT ====================

export function useSceneNodeGeneration(sceneNodeId: string) {
  const { generateSceneNode, isGeneratingScene } = useIndividualGeneration();
  
  const handleGenerateThis = useCallback(() => {
    generateSceneNode(sceneNodeId);
  }, [generateSceneNode, sceneNodeId]);

  return {
    handleGenerateThis,
    isGeneratingScene,
  };
}

// ==================== ENHANCED FRAME NODE COMPONENT ====================

export function useFrameNodeGeneration(frameNodeId: string) {
  const { generateFrameNode, isGeneratingFrame } = useIndividualGeneration();
  
  const handleGenerateThis = useCallback(() => {
    generateFrameNode(frameNodeId);
  }, [generateFrameNode, frameNodeId]);

  return {
    handleGenerateThis,
    isGeneratingFrame,
  };
}
