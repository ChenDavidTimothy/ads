"use client";

import { Handle, Position, type NodeProps } from "reactflow";

interface CircleNodeData {
  radius: number;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  position: { x: number; y: number };
}

export function CircleNode({ data, selected }: NodeProps<CircleNodeData>) {
  return (
    <div className={`bg-gray-800 border-2 rounded-lg p-4 min-w-[180px] ${
      selected ? "border-blue-500" : "border-gray-600"
    }`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div 
          className="w-6 h-6 flex items-center justify-center rounded-full text-white font-bold"
          style={{ backgroundColor: data.color }}
        >
          ●
        </div>
        <span className="font-semibold text-white">Circle</span>
      </div>

      {/* Properties Display */}
      <div className="space-y-1 text-xs text-gray-300">
        <div>Radius: {data.radius}px</div>
        <div>Position: ({data.position.x}, {data.position.y})</div>
        <div className="flex items-center gap-2">
          <span>Color:</span>
          <div 
            className="w-4 h-4 rounded-full border border-gray-500"
            style={{ backgroundColor: data.color }}
          />
        </div>
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="object"
        className="w-3 h-3 !bg-blue-500 !border-2 !border-white"
      />
    </div>
  );
}