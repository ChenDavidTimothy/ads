// src/components/workspace/node-palette.tsx - Registry-driven node palette
"use client";

import { type XYPosition } from "reactflow";
import { Button } from "@/components/ui/button";
import { generateNodeColors, generateNodePalette } from "@/shared/registry/registry-utils";

interface NodePaletteProps {
  onAddNode: (nodeType: string, position: XYPosition) => void;
}

export function NodePalette({ onAddNode }: NodePaletteProps) {
  // Generate palette structure from registry
  const palette = generateNodePalette();
  const nodeColors = generateNodeColors();

  const handleNodeClick = (nodeType: string) => {
    onAddNode(nodeType, { x: 250, y: 250 });
  };

  const renderNodeSection = (
    title: string,
    nodes: Array<{ type: string; label: string; icon: string }>
  ) => {
    if (nodes.length === 0) return null;

    return (
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wide">
          {title}
        </h3>
        <div className="space-y-2">
          {nodes.map((node) => (
            <Button
              key={node.type}
              onClick={() => handleNodeClick(node.type)}
              className={`w-full justify-start gap-3 ${nodeColors[node.type]?.primary ?? 'bg-gray-600'} hover:opacity-90`}
              size="md"
            >
              <span className="text-lg">{node.icon}</span>
              <span>{node.label}</span>
            </Button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="w-64 bg-gray-800 border-r border-gray-600 p-4 overflow-y-auto">
      <h2 className="text-xl font-bold text-white mb-6">Node Palette</h2>
      
      {renderNodeSection("Geometry", palette.geometryNodes)}
      {renderNodeSection("Timing", palette.timingNodes)}
      {renderNodeSection("Logic", palette.logicNodes)}
      {renderNodeSection("Animation", palette.animationNodes)}
      {renderNodeSection("Output", palette.outputNodes)}

      <div className="mt-8 p-3 bg-gray-700 rounded-lg">
        <h4 className="text-sm font-semibold text-white mb-2">Flow</h4>
        <ul className="text-xs text-gray-300 space-y-1">
          <li>• Geometry → Insert → Animation</li>
          <li>• Filter objects at any stage</li>
          <li>• Set appearance timing</li>
          <li>• Build animation sequences</li>
          <li>• Connect to scene output</li>
        </ul>
      </div>
    </div>
  );
}