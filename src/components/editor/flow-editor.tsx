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
  type Edge,
  type Connection,
  type NodeTypes,
  type EdgeTypes,
} from "reactflow";
import "reactflow/dist/style.css";

import { TriangleNode, CircleNode, RectangleNode, InsertNode, AnimationNode, SceneNode } from "./nodes";
import { FilterableEdge } from "./edges/filterable-edge";
import { NodePalette } from "./node-palette";
import { TimelineEditorModal } from "./timeline-editor-modal";
import { PropertyPanel } from "@/components/editor/property-panel";
import { EdgePropertyPanel } from "@/components/editor/edge-property-panel";
import { Button } from "@/components/ui/button";
import { useFlowToScene } from "@/hooks/use-flow-to-scene";
import { useNotifications } from "@/hooks/use-notifications";
import { getDefaultNodeData } from "@/lib/defaults/nodes";
import { getNodeDefinition } from "@/lib/types/node-definitions";
import { arePortsCompatible } from "@/lib/types/ports";
import { FlowTracker } from "@/lib/flow/flow-tracking";
import { api } from "@/trpc/react";
import type { 
  NodeData, 
  NodeType, 
  AnimationNodeData, 
  SceneNodeData,
  AnimationTrack
} from "@/lib/types/nodes";

function isAnimationNodeData(data: NodeData): data is AnimationNodeData {
  return 'duration' in data && 'tracks' in data;
}

function isSceneNodeData(data: NodeData): data is SceneNodeData {
  return 'width' in data && 'height' in data && 'fps' in data && 'backgroundColor' in data;
}

interface TimelineModalState {
  isOpen: boolean;
  nodeId: string | null;
}

interface SceneConfig {
  width: number;
  height: number;
  fps: number;
  backgroundColor: string;
  videoPreset: string;
  videoCrf: number;
}

export function FlowEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [timelineModalState, setTimelineModalState] = useState<TimelineModalState>({ 
    isOpen: false, 
    nodeId: null 
  });
  const [flowTracker] = useState(() => new FlowTracker());

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
    return edges.some(edge => edge.target === sceneNode.data.identifier.id);
  }, [nodes, edges]);

  const canGenerate = useMemo(() => {
    const hasScene = nodes.some(n => n.type === 'scene');
    return hasScene && isSceneConnected;
  }, [nodes, isSceneConnected]);

  const updateNodeData = useCallback((nodeId: string, newData: Partial<NodeData>) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.data.identifier.id === nodeId
          ? { ...node, data: { ...node.data, ...newData } }
          : node
      )
    );
  }, [setNodes]);

  const validateDisplayName = useCallback((newName: string, nodeId: string): string | null => {
    return flowTracker.validateDisplayName(newName, nodeId, nodes);
  }, [flowTracker, nodes]);

  const updateDisplayName = useCallback((nodeId: string, newDisplayName: string): boolean => {
    const error = validateDisplayName(newDisplayName, nodeId);
    if (error) {
      toast.error("Name validation failed", error);
      return false;
    }

    setNodes((nds) =>
      nds.map((node) =>
        node.data.identifier.id === nodeId
          ? { 
              ...node, 
              data: { 
                ...node.data, 
                identifier: { 
                  ...node.data.identifier, 
                  displayName: newDisplayName 
                }
              }
            }
          : node
      )
    );
    return true;
  }, [validateDisplayName, setNodes, toast]);

  const handleOpenTimelineEditor = useCallback((nodeId: string) => {
    setTimelineModalState({ isOpen: true, nodeId });
  }, []);

  const handleCloseTimelineEditor = useCallback(() => {
    setTimelineModalState({ isOpen: false, nodeId: null });
  }, []);

  const handleSaveTimeline = useCallback((duration: number, tracks: AnimationTrack[]) => {
    if (timelineModalState.nodeId) {
      updateNodeData(timelineModalState.nodeId, { duration, tracks });
    }
    handleCloseTimelineEditor();
  }, [timelineModalState.nodeId, updateNodeData, handleCloseTimelineEditor]);

  const handleUpdateEdgeFiltering = useCallback((edgeId: string, selectedNodeIds: string[]) => {
    flowTracker.updateEdgeFiltering(edgeId, selectedNodeIds);
    // Clear node selection when edge filtering changes
    setSelectedNodeId(null);
  }, [flowTracker]);

  const timelineNode = timelineModalState.nodeId 
    ? nodes.find(n => n.data.identifier.id === timelineModalState.nodeId)
    : null;

  const selectedEdge = useMemo(
    () => edges.find((edge) => edge.id === selectedEdgeId),
    [edges, selectedEdgeId]
  );

  const edgeTypes: EdgeTypes = useMemo(() => ({
    default: (props) => {
      const edgeFlow = flowTracker.getNodesFlowingThroughEdge(props.id);
      const hasFiltering = edgeFlow.length > 0;
      
      return (
        <FilterableEdge
          {...props}
          selected={selectedEdgeId === props.id}
          onClick={(_, edge) => {
            setSelectedEdgeId(edge.id);
            setSelectedNodeId(null); // Clear node selection
          }}
          hasFiltering={hasFiltering}
          filterCount={edgeFlow.length}
        />
      );
    }
  }), [flowTracker, selectedEdgeId]);

  const nodeTypes: NodeTypes = useMemo(() => ({
    triangle: TriangleNode,
    circle: CircleNode,
    rectangle: RectangleNode,
    insert: InsertNode,
    animation: (props: Parameters<typeof AnimationNode>[0]) => (
      <AnimationNode 
        {...props} 
        onOpenEditor={() => handleOpenTimelineEditor(props.data.identifier.id)} 
      />
    ),
    scene: SceneNode,
  }), [handleOpenTimelineEditor]);

  const onConnect = useCallback(
    (params: Connection) => {
      const sourceNode = nodes.find((n) => n.data.identifier.id === params.source);
      const targetNode = nodes.find((n) => n.data.identifier.id === params.target);
      
      if (!sourceNode || !targetNode) return;
      
      if (['triangle', 'circle', 'rectangle'].includes(sourceNode.type!) && 
          targetNode.type === 'insert') {
        
        const existingInsertConnection = edges.find(edge => 
          edge.source === sourceNode.data.identifier.id && 
          nodes.find(n => n.data.identifier.id === edge.target)?.type === 'insert'
        );
        
        if (existingInsertConnection) {
          toast.error(
            "Connection not allowed", 
            `Object already connected to Insert node. Each object can only connect to one Insert node.`
          );
          return;
        }
      }
      
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
      
      const newEdges = addEdge({
        ...params,
        source: sourceNode.data.identifier.id,
        target: targetNode.data.identifier.id
      }, edges);
      
      // Get the actual edge ID that ReactFlow generated
      const newEdge = newEdges.find(e => 
        e.source === sourceNode.data.identifier.id && 
        e.target === targetNode.data.identifier.id &&
        e.sourceHandle === params.sourceHandle &&
        e.targetHandle === params.targetHandle
      );
      
      if (newEdge) {
        flowTracker.trackConnection(
          newEdge.id,
          sourceNode.data.identifier.id,
          targetNode.data.identifier.id,
          params.sourceHandle!,
          params.targetHandle!
        );
      }
      
      setEdges(newEdges);
    },
    [nodes, edges, setEdges, flowTracker, toast]
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.data.identifier.id);
    setSelectedEdgeId(null); // Clear edge selection
  }, []);

  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.stopPropagation();
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null); // Clear node selection
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  const onNodesDelete = useCallback((deletedNodes: Node[]) => {
    deletedNodes.forEach(node => {
      flowTracker.removeNode(node.data.identifier.id);
    });
  }, [flowTracker]);

  const onEdgesDelete = useCallback((deletedEdges: typeof edges) => {
    deletedEdges.forEach(edge => {
      flowTracker.removeConnection(edge.id);
    });
  }, [flowTracker]);

  const handleAddNode = useCallback((nodeType: string, position: { x: number; y: number }) => {
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

    const nodeData = getDefaultNodeData(nodeType as NodeType, nodes);
    
    const newNode: Node<NodeData> = {
      id: nodeData.identifier.id,
      type: nodeType,
      position,
      data: nodeData,
    };

    flowTracker.trackNodeCreation(nodeData.identifier.id);
    setNodes((nds) => [...nds, newNode]);
  }, [nodes, setNodes, flowTracker, toast]);

  const handleGenerateScene = useCallback(async () => {
    try {
      const sceneNode = validateSceneNodes();
      
      if (!isSceneNodeData(sceneNode.data)) {
        throw new Error("Invalid scene node data");
      }

      const scene = await convertFlowToScene(nodes, edges, flowTracker);
      if (scene) {
        setVideoUrl(null);
        
        const config: SceneConfig = {
          width: sceneNode.data.width,
          height: sceneNode.data.height,
          fps: sceneNode.data.fps,
          backgroundColor: sceneNode.data.backgroundColor,
          videoPreset: sceneNode.data.videoPreset,
          videoCrf: sceneNode.data.videoCrf,
        };
        
        generateScene.mutate({ scene, config });
      }
    } catch (error) {
      toast.error("Generation failed", error instanceof Error ? error.message : 'Unknown error');
    }
  }, [nodes, edges, flowTracker, convertFlowToScene, generateScene, validateSceneNodes, toast]);

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
    () => nodes.find((node) => node.data.identifier.id === selectedNodeId),
    [nodes, selectedNodeId]
  );

  const getTimelineNodeData = useCallback(() => {
    if (!timelineNode) return { duration: 3, tracks: [] };
    
    if (isAnimationNodeData(timelineNode.data)) {
      return {
        duration: timelineNode.data.duration,
        tracks: timelineNode.data.tracks
      };
    }
    
    return { duration: 3, tracks: [] };
  }, [timelineNode]);

  const timelineNodeData = getTimelineNodeData();

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
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
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

      <div className="w-80 bg-gray-800 border-l border-gray-600 p-4 overflow-y-auto">
        {selectedNode && (
          <>
            <h3 className="text-lg font-semibold text-white mb-4">
              {selectedNode.type?.charAt(0).toUpperCase()}{selectedNode.type?.slice(1)} Properties
            </h3>
            <PropertyPanel 
              node={selectedNode}
              onChange={(newData: Partial<NodeData>) => updateNodeData(selectedNode.data.identifier.id, newData)}
              onDisplayNameChange={updateDisplayName}
              validateDisplayName={validateDisplayName}
            />
          </>
        )}

        {selectedEdge && (
          <>
            <h3 className="text-lg font-semibold text-white mb-4">
              Connection Properties
            </h3>
            <EdgePropertyPanel
              edge={selectedEdge}
              nodes={nodes}
              flowTracker={flowTracker}
              onUpdateFiltering={handleUpdateEdgeFiltering}
            />
          </>
        )}

        {!selectedNode && !selectedEdge && (
          <div className="text-gray-400 text-sm">
            <div className="mb-4">Select a node or connection to edit properties</div>
            <div className="space-y-2 text-xs">
              <div>• Click nodes to edit their properties</div>
              <div>• Click connections to filter object flow</div>
              <div>• Double-click animation nodes to edit timeline</div>
            </div>
          </div>
        )}
      </div>

      <TimelineEditorModal
        isOpen={timelineModalState.isOpen}
        onClose={handleCloseTimelineEditor}
        duration={timelineNodeData.duration}
        tracks={timelineNodeData.tracks}
        onSave={handleSaveTimeline}
      />
    </div>
  );
}