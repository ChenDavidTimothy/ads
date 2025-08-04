"use client";

import { Handle, Position, type NodeProps } from "reactflow";

interface RectangleNodeData {
  width: number;
  height: number;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  position: { x: number; y: number };
}

export function RectangleNode({ data, selected }: NodeProps<RectangleNodeData>) {
  return (
    <div className={`bg-gray-800 border-2 rounded-lg p-4 min-w-[180px] ${
      selected ? "border-blue-500" : "border-gray-600"
    }`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div 
          className="w-6 h-4 flex items-center justify-center rounded text-white font-bold text-xs"
          style={{ backgroundColor: data.color }}
        >
          ▬
        </div>
        <span className="font-semibold text-white">Rectangle</span>
      </div>

      {/* Properties Display */}
      <div className="space-y-1 text-xs text-gray-300">
        <div>Size: {data.width}×{data.height}px</div>
        <div>Position: ({data.position.x}, {data.position.y})</div>
        <div className="flex items-center gap-2">
          <span>Color:</span>
          <div 
            className="w-4 h-4 rounded border border-gray-500"
            style={{ backgroundColor: data.color }}
          />
        </div>
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="object"
        className="w-3 h-3 !bg-green-500 !border-2 !border-white"
      />
    </div>
  );
}