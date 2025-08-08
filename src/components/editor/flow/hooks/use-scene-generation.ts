// src/components/editor/flow/hooks/useSceneGeneration.ts
import { useCallback, useMemo, useState } from 'react';
import type { Edge, Node } from 'reactflow';
import { api } from '@/trpc/react';
import { useNotifications } from '@/hooks/use-notifications';
import { extractDomainError } from '@/shared/errors/client';
import type { NodeData, SceneNodeData } from '@/shared/types';
import type { SceneConfig } from '../types';

export function useSceneGeneration(nodes: Node<NodeData>[], edges: Edge[]) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const { toast } = useNotifications();

  const generateScene = api.animation.generateScene.useMutation({
    onSuccess: (data) => {
      setVideoUrl(data.videoUrl);
      toast.success('Video generated successfully!');
    },
    onError: (error) => {
      console.error('Scene generation failed:', error);
      const domain = extractDomainError(error);
      if (domain?.code) {
        toast.error('Cannot generate yet', domain.message ?? 'A validation error occurred');
      } else {
        toast.error('Video generation failed', error.message);
      }
    },
  });

  const isSceneConnected = useMemo(() => {
    const sceneNode = nodes.find((n) => n.type === 'scene');
    if (!sceneNode) return false;
    return edges.some((edge) => edge.target === sceneNode.data.identifier.id);
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

  const handleGenerateScene = useCallback(() => {
    try {
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
  }, [nodes, edges, generateScene, validateSceneNodes, toast]);

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


