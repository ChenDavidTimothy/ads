import { useCallback, useMemo, useState } from 'react';
// Minimal local types to avoid dependency on reactflow types at build time
type RFEdge = { id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string };
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
  const { toast } = useNotifications();
  const router = useRouter();
  const utils = api.useUtils();

  const generateScene = api.animation.generateScene.useMutation({
    onSuccess: (data: { jobId: string } | { videoUrl: string }) => {
      // Backward-compatible: support immediate videoUrl or new async jobId flow
      if ('videoUrl' in data && data.videoUrl) {
        setVideoUrl(data.videoUrl);
        toast.success('Video generated successfully!');
        return;
      }
      const jobId = 'jobId' in data ? data.jobId : null;
      if (!jobId) return;
      // Start polling job status until completed/failed
      const poll = async () => {
        try {
          const res = await utils.animation.getRenderJobStatus.fetch({ jobId });
          if (res.status === 'completed' && res.videoUrl) {
            setVideoUrl(res.videoUrl);
            toast.success('Video generated successfully!');
            return; // stop polling
          }
          if (res.status === 'failed') {
            toast.error('Video generation failed', res.error ?? 'Unknown error');
            return;
          }
          setTimeout(poll, 1500);
        } catch (e) {
          // keep trying for transient issues
          setTimeout(poll, 2000);
        }
      };
      void poll();
    },
    onError: (error: unknown) => {
      const domain = extractDomainError(error);
      if (domain?.code) {
        toast.error('Cannot generate yet', domain.message ?? 'A validation error occurred');
      } else {
        const message = error instanceof Error ? error.message : 'Unknown error';
        toast.error('Video generation failed', message);
      }
    },
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
    return hasScene && isSceneConnected;
  }, [nodes, isSceneConnected]);

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
    try {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('Please log in to generate a video');
        router.push('/auth');
        return;
      }

      const sceneNode = validateSceneNodes();
      const sceneData = sceneNode.data as unknown as SceneNodeData;
      const config: Partial<SceneConfig> = {
        width: sceneData.width,
        height: sceneData.height,
        fps: sceneData.fps,
        backgroundColor: sceneData.backgroundColor,
        videoPreset: sceneData.videoPreset,
        videoCrf: sceneData.videoCrf,
      };

      setVideoUrl(null);

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
      toast.error('Generation failed', error instanceof Error ? error.message : 'Unknown error');
    }
  }, [nodes, edges, generateScene, validateSceneNodes, toast, router]);

  const handleDownload = useCallback(() => {
    if (!videoUrl) return;
    const link = document.createElement('a');
    link.href = videoUrl;
    link.download = `animation_${Date.now()}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [videoUrl]);

  return { videoUrl, canGenerate, generateScene, handleGenerateScene, handleDownload, isSceneConnected } as const;
}