"use client";

import { useCallback, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Connection,
  type NodeTypes,
} from "reactflow";
import "reactflow/dist/style.css";

import { TriangleNode } from "./nodes/triangle-node";
import { CircleNode } from "./nodes/circle-node";
import { RectangleNode } from "./nodes/rectangle-node";
import { MoveNode } from "./nodes/move-node";
import { RotateNode } from "./nodes/rotate-node";
import { ScaleNode } from "./nodes/scale-node";
import { FadeNode } from "./nodes/fade-node";
import { ColorNode } from "./nodes/color-node";
import { SceneNode } from "./nodes/scene-node";
import { NodePalette } from "./node-palette";
import { useFlowToScene } from "./hooks/use-flow-to-scene";
import { api } from "@/trpc/react";

const nodeTypes: NodeTypes = {
  triangle: TriangleNode,
  circle: CircleNode,
  rectangle: RectangleNode,
  move: MoveNode,
  rotate: RotateNode,
  scale: ScaleNode,
  fade: FadeNode,
  color: ColorNode,
  scene: SceneNode,
};

export function FlowEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const { convertFlowToScene } = useFlowToScene();

  const generateScene = api.animation.generateScene.useMutation({
    onSuccess: (data) => {
      setVideoUrl(data.videoUrl);
    },
    onError: (error) => {
      console.error("Scene generation failed:", error);
      alert(`Failed to generate scene: ${error.message}`);
    },
  });

  const onConnect = useCallback(
    (params: Connection) => {
      // Validate connection types
      const sourceNode = nodes.find((n) => n.id === params.source);
      const targetNode = nodes.find((n) => n.id === params.target);
      
      if (!sourceNode || !targetNode) return;
      
      // Only allow geometry nodes to connect to animation nodes
      // and animation nodes to connect to scene nodes
      const isValidConnection = 
        (["triangle", "circle", "rectangle"].includes(sourceNode.type!) &&
         ["move", "rotate", "scale", "fade", "color"].includes(targetNode.type!)) ||
        (["move", "rotate", "scale", "fade", "color"].includes(sourceNode.type!) &&
         targetNode.type === "scene");
      
      if (isValidConnection) {
        setEdges((eds) => addEdge(params, eds));
      }
    },
    [nodes, setEdges]
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const handleGenerateScene = useCallback(() => {
    try {
      const scene = convertFlowToScene(nodes, edges);
      if (scene) {
        setVideoUrl(null);
        generateScene.mutate({ scene });
      }
    } catch (error) {
      alert(`Scene generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [nodes, edges, convertFlowToScene, generateScene]);

  const handleDownload = useCallback(() => {
    if (videoUrl) {
      const link = document.createElement('a');
      link.href = videoUrl;
      link.download = `animation_${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [videoUrl]);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId),
    [nodes, selectedNodeId]
  );

  return (
    <div className="flex h-full">
      {/* Node Palette */}
      <NodePalette 
        onAddNode={(nodeType, position) => {
          const newNode: Node = {
            id: `${nodeType}-${Date.now()}`,
            type: nodeType,
            position,
            data: getDefaultNodeData(nodeType),
          };
          setNodes((nds) => [...nds, newNode]);
        }}
      />

      {/* Main Flow Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          className="bg-gray-900"
        >
          <Background color="#374151" />
          <Controls className="bg-gray-800 border-gray-600" />
          <MiniMap 
            className="bg-gray-800 border-gray-600"
            nodeColor="#6366f1"
          />
        </ReactFlow>

        {/* Generation Controls */}
        <div className="absolute top-4 right-4 space-y-2">
          <button
            onClick={handleGenerateScene}
            disabled={generateScene.isPending}
            className="block w-full rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generateScene.isPending ? "Generating..." : "Generate Video"}
          </button>
          
          {videoUrl && (
            <button
              onClick={handleDownload}
              className="block w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Download MP4
            </button>
          )}
        </div>

        {/* Video Preview */}
        {videoUrl && (
          <div className="absolute bottom-4 right-4 w-80">
            <video
              src={videoUrl}
              controls
              autoPlay
              loop
              className="w-full rounded-md border border-gray-600"
            >
              Your browser does not support the video tag.
            </video>
          </div>
        )}
      </div>

      {/* Property Panel */}
      {selectedNode && (
        <div className="w-80 bg-gray-800 border-l border-gray-600 p-4">
          <h3 className="text-lg font-semibold text-white mb-4">
            {selectedNode.type?.charAt(0).toUpperCase()}{selectedNode.type?.slice(1)} Properties
          </h3>
          <NodePropertyPanel 
            node={selectedNode}
            onChange={(newData) => {
              setNodes((nds) =>
                nds.map((node) =>
                  node.id === selectedNode.id
                    ? { ...node, data: { ...node.data, ...newData } }
                    : node
                )
              );
            }}
          />
        </div>
      )}
    </div>
  );
}

function getDefaultNodeData(nodeType: string) {
  switch (nodeType) {
    case "triangle":
      return {
        size: 80,
        color: "#ff4444",
        strokeColor: "#ffffff",
        strokeWidth: 3,
        position: { x: 960, y: 540 },
      };
    case "circle":
      return {
        radius: 50,
        color: "#4444ff",
        strokeColor: "#ffffff",
        strokeWidth: 2,
        position: { x: 960, y: 540 },
      };
    case "rectangle":
      return {
        width: 100,
        height: 60,
        color: "#44ff44",
        strokeColor: "#ffffff",
        strokeWidth: 2,
        position: { x: 960, y: 540 },
      };
    case "move":
      return {
        from: { x: 200, y: 400 },
        to: { x: 1600, y: 400 },
        startTime: 0,
        duration: 3,
        easing: "easeInOut",
      };
    case "rotate":
      return {
        rotations: 2,
        startTime: 0,
        duration: 3,
        easing: "linear",
      };
    case "scale":
      return {
        from: 1,
        to: 1.5,
        startTime: 0,
        duration: 2,
        easing: "easeInOut",
      };
    case "fade":
      return {
        from: 1,
        to: 0.3,
        startTime: 0,
        duration: 2,
        easing: "easeOut",
      };
    case "color":
      return {
        from: "#ff0000",
        to: "#00ff00",
        property: "fill",
        startTime: 0,
        duration: 2,
        easing: "easeInOut",
      };
    case "scene":
      return {
        duration: 4,
        backgroundColor: "#1a1a2e",
      };
    default:
      return {};
  }
}

function NodePropertyPanel({ 
  node, 
  onChange 
}: { 
  node: Node; 
  onChange: (data: any) => void; 
}) {
  const data = node.data;

  switch (node.type) {
    case "triangle":
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Size</label>
            <input
              type="number"
              value={data.size}
              onChange={(e) => onChange({ size: Number(e.target.value) })}
              className="w-full rounded-md bg-gray-700 border-gray-600 text-white px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Color</label>
            <input
              type="color"
              value={data.color}
              onChange={(e) => onChange({ color: e.target.value })}
              className="w-full h-10 rounded-md bg-gray-700 border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Position X</label>
            <input
              type="number"
              value={data.position.x}
              onChange={(e) => onChange({ position: { ...data.position, x: Number(e.target.value) } })}
              className="w-full rounded-md bg-gray-700 border-gray-600 text-white px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Position Y</label>
            <input
              type="number"
              value={data.position.y}
              onChange={(e) => onChange({ position: { ...data.position, y: Number(e.target.value) } })}
              className="w-full rounded-md bg-gray-700 border-gray-600 text-white px-3 py-2"
            />
          </div>
        </div>
      );
    
    case "circle":
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Radius</label>
            <input
              type="number"
              value={data.radius}
              onChange={(e) => onChange({ radius: Number(e.target.value) })}
              className="w-full rounded-md bg-gray-700 border-gray-600 text-white px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Color</label>
            <input
              type="color"
              value={data.color}
              onChange={(e) => onChange({ color: e.target.value })}
              className="w-full h-10 rounded-md bg-gray-700 border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Position X</label>
            <input
              type="number"
              value={data.position.x}
              onChange={(e) => onChange({ position: { ...data.position, x: Number(e.target.value) } })}
              className="w-full rounded-md bg-gray-700 border-gray-600 text-white px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Position Y</label>
            <input
              type="number"
              value={data.position.y}
              onChange={(e) => onChange({ position: { ...data.position, y: Number(e.target.value) } })}
              className="w-full rounded-md bg-gray-700 border-gray-600 text-white px-3 py-2"
            />
          </div>
        </div>
      );
    
    case "rectangle":
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Width</label>
            <input
              type="number"
              value={data.width}
              onChange={(e) => onChange({ width: Number(e.target.value) })}
              className="w-full rounded-md bg-gray-700 border-gray-600 text-white px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Height</label>
            <input
              type="number"
              value={data.height}
              onChange={(e) => onChange({ height: Number(e.target.value) })}
              className="w-full rounded-md bg-gray-700 border-gray-600 text-white px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Color</label>
            <input
              type="color"
              value={data.color}
              onChange={(e) => onChange({ color: e.target.value })}
              className="w-full h-10 rounded-md bg-gray-700 border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Position X</label>
            <input
              type="number"
              value={data.position.x}
              onChange={(e) => onChange({ position: { ...data.position, x: Number(e.target.value) } })}
              className="w-full rounded-md bg-gray-700 border-gray-600 text-white px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Position Y</label>
            <input
              type="number"
              value={data.position.y}
              onChange={(e) => onChange({ position: { ...data.position, y: Number(e.target.value) } })}
              className="w-full rounded-md bg-gray-700 border-gray-600 text-white px-3 py-2"
            />
          </div>
        </div>
      );
    
    case "move":
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">From X</label>
            <input
              type="number"
              value={data.from.x}
              onChange={(e) => onChange({ from: { ...data.from, x: Number(e.target.value) } })}
              className="w-full rounded-md bg-gray-700 border-gray-600 text-white px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">From Y</label>
            <input
              type="number"
              value={data.from.y}
              onChange={(e) => onChange({ from: { ...data.from, y: Number(e.target.value) } })}
              className="w-full rounded-md bg-gray-700 border-gray-600 text-white px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">To X</label>
            <input
              type="number"
              value={data.to.x}
              onChange={(e) => onChange({ to: { ...data.to, x: Number(e.target.value) } })}
              className="w-full rounded-md bg-gray-700 border-gray-600 text-white px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">To Y</label>
            <input
              type="number"
              value={data.to.y}
              onChange={(e) => onChange({ to: { ...data.to, y: Number(e.target.value) } })}
              className="w-full rounded-md bg-gray-700 border-gray-600 text-white px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Start Time</label>
            <input
              type="number"
              step="0.1"
              value={data.startTime}
              onChange={(e) => onChange({ startTime: Number(e.target.value) })}
              className="w-full rounded-md bg-gray-700 border-gray-600 text-white px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Duration</label>
            <input
              type="number"
              step="0.1"
              value={data.duration}
              onChange={(e) => onChange({ duration: Number(e.target.value) })}
              className="w-full rounded-md bg-gray-700 border-gray-600 text-white px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Easing</label>
            <select
              value={data.easing}
              onChange={(e) => onChange({ easing: e.target.value })}
              className="w-full rounded-md bg-gray-700 border-gray-600 text-white px-3 py-2"
            >
              <option value="linear">Linear</option>
              <option value="easeInOut">Ease In Out</option>
              <option value="easeIn">Ease In</option>
              <option value="easeOut">Ease Out</option>
            </select>
          </div>
        </div>
      );

    case "rotate":
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Rotations</label>
            <input
              type="number"
              step="0.1"
              value={data.rotations}
              onChange={(e) => onChange({ rotations: Number(e.target.value) })}
              className="w-full rounded-md bg-gray-700 border-gray-600 text-white px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Start Time</label>
            <input
              type="number"
              step="0.1"
              value={data.startTime}
              onChange={(e) => onChange({ startTime: Number(e.target.value) })}
              className="w-full rounded-md bg-gray-700 border-gray-600 text-white px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Duration</label>
            <input
              type="number"
              step="0.1"
              value={data.duration}
              onChange={(e) => onChange({ duration: Number(e.target.value) })}
              className="w-full rounded-md bg-gray-700 border-gray-600 text-white px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Easing</label>
            <select
              value={data.easing}
              onChange={(e) => onChange({ easing: e.target.value })}
              className="w-full rounded-md bg-gray-700 border-gray-600 text-white px-3 py-2"
            >
              <option value="linear">Linear</option>
              <option value="easeInOut">Ease In Out</option>
              <option value="easeIn">Ease In</option>
              <option value="easeOut">Ease Out</option>
            </select>
          </div>
        </div>
      );

    case "scale":
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">From Scale</label>
            <input
              type="number"
              step="0.1"
              value={data.from}
              onChange={(e) => onChange({ from: Number(e.target.value) })}
              className="w-full rounded-md bg-gray-700 border-gray-600 text-white px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">To Scale</label>
            <input
              type="number"
              step="0.1"
              value={data.to}
              onChange={(e) => onChange({ to: Number(e.target.value) })}
              className="w-full rounded-md bg-gray-700 border-gray-600 text-white px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Start Time</label>
            <input
              type="number"
              step="0.1"
              value={data.startTime}
              onChange={(e) => onChange({ startTime: Number(e.target.value) })}
              className="w-full rounded-md bg-gray-700 border-gray-600 text-white px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Duration</label>
            <input
              type="number"
              step="0.1"
              value={data.duration}
              onChange={(e) => onChange({ duration: Number(e.target.value) })}
              className="w-full rounded-md bg-gray-700 border-gray-600 text-white px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Easing</label>
            <select
              value={data.easing}
              onChange={(e) => onChange({ easing: e.target.value })}
              className="w-full rounded-md bg-gray-700 border-gray-600 text-white px-3 py-2"
            >
              <option value="linear">Linear</option>
              <option value="easeInOut">Ease In Out</option>
              <option value="easeIn">Ease In</option>
              <option value="easeOut">Ease Out</option>
            </select>
          </div>
        </div>
      );

    case "fade":
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">From Opacity</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={data.from}
              onChange={(e) => onChange({ from: Number(e.target.value) })}
              className="w-full rounded-md bg-gray-700 border-gray-600 text-white px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">To Opacity</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={data.to}
              onChange={(e) => onChange({ to: Number(e.target.value) })}
              className="w-full rounded-md bg-gray-700 border-gray-600 text-white px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Start Time</label>
            <input
              type="number"
              step="0.1"
              value={data.startTime}
              onChange={(e) => onChange({ startTime: Number(e.target.value) })}
              className="w-full rounded-md bg-gray-700 border-gray-600 text-white px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Duration</label>
            <input
              type="number"
              step="0.1"
              value={data.duration}
              onChange={(e) => onChange({ duration: Number(e.target.value) })}
              className="w-full rounded-md bg-gray-700 border-gray-600 text-white px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Easing</label>
            <select
              value={data.easing}
              onChange={(e) => onChange({ easing: e.target.value })}
              className="w-full rounded-md bg-gray-700 border-gray-600 text-white px-3 py-2"
            >
              <option value="linear">Linear</option>
              <option value="easeInOut">Ease In Out</option>
              <option value="easeIn">Ease In</option>
              <option value="easeOut">Ease Out</option>
            </select>
          </div>
        </div>
      );

    case "color":
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">From Color</label>
            <input
              type="color"
              value={data.from}
              onChange={(e) => onChange({ from: e.target.value })}
              className="w-full h-10 rounded-md bg-gray-700 border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">To Color</label>
            <input
              type="color"
              value={data.to}
              onChange={(e) => onChange({ to: e.target.value })}
              className="w-full h-10 rounded-md bg-gray-700 border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Property</label>
            <select
              value={data.property}
              onChange={(e) => onChange({ property: e.target.value })}
              className="w-full rounded-md bg-gray-700 border-gray-600 text-white px-3 py-2"
            >
              <option value="fill">Fill</option>
              <option value="stroke">Stroke</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Start Time</label>
            <input
              type="number"
              step="0.1"
              value={data.startTime}
              onChange={(e) => onChange({ startTime: Number(e.target.value) })}
              className="w-full rounded-md bg-gray-700 border-gray-600 text-white px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Duration</label>
            <input
              type="number"
              step="0.1"
              value={data.duration}
              onChange={(e) => onChange({ duration: Number(e.target.value) })}
              className="w-full rounded-md bg-gray-700 border-gray-600 text-white px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Easing</label>
            <select
              value={data.easing}
              onChange={(e) => onChange({ easing: e.target.value })}
              className="w-full rounded-md bg-gray-700 border-gray-600 text-white px-3 py-2"
            >
              <option value="linear">Linear</option>
              <option value="easeInOut">Ease In Out</option>
              <option value="easeIn">Ease In</option>
              <option value="easeOut">Ease Out</option>
            </select>
          </div>
        </div>
      );
    
    case "scene":
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Duration (seconds)</label>
            <input
              type="number"
              step="0.1"
              value={data.duration}
              onChange={(e) => onChange({ duration: Number(e.target.value) })}
              className="w-full rounded-md bg-gray-700 border-gray-600 text-white px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Background Color</label>
            <input
              type="color"
              value={data.backgroundColor}
              onChange={(e) => onChange({ backgroundColor: e.target.value })}
              className="w-full h-10 rounded-md bg-gray-700 border-gray-600"
            />
          </div>
        </div>
      );
    
    default:
      return (
        <div className="text-gray-400 text-sm">
          Select a node to edit its properties
        </div>
      );
  }
}