// src/components/editor/nodes/scene-node.tsx - Updated with user-defined names
"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { NODE_COLORS } from "@/lib/constants/editor";
import { getNodeDefinition } from "@/lib/types/node-definitions";
import type { SceneNodeData } from "@/lib/types/nodes";

export function SceneNode({ data, selected }: NodeProps<SceneNodeData>) {
  const nodeDefinition = getNodeDefinition('scene');
  const displayName = data.userDefinedName || "Scene";
  
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

  return (
    <Card selected={selected} className="p-4 min-w-[220px]">
      {nodeDefinition?.ports.inputs.map((port, index) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          className={`w-3 h-3 ${NODE_COLORS.scene.handle} !border-2 !border-white`}
          style={{ top: `${50 + (index * 20)}%` }}
        />
      ))}

      <CardHeader className="p-0 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gray-600 flex items-center justify-center rounded text-white font-bold text-sm">
            🎬
          </div>
          <span className="font-semibold text-white">{displayName}</span>
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-2 text-xs text-gray-300">
        <div className="flex items-center justify-between">
          <span>Resolution:</span>
          <span className="text-white font-medium">
            {getResolutionLabel(data.width, data.height)} ({data.width}×{data.height})
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span>Frame Rate:</span>
          <span className="text-white font-medium">{data.fps} FPS</span>
        </div>

        <div className="flex items-center justify-between">
          <span>Duration:</span>
          <span className="text-white font-medium">{data.duration}s</span>
        </div>

        <div className="flex items-center justify-between">
          <span>Background:</span>
          <div className="flex items-center gap-2">
            <div 
              className="w-4 h-4 rounded border border-gray-500"
              style={{ backgroundColor: data.backgroundColor }}
            />
            <span className="text-white font-medium text-xs">
              {data.backgroundColor.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span>Quality:</span>
          <span className="text-white font-medium">
            {getQualityLabel(data.videoCrf)} ({data.videoPreset})
          </span>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-600">
          <div className="text-xs text-gray-400 text-center">
            Final Video Output
          </div>
          <div className="text-xs text-green-400 text-center mt-1">
            {data.width}×{data.height} @ {data.fps}fps
          </div>
        </div>
      </CardContent>
    </Card>
  );
}