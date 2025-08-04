"use client";

import { Handle, Position, type NodeProps } from "reactflow";

interface SceneNodeData {
  // Video Resolution
  width: number;
  height: number;
  
  // Timing
  fps: number;
  duration: number;
  
  // Visual
  backgroundColor: string;
  
  // Export Quality
  videoPreset: string;
  videoCrf: number;
}

export function SceneNode({ data, selected }: NodeProps<SceneNodeData>) {
  // Helper to format resolution display
  const getResolutionLabel = (width: number, height: number) => {
    if (width === 1920 && height === 1080) return "FHD";
    if (width === 1280 && height === 720) return "HD";
    if (width === 3840 && height === 2160) return "4K";
    if (width === 1080 && height === 1080) return "Square";
    return "Custom";
  };

  // Helper to format quality level
  const getQualityLabel = (crf: number) => {
    if (crf <= 18) return "High";
    if (crf <= 28) return "Medium";
    return "Low";
  };

  return (
    <div className={`bg-gray-800 border-2 rounded-lg p-4 min-w-[220px] ${
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

      {/* Video Settings Display */}
      <div className="space-y-2 text-xs text-gray-300">
        {/* Resolution */}
        <div className="flex items-center justify-between">
          <span>Resolution:</span>
          <span className="text-white font-medium">
            {getResolutionLabel(data.width, data.height)} ({data.width}×{data.height})
          </span>
        </div>

        {/* Frame Rate */}
        <div className="flex items-center justify-between">
          <span>Frame Rate:</span>
          <span className="text-white font-medium">{data.fps} FPS</span>
        </div>

        {/* Duration */}
        <div className="flex items-center justify-between">
          <span>Duration:</span>
          <span className="text-white font-medium">{data.duration}s</span>
        </div>

        {/* Background Color */}
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

        {/* Quality Settings */}
        <div className="flex items-center justify-between">
          <span>Quality:</span>
          <span className="text-white font-medium">
            {getQualityLabel(data.videoCrf)} ({data.videoPreset})
          </span>
        </div>
      </div>

      {/* Output Display */}
      <div className="mt-4 pt-3 border-t border-gray-600">
        <div className="text-xs text-gray-400 text-center">
          Final Video Output
        </div>
        <div className="text-xs text-green-400 text-center mt-1">
          {data.width}×{data.height} @ {data.fps}fps
        </div>
      </div>
    </div>
  );
}