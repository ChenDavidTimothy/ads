// src/components/workspace/nodes/animation-node.tsx - Simplified single input/output ports
"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { TRACK_COLORS, TRACK_ICONS } from "@/shared/registry/registry-utils";
import { getNodeDefinition } from "@/shared/registry/registry-utils";
import type { AnimationNodeData } from "@/shared/types/nodes";

export function AnimationNode({ data, selected }: NodeProps<AnimationNodeData>) {
  const nodeDefinition = getNodeDefinition('animation');
  
  const handleDoubleClick = () => {
    // Navigate to dedicated timeline editor page with workspace preserved via query param
    const params = new URLSearchParams(window.location.search);
    const workspaceId = params.get('workspace');
    const target = `/workspace/timeline/${data.identifier.id}${workspaceId ? `?workspace=${workspaceId}` : ''}`;
    window.location.href = target;
  };

  const trackCount = data.tracks?.length || 0;
  const trackTypes = data.tracks?.map(t => t.type) || [];
  const uniqueTypes = [...new Set(trackTypes)];

  return (
    <Card 
      selected={selected} 
      className="p-4 min-w-[200px] cursor-pointer transition-all hover:bg-gray-750" 
      onDoubleClick={handleDoubleClick}
    >
      {/* Single input port */}
      {nodeDefinition?.ports.inputs.map((port) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          className={`w-3 h-3 ${nodeDefinition?.rendering.colors.handle ?? 'bg-gray-500'} !border-2 !border-white`}
          style={{ top: `50%` }}
        />
      ))}

      <CardHeader className="p-0 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-6 h-6 bg-purple-600 flex items-center justify-center rounded text-white font-bold text-sm">
              🎬
            </div>
            <span className="font-semibold text-white">
              {data.identifier.displayName}
            </span>
          </div>
          <div className="text-xs text-gray-400">{data.duration}s</div>
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-300">Tracks:</span>
          <span className="text-xs text-white font-medium">{trackCount}</span>
        </div>
        
        {trackCount > 0 && (
          <div className="flex flex-wrap gap-1">
            {uniqueTypes.map((type) => (
              <span
                key={type}
                className={`text-xs px-2 py-1 rounded ${TRACK_COLORS[type]} text-white`}
              >
                {TRACK_ICONS[type]} {type}
              </span>
            ))}
          </div>
        )}

        {trackCount === 0 && (
          <div className="text-xs text-gray-500 text-center py-2">
            No tracks defined
          </div>
        )}

        <div className="mt-3 pt-2 border-t border-gray-700">
          <div className="text-xs text-gray-400 text-center">
            Double-click to edit timeline
          </div>
        </div>
      </CardContent>

      {/* Single output port */}
      {nodeDefinition?.ports.outputs.map((port) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          className={`w-3 h-3 ${nodeDefinition?.rendering.colors.handle ?? 'bg-gray-500'} !border-2 !border-white`}
          style={{ top: `50%` }}
        />
      ))}
    </Card>
  );
}