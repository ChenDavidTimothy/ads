// src/components/workspace/nodes/scene-node.tsx - Simplified single input port
"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getNodeDefinition } from "@/shared/registry/registry-utils";
import type { SceneNodeData } from "@/shared/types/nodes";
import { MonitorPlay, Play } from "lucide-react";
import { useIndividualGeneration } from "../flow/hooks/use-generation-service";
import { usePreviewContext } from "../flow/hooks/use-preview-context";

export function SceneNode({ data, selected, id }: NodeProps<SceneNodeData>) {
  const nodeDefinition = getNodeDefinition('scene');
  const { generateSceneNode, isGeneratingScene } = useIndividualGeneration();
  const previewContext = usePreviewContext();
  
  const getResolutionLabel = (width: number, height: number) => {
    if (width === 1920 && height === 1080) return "FHD";
    if (width === 1280 && height === 720) return "HD";
    if (width === 3840 && height === 2160) return "4K";
    if (width === 1080 && height === 1080) return "Square";
    return "Custom";
  };

  const getQualityLabel = (crf: number) => {
    if (crf <= 18) return "High";
    if (crf <= 28) return "Medium";
    return "Low";
  };

  // PERFORMANCE OPTIMIZATION: Direct call with React Flow ID + preview context
  const handleGenerateThis = () => {
    generateSceneNode(id, previewContext);
  };

  const handleClass = "bg-[var(--node-output)]";

  return (
    <Card selected={selected} className="p-[var(--card-padding)] min-w-[var(--node-min-width)]">
      {/* Single input port */}
      {nodeDefinition?.ports.inputs.map((port) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          className={`w-3 h-3 ${handleClass} !border-2 !border-[var(--text-primary)]`}
          style={{ top: `50%` }}
        />
      ))}

      <CardHeader className="p-0 pb-[var(--space-3)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <div className="w-6 h-6 bg-[var(--node-output)] flex items-center justify-center rounded text-[var(--text-primary)]">
            <MonitorPlay size={12} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[var(--text-primary)] truncate">
              {data.identifier.displayName}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-2 text-xs text-[var(--text-secondary)]">
        <div className="flex items-center justify-between">
          <span>Resolution</span>
          <span className="text-[var(--text-primary)] font-medium">
            {getResolutionLabel(data.width, data.height)} ({data.width}×{data.height})
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span>Frame Rate</span>
          <span className="text-[var(--text-primary)] font-medium">{data.fps} FPS</span>
        </div>

        <div className="flex items-center justify-between">
          <span>Duration</span>
          <span className="text-[var(--text-primary)] font-medium">{data.duration}s</span>
        </div>

        <div className="flex items-center justify-between">
          <span>Background</span>
          <div className="flex items-center gap-[var(--space-2)]">
            <div 
              className="w-4 h-4 rounded border border-[var(--border-primary)]"
              style={{ backgroundColor: data.backgroundColor }}
            />
            <span className="text-[var(--text-primary)] font-medium text-xs">
              {data.backgroundColor.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span>Quality</span>
          <span className="text-[var(--text-primary)] font-medium">
            {getQualityLabel(data.videoCrf)} ({data.videoPreset})
          </span>
        </div>

        <div className="mt-4 pt-3 border-t border-[var(--border-primary)]">
          <div className="text-xs text-[var(--text-tertiary)] text-center">
            {data.width}×{data.height} @ {data.fps}fps
          </div>
        </div>

        {/* NEW: Individual generation button (minimal addition) */}
        <Button
          onClick={handleGenerateThis}
          disabled={isGeneratingScene}
          variant="success"
          size="sm"
          className="w-full mt-2"
        >
          <Play size={12} className="mr-1" />
          {isGeneratingScene ? 'Generating...' : 'Generate This Scene'}
        </Button>
      </CardContent>
    </Card>
  );
}