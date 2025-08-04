"use client";

import { Handle, Position, type NodeProps } from "reactflow";

export interface AnimationTrack {
  id: string;
  type: 'move' | 'rotate' | 'scale' | 'fade' | 'color';
  startTime: number;
  duration: number;
  easing: 'linear' | 'easeInOut' | 'easeIn' | 'easeOut';
  properties: any;
}

interface AnimationNodeData {
  duration: number;
  tracks: AnimationTrack[];
}

interface AnimationNodeProps extends NodeProps<AnimationNodeData> {
  onOpenEditor?: (nodeId: string) => void;
}

export function AnimationNode({ data, selected, id, onOpenEditor }: AnimationNodeProps) {
  const handleDoubleClick = () => {
    if (onOpenEditor && id) {
      onOpenEditor(id);
    }
  };

  const trackCount = data.tracks?.length || 0;
  const trackTypes = data.tracks?.map(t => t.type) || [];
  const uniqueTypes = [...new Set(trackTypes)];

  return (
    <div 
      className={`bg-gray-800 border-2 rounded-lg p-4 min-w-[200px] cursor-pointer transition-all hover:bg-gray-750 ${
        selected ? "border-blue-500" : "border-gray-600"
      }`}
      onDoubleClick={handleDoubleClick}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="object"
        className="w-3 h-3 !bg-purple-500 !border-2 !border-white"
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-purple-600 flex items-center justify-center rounded text-white font-bold text-sm">
            🎬
          </div>
          <span className="font-semibold text-white">Animation</span>
        </div>
        <div className="text-xs text-gray-400">{data.duration}s</div>
      </div>

      {/* Track Summary */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-300">Tracks:</span>
          <span className="text-xs text-white font-medium">{trackCount}</span>
        </div>
        
        {trackCount > 0 && (
          <div className="flex flex-wrap gap-1">
            {uniqueTypes.map((type) => (
              <span
                key={type}
                className={`text-xs px-2 py-1 rounded ${getTrackColor(type)} text-white`}
              >
                {getTrackIcon(type)} {type}
              </span>
            ))}
          </div>
        )}

        {trackCount === 0 && (
          <div className="text-xs text-gray-500 text-center py-2">
            No tracks defined
          </div>
        )}
      </div>

      {/* Double-click hint */}
      <div className="mt-3 pt-2 border-t border-gray-700">
        <div className="text-xs text-gray-400 text-center">
          Double-click to edit timeline
        </div>
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="animation"
        className="w-3 h-3 !bg-purple-500 !border-2 !border-white"
      />
    </div>
  );
}

function getTrackIcon(type: string): string {
  switch (type) {
    case 'move': return '→';
    case 'rotate': return '↻';
    case 'scale': return '⚹';
    case 'fade': return '◐';
    case 'color': return '🎨';
    default: return '•';
  }
}

function getTrackColor(type: string): string {
  switch (type) {
    case 'move': return 'bg-purple-600';
    case 'rotate': return 'bg-indigo-600';
    case 'scale': return 'bg-pink-600';
    case 'fade': return 'bg-yellow-600';
    case 'color': return 'bg-orange-600';
    default: return 'bg-gray-600';
  }
}