"use client";

import { type XYPosition } from "reactflow";

interface NodePaletteProps {
  onAddNode: (nodeType: string, position: XYPosition) => void;
}

export function NodePalette({ onAddNode }: NodePaletteProps) {
  const geometryNodes = [
    { type: "triangle", label: "Triangle", icon: "▲", color: "bg-red-600" },
    { type: "circle", label: "Circle", icon: "●", color: "bg-blue-600" },
    { type: "rectangle", label: "Rectangle", icon: "▬", color: "bg-green-600" },
  ];

  const animationNodes = [
    { type: "animation", label: "Animation", icon: "🎬", color: "bg-purple-600" },
  ];

  const utilityNodes = [
    { type: "scene", label: "Scene", icon: "🎭", color: "bg-gray-600" },
  ];

  const handleNodeClick = (nodeType: string) => {
    onAddNode(nodeType, { x: 250, y: 250 });
  };

  return (
    <div className="w-64 bg-gray-800 border-r border-gray-600 p-4 overflow-y-auto">
      <h2 className="text-xl font-bold text-white mb-6">Node Palette</h2>
      
      {/* Geometry Nodes */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wide">
          Geometry
        </h3>
        <div className="space-y-2">
          {geometryNodes.map((node) => (
            <button
              key={node.type}
              onClick={() => handleNodeClick(node.type)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg ${node.color} hover:opacity-90 transition-opacity text-white font-medium`}
            >
              <span className="text-lg">{node.icon}</span>
              <span>{node.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Animation Nodes */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wide">
          Animation
        </h3>
        <div className="space-y-2">
          {animationNodes.map((node) => (
            <button
              key={node.type}
              onClick={() => handleNodeClick(node.type)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg ${node.color} hover:opacity-90 transition-opacity text-white font-medium`}
            >
              <span className="text-lg">{node.icon}</span>
              <span>{node.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Scene Nodes */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wide">
          Output
        </h3>
        <div className="space-y-2">
          {utilityNodes.map((node) => (
            <button
              key={node.type}
              onClick={() => handleNodeClick(node.type)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg ${node.color} hover:opacity-90 transition-opacity text-white font-medium`}
            >
              <span className="text-lg">{node.icon}</span>
              <span>{node.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-8 p-3 bg-gray-700 rounded-lg">
        <h4 className="text-sm font-semibold text-white mb-2">How to Use</h4>
        <ul className="text-xs text-gray-300 space-y-1">
          <li>• Add geometry shapes</li>
          <li>• Connect to animation nodes</li>
          <li>• Build internal timelines</li>
          <li>• Connect to scene output</li>
        </ul>
      </div>
    </div>
  );
}