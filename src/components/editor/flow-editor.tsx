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

import { TriangleNode, CircleNode, RectangleNode, AnimationNode, SceneNode } from "./nodes";
import { NodePalette } from "./node-palette";
import { TimelineEditorModal } from "./timeline-editor-modal";
import { useFlowToScene } from "./hooks/use-flow-to-scene";
import { api } from "@/trpc/react";

export function FlowEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [timelineModalState, setTimelineModalState] = useState<{
    isOpen: boolean;
    nodeId: string | null;
  }>({ isOpen: false, nodeId: null });

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

  const updateNodeData = useCallback((nodeId: string, newData: any) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...newData } }
          : node
      )
    );
  }, [setNodes]);

  const handleOpenTimelineEditor = useCallback((nodeId: string) => {
    setTimelineModalState({ isOpen: true, nodeId });
  }, []);

  const handleCloseTimelineEditor = useCallback(() => {
    setTimelineModalState({ isOpen: false, nodeId: null });
  }, []);

  const handleSaveTimeline = useCallback((duration: number, tracks: any[]) => {
    if (timelineModalState.nodeId) {
      updateNodeData(timelineModalState.nodeId, { duration, tracks });
    }
    handleCloseTimelineEditor();
  }, [timelineModalState.nodeId, updateNodeData, handleCloseTimelineEditor]);

  // Get current timeline data for modal
  const timelineNode = timelineModalState.nodeId 
    ? nodes.find(n => n.id === timelineModalState.nodeId)
    : null;

  const nodeTypes: NodeTypes = useMemo(() => ({
    triangle: TriangleNode,
    circle: CircleNode,
    rectangle: RectangleNode,
    animation: (props: any) => (
      <AnimationNode 
        {...props} 
        onOpenEditor={() => handleOpenTimelineEditor(props.id)} 
      />
    ),
    scene: SceneNode,
  }), [handleOpenTimelineEditor]);

  const onConnect = useCallback(
    (params: Connection) => {
      const sourceNode = nodes.find((n) => n.id === params.source);
      const targetNode = nodes.find((n) => n.id === params.target);
      
      if (!sourceNode || !targetNode) return;
      
      // Validate connections: geometry → animation → scene
      const isValidConnection = 
        (["triangle", "circle", "rectangle"].includes(sourceNode.type!) &&
         targetNode.type === "animation") ||
        (sourceNode.type === "animation" && targetNode.type === "scene");
      
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
          deleteKeyCode={timelineModalState.isOpen ? null : ['Backspace', 'Delete']}
          multiSelectionKeyCode={timelineModalState.isOpen ? null : 'Meta'}
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
            onChange={(newData) => updateNodeData(selectedNode.id, newData)}
          />
        </div>
      )}

      {/* Timeline Editor Modal */}
      <TimelineEditorModal
        isOpen={timelineModalState.isOpen}
        onClose={handleCloseTimelineEditor}
        duration={timelineNode?.data?.duration || 3}
        tracks={timelineNode?.data?.tracks || []}
        onSave={handleSaveTimeline}
      />
    </div>
  );
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
    
    case "animation":
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
            <label className="block text-sm font-medium text-gray-300 mb-1">Tracks</label>
            <div className="text-xs text-gray-400">
              {data.tracks?.length || 0} animation tracks defined
            </div>
            <div className="text-xs text-blue-400 mt-2">
              Double-click the node to edit timeline
            </div>
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
    case "animation":
      return {
        duration: 3,
        tracks: [],
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