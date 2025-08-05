// src/components/editor/flow-editor.tsx
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

import { TriangleNode, CircleNode, RectangleNode, InsertNode, AnimationNode, SceneNode } from "./nodes";
import { NodePalette } from "./node-palette";
import { TimelineEditorModal } from "./timeline-editor-modal";
import { PropertyPanel } from "./property-panel";
import { Button } from "@/components/ui/button";
import { useFlowToScene } from "@/hooks/use-flow-to-scene";
import { useNotifications } from "@/hooks/use-notifications";
import { getDefaultNodeData } from "@/lib/defaults/nodes";
import { getNodeDefinition } from "@/lib/types/node-definitions";
import { arePortsCompatible } from "@/lib/types/ports";
import { api } from "@/trpc/react";
import type { NodeData, NodeType } from "@/lib/types/nodes";

export function FlowEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [timelineModalState, setTimelineModalState] = useState<{
    isOpen: boolean;
    nodeId: string | null;
  }>({ isOpen: false, nodeId: null });

  const { convertFlowToScene } = useFlowToScene();
  const { toast } = useNotifications();

  const generateScene = api.animation.generateScene.useMutation({
    onSuccess: (data) => {
      setVideoUrl(data.videoUrl);
    },
    onError: (error) => {
      console.error("Scene generation failed:", error);
      toast.error("Video generation failed", error.message);
    },
  });

  const validateSceneNodes = useCallback(() => {
    const sceneNodes = nodes.filter(node => node.type === "scene");
    
    if (sceneNodes.length === 0) {
      throw new Error("Scene node is required. Please add a scene node to generate video.");
    }
    
    if (sceneNodes.length > 1) {
      throw new Error("Only one scene node allowed per workspace. Please remove extra scene nodes.");
    }
    
    return sceneNodes[0]!;
  }, [nodes]);

  const isSceneConnected = useMemo(() => {
    const sceneNode = nodes.find(n => n.type === 'scene');
    if (!sceneNode) return false;
    return edges.some(edge => edge.target === sceneNode.id);
  }, [nodes, edges]);

  const canGenerate = useMemo(() => {
    const hasScene = nodes.some(n => n.type === 'scene');
    return hasScene && isSceneConnected;
  }, [nodes, isSceneConnected]);

  const updateNodeData = useCallback((nodeId: string, newData: Partial<NodeData>) => {
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

  const timelineNode = timelineModalState.nodeId 
    ? nodes.find(n => n.id === timelineModalState.nodeId)
    : null;

  const nodeTypes: NodeTypes = useMemo(() => ({
    triangle: TriangleNode,
    circle: CircleNode,
    rectangle: RectangleNode,
    insert: InsertNode,
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
      
      const sourceNodeDef = getNodeDefinition(sourceNode.type!);
      const targetNodeDef = getNodeDefinition(targetNode.type!);
      
      if (!sourceNodeDef || !targetNodeDef) {
        toast.error("Connection failed", "Unknown node type");
        return;
      }
      
      const sourcePort = sourceNodeDef.ports.outputs.find(p => p.id === params.sourceHandle);
      const targetPort = targetNodeDef.ports.inputs.find(p => p.id === params.targetHandle);
      
      if (!sourcePort || !targetPort) {
        toast.error("Connection failed", "Invalid port");
        return;
      }
      
      if (!arePortsCompatible(sourcePort.type, targetPort.type)) {
        toast.error("Connection failed", `${sourcePort.type} output incompatible with ${targetPort.type} input`);
        return;
      }
      
      setEdges((eds) => addEdge(params, eds));
    },
    [nodes, setEdges, toast]
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const handleAddNode = useCallback((nodeType: string, position: any) => {
    if (nodeType === "scene") {
      const existingSceneNodes = nodes.filter(node => node.type === "scene");
      if (existingSceneNodes.length > 0) {
        toast.warning("Scene limit reached", "Only one scene node allowed per workspace");
        return;
      }
    }

    const nodeDefinition = getNodeDefinition(nodeType as NodeType);
    if (!nodeDefinition) {
      toast.error("Node creation failed", `Unknown node type: ${nodeType}`);
      return;
    }

    const newNode: Node<NodeData> = {
      id: `${nodeType}-${Date.now()}`,
      type: nodeType,
      position,
      data: getDefaultNodeData(nodeType as NodeType),
    };
    setNodes((nds) => [...nds, newNode]);
  }, [nodes, setNodes, toast]);

  const handleGenerateScene = useCallback(async () => {
    try {
      const sceneNode = validateSceneNodes();
      
      const scene = await convertFlowToScene(nodes, edges);
      if (scene) {
        setVideoUrl(null);
        
        const config = {
          width: (sceneNode.data as any).width,
          height: (sceneNode.data as any).height,
          fps: (sceneNode.data as any).fps,
          backgroundColor: (sceneNode.data as any).backgroundColor,
          videoPreset: (sceneNode.data as any).videoPreset,
          videoCrf: (sceneNode.data as any).videoCrf,
        };
        
        generateScene.mutate({ scene, config });
      }
    } catch (error) {
      toast.error("Generation failed", error instanceof Error ? error.message : 'Unknown error');
    }
  }, [nodes, edges, convertFlowToScene, generateScene, validateSceneNodes, toast]);

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
      <NodePalette onAddNode={handleAddNode} />

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

        <div className="absolute top-4 right-4 space-y-2">
          <Button
            onClick={handleGenerateScene}
            disabled={generateScene.isPending || !canGenerate}
            variant="success"
            size="sm"
          >
            {generateScene.isPending ? "Generating..." : "Generate Video"}
          </Button>
          
          {!canGenerate && (
            <div className="text-xs text-yellow-400 bg-gray-800 p-2 rounded max-w-48">
              {!nodes.some(n => n.type === 'scene') ? 
                "Add Scene node to generate video" :
                "Connect animation to Scene node"}
            </div>
          )}
          
          {videoUrl && (
            <Button
              onClick={handleDownload}
              variant="primary"
              size="sm"
              className="block w-full"
            >
              Download MP4
            </Button>
          )}
        </div>

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

      {selectedNode && (
        <div className="w-80 bg-gray-800 border-l border-gray-600 p-4 overflow-y-auto">
          <h3 className="text-lg font-semibold text-white mb-4">
            {selectedNode.type?.charAt(0).toUpperCase()}{selectedNode.type?.slice(1)} Properties
          </h3>
          <PropertyPanel 
            node={selectedNode}
            onChange={(newData) => updateNodeData(selectedNode.id, newData)}
          />
        </div>
      )}

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