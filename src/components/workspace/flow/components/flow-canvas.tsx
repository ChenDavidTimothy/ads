// src/components/workspace/flow/components/FlowCanvas.tsx
import React from 'react';
import 'reactflow/dist/style.css';
import ReactFlow, { Background, Controls, MiniMap, type Edge, type Node, type NodeTypes, type NodeChange, type EdgeChange, type Connection, type NodeDragHandler } from 'reactflow';
import type { NodeData } from '@/shared/types';

interface Props {
  nodes: Node<NodeData>[];
  edges: Edge[];
  nodeTypes: NodeTypes;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (params: Connection) => void;
  onNodeClick: (event: React.MouseEvent, node: Node) => void;
  onPaneClick: () => void;
  onNodesDelete: (nodes: Node[]) => void;
  onEdgesDelete: (edges: Edge[]) => void;
  disableDeletion: boolean;
  onNodeDragStop?: NodeDragHandler;
}

export function FlowCanvas(props: Props) {
  const { nodes, edges, nodeTypes, onNodesChange, onEdgesChange, onConnect, onNodeClick, onPaneClick, onNodesDelete, onEdgesDelete, disableDeletion, onNodeDragStop } = props;
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      onNodesDelete={onNodesDelete}
      onEdgesDelete={onEdgesDelete}
      onNodeDragStop={onNodeDragStop}
      nodeTypes={nodeTypes}
      fitView
      panOnDrag
      selectionOnDrag
      zoomOnScroll
      className="bg-gray-900"
      deleteKeyCode={disableDeletion ? (null as unknown as string | string[]) : ['Backspace', 'Delete']}
      multiSelectionKeyCode={disableDeletion ? (null as unknown as string) : 'Meta'}
    >
      <Background color="#374151" />
      <Controls className="bg-gray-800 border-gray-600" />
      <MiniMap className="bg-gray-800 border-gray-600" nodeColor="#6366f1" />
    </ReactFlow>
  );
}


