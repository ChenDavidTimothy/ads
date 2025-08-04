"use client";

import { Handle, Position, type NodeProps } from "reactflow";

interface ColorNodeData {
  from: string;
  to: string;
  property: "fill" | "stroke";
  startTime: number;
  duration: number;
  easing: string;
}

export function ColorNode({ data, selected }: NodeProps<ColorNodeData>) {
  return (
    <div className={`bg-gray-800 border-2 rounded-lg p-4 min-w-[200px] ${
      selected ? "border-blue-500" : "border-gray-600"
    }`}>
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="object"
        className="w-3 h-3 !bg-orange-500 !border-2 !border-white"
      />

      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 bg-orange-600 flex items-center justify-center rounded text-white font-bold text-sm">
          🎨
        </div>
        <span className="font-semibold text-white">Color</span>
      </div>

      {/* Properties Display */}
      <div className="space-y-1 text-xs text-gray-300">
        <div className="flex items-center gap-2">
          <span>From:</span>
          <div 
            className="w-4 h-4 rounded border border-gray-500"
            style={{ backgroundColor: data.from }}
          />
        </div>
        <div className="flex items-center gap-2">
          <span>To:</span>
          <div 
            className="w-4 h-4 rounded border border-gray-500"
            style={{ backgroundColor: data.to }}
          />
        </div>
        <div>Property: {data.property}</div>
        <div>Time: {data.startTime}s - {data.startTime + data.duration}s</div>
        <div>Easing: {data.easing}</div>
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="animation"
        className="w-3 h-3 !bg-orange-500 !border-2 !border-white"
      />
    </div>
  );
}