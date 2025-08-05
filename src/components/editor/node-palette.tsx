"use client";

import { type XYPosition } from "reactflow";
import { Button } from "@/components/ui/button";
import { NODE_COLORS } from "@/lib/constants/editor";

interface NodePaletteProps {
  onAddNode: (nodeType: string, position: XYPosition) => void;
}

export function NodePalette({ onAddNode }: NodePaletteProps) {
  const geometryNodes = [
    { type: "triangle", label: "Triangle", icon: "▲" },
    { type: "circle", label: "Circle", icon: "●" },
    { type: "rectangle", label: "Rectangle", icon: "▬" },
  ];

  const timingNodes = [
    { type: "insert", label: "Insert", icon: "⏰" },
  ];

  const animationNodes = [
    { type: "animation", label: "Animation", icon: "🎬" },
  ];

  const utilityNodes = [
    { type: "scene", label: "Scene", icon: "🎭" },
  ];

  const handleNodeClick = (nodeType: string) => {
    onAddNode(nodeType, { x: 250, y: 250 });
  };

  return (
    <div className="w-64 bg-gray-800 border-r border-gray-600 p-4 overflow-y-auto">
      <h2 className="text-xl font-bold text-white mb-6">Node Palette</h2>
      
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wide">
          Geometry
        </h3>
        <div className="space-y-2">
          {geometryNodes.map((node) => (
            <Button
              key={node.type}
              onClick={() => handleNodeClick(node.type)}
              className={`w-full justify-start gap-3 ${NODE_COLORS[node.type as keyof typeof NODE_COLORS].primary} hover:opacity-90`}
              size="md"
            >
              <span className="text-lg">{node.icon}</span>
              <span>{node.label}</span>
            </Button>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wide">
          Timing
        </h3>
        <div className="space-y-2">
          {timingNodes.map((node) => (
            <Button
              key={node.type}
              onClick={() => handleNodeClick(node.type)}
              className={`w-full justify-start gap-3 ${NODE_COLORS[node.type as keyof typeof NODE_COLORS].primary} hover:opacity-90`}
              size="md"
            >
              <span className="text-lg">{node.icon}</span>
              <span>{node.label}</span>
            </Button>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wide">
          Animation
        </h3>
        <div className="space-y-2">
          {animationNodes.map((node) => (
            <Button
              key={node.type}
              onClick={() => handleNodeClick(node.type)}
              className={`w-full justify-start gap-3 ${NODE_COLORS[node.type as keyof typeof NODE_COLORS].primary} hover:opacity-90`}
              size="md"
            >
              <span className="text-lg">{node.icon}</span>
              <span>{node.label}</span>
            </Button>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wide">
          Output
        </h3>
        <div className="space-y-2">
          {utilityNodes.map((node) => (
            <Button
              key={node.type}
              onClick={() => handleNodeClick(node.type)}
              className={`w-full justify-start gap-3 ${NODE_COLORS[node.type as keyof typeof NODE_COLORS].primary} hover:opacity-90`}
              size="md"
            >
              <span className="text-lg">{node.icon}</span>
              <span>{node.label}</span>
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-8 p-3 bg-gray-700 rounded-lg">
        <h4 className="text-sm font-semibold text-white mb-2">Flow</h4>
        <ul className="text-xs text-gray-300 space-y-1">
          <li>• Geometry → Insert → Animation</li>
          <li>• Set appearance timing</li>
          <li>• Build animation sequences</li>
          <li>• Connect to scene output</li>
        </ul>
      </div>
    </div>
  );
}