"use client";

import { Handle, Position, type NodeProps } from "reactflow";

interface SceneNodeData {
  duration: number;
  backgroundColor: string;
}

export function SceneNode({ data, selected }: NodeProps<SceneNodeData>) {
  return (
    <div className={`bg-gray-800 border-2 rounded-lg p-4 min-w-[200px] ${
      selected ? "border-blue-500" : "border-gray-600"
    }`}>
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="animations"
        className="w-3 h-3 !bg-gray-500 !border-2 !border-white"
        style={{ top: "50%" }}
      />

      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 bg-gray-600 flex items-center justify-center rounded text-white font-bold text-sm">
          🎬
        </div>
        <span className="font-semibold text-white">Scene</span>
      </div>

      {/* Properties Display */}
      <div className="space-y-1 text-xs text-gray-300">
        <div>Duration: {data.duration}s</div>
        <div className="flex items-center gap-2">
          <span>Background:</span>
          <div 
            className="w-4 h-4 rounded border border-gray-500"
            style={{ backgroundColor: data.backgroundColor }}
          />
        </div>
      </div>

      {/* Output Display */}
      <div className="mt-3 pt-3 border-t border-gray-600">
        <div className="text-xs text-gray-400">
          Final Scene Output
        </div>
      </div>
    </div>
  );
}