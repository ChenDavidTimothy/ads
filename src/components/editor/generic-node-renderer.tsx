// src/components/editor/generic-node-renderer.tsx - Universal node renderer for scalability
"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { getNodeDefinition } from "@/shared/types/definitions";
import { TRACK_COLORS, TRACK_ICONS } from "@/lib/constants/editor";
import type { 
  NodeData, 
  AnimationNodeData, 
  SceneNodeData,
  FilterNodeData,
  AnimationTrack
} from "@/shared/types/nodes";

interface GenericNodeRendererProps extends NodeProps<NodeData> {
  onDoubleClick?: (nodeId: string) => void;
}

// Type guards
function isAnimationNodeData(data: NodeData): data is AnimationNodeData {
  return 'duration' in data && 'tracks' in data;
}

function isSceneNodeData(data: NodeData): data is SceneNodeData {
  return 'width' in data && 'height' in data && 'fps' in data && 'backgroundColor' in data;
}

function isFilterNodeData(data: NodeData): data is FilterNodeData {
  return 'selectedObjectIds' in data;
}

export function GenericNodeRenderer({ 
  data, 
  selected, 
  onDoubleClick,
  ...nodeProps 
}: GenericNodeRendererProps) {
  const nodeDefinition = getNodeDefinition(nodeProps.type!);
  
  if (!nodeDefinition) {
    return (
      <Card selected={selected} className="p-4 min-w-[180px] border-red-500">
        <div className="text-red-400 text-sm">Unknown node: {nodeProps.type}</div>
      </Card>
    );
  }

  const handleDoubleClick = () => {
    if (onDoubleClick) {
      onDoubleClick(data.identifier.id);
    }
  };

  // Render based on template
  switch (nodeDefinition.rendering.template) {
    case 'basic':
      return (
        <BasicNodeTemplate
          data={data}
          selected={selected}
          nodeDefinition={nodeDefinition}
          onDoubleClick={handleDoubleClick}
        />
      );
    case 'conditional':
      // Future: Conditional node template for if/else nodes
      return (
        <ConditionalNodeTemplate
          data={data}
          selected={selected}
          nodeDefinition={nodeDefinition}
          onDoubleClick={handleDoubleClick}
        />
      );
    case 'operation':
      // Future: Operation node template for math/logic operations
      return (
        <OperationNodeTemplate
          data={data}
          selected={selected}
          nodeDefinition={nodeDefinition}
          onDoubleClick={handleDoubleClick}
        />
      );
    case 'data_source':
      // Future: Data source template for variables/constants
      return (
        <DataSourceNodeTemplate
          data={data}
          selected={selected}
          nodeDefinition={nodeDefinition}
          onDoubleClick={handleDoubleClick}
        />
      );
    default:
      return (
        <BasicNodeTemplate
          data={data}
          selected={selected}
          nodeDefinition={nodeDefinition}
          onDoubleClick={handleDoubleClick}
        />
      );
  }
}

interface TemplateProps {
  data: NodeData;
  selected: boolean;
  nodeDefinition: NonNullable<ReturnType<typeof getNodeDefinition>>;
  onDoubleClick?: () => void;
}

// Basic template for current nodes (geometry, timing, animation, scene)
function BasicNodeTemplate({ data, selected, nodeDefinition, onDoubleClick }: TemplateProps) {
  const showDurationInHeader = nodeDefinition.rendering.customFields?.showDurationInHeader;
  const compactMode = nodeDefinition.rendering.customFields?.compactMode;

  return (
    <Card 
      selected={selected} 
      className={`p-4 min-w-[180px] ${onDoubleClick ? 'cursor-pointer transition-all hover:bg-gray-750' : ''}`}
      onDoubleClick={onDoubleClick}
    >
      {/* Input ports */}
      {nodeDefinition.ports.inputs.map((port, index) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          className={`w-3 h-3 ${nodeDefinition.rendering.colors.handle} !border-2 !border-white`}
          style={{ top: nodeDefinition.ports.inputs.length === 1 ? '50%' : `${(index + 1) * (100 / (nodeDefinition.ports.inputs.length + 1))}%` }}
        />
      ))}

      <CardHeader className="p-0 pb-3">
        <div className={`flex items-center ${showDurationInHeader ? 'justify-between' : 'gap-2'}`}>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <NodeIcon 
              icon={nodeDefinition.rendering.icon}
              data={data}
              nodeDefinition={nodeDefinition}
            />
            <span className="font-semibold text-white truncate">
              {data.identifier.displayName}
            </span>
          </div>
          {showDurationInHeader && isAnimationNodeData(data) && (
            <div className="text-xs text-gray-400">{data.duration}s</div>
          )}
        </div>
        {!compactMode && (
          <div className="text-xs text-gray-400 font-mono">
            {data.identifier.id.split('_').pop()}
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0 space-y-2">
        <NodeBodyContent data={data} nodeDefinition={nodeDefinition} />
      </CardContent>

      {/* Output ports */}
      {nodeDefinition.ports.outputs.map((port, index) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          className={`w-3 h-3 ${nodeDefinition.rendering.colors.handle} !border-2 !border-white`}
          style={{ top: nodeDefinition.ports.outputs.length === 1 ? '50%' : `${(index + 1) * (100 / (nodeDefinition.ports.outputs.length + 1))}%` }}
        />
      ))}
    </Card>
  );
}

// Future: Conditional node template for if/else nodes
function ConditionalNodeTemplate({ data, selected, nodeDefinition }: TemplateProps) {
  return (
    <Card selected={selected} className="p-4 min-w-[200px] border-2 border-yellow-500">
      {/* Input ports */}
      {nodeDefinition.ports.inputs.map((port) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          className={`w-3 h-3 ${nodeDefinition.rendering.colors.handle} !border-2 !border-white`}
          style={{ top: '50%' }}
        />
      ))}

      <CardHeader className="p-0 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-yellow-600 flex items-center justify-center rounded text-white font-bold text-sm">
            {nodeDefinition.rendering.icon}
          </div>
          <span className="font-semibold text-white">
            {data.identifier.displayName}
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="text-xs text-gray-300">
          Conditional logic node (Future)
        </div>
      </CardContent>

      {/* Multiple output ports for true/false branches */}
      {nodeDefinition.ports.outputs.map((port, index) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          className={`w-3 h-3 ${nodeDefinition.rendering.colors.handle} !border-2 !border-white`}
          style={{ top: `${25 + (index * 50)}%` }}
        />
      ))}
    </Card>
  );
}

// Future: Operation node template for math/logic operations
function OperationNodeTemplate({ data, selected, nodeDefinition }: TemplateProps) {
  return (
    <Card selected={selected} className="p-3 min-w-[120px] max-w-[160px]">
      {/* Input ports */}
      {nodeDefinition.ports.inputs.map((port, index) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          className={`w-3 h-3 ${nodeDefinition.rendering.colors.handle} !border-2 !border-white`}
          style={{ top: `${25 + (index * 50)}%` }}
        />
      ))}

      <div className="text-center">
        <div className={`w-8 h-8 ${nodeDefinition.rendering.colors.primary} flex items-center justify-center rounded-full text-white font-bold mx-auto`}>
          {nodeDefinition.rendering.icon}
        </div>
        <div className="text-xs text-white font-medium mt-1">
          {data.identifier.displayName}
        </div>
      </div>

      {/* Output ports */}
      {nodeDefinition.ports.outputs.map((port) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          className={`w-3 h-3 ${nodeDefinition.rendering.colors.handle} !border-2 !border-white`}
          style={{ top: '50%' }}
        />
      ))}
    </Card>
  );
}

// Future: Data source template for variables/constants
function DataSourceNodeTemplate({ data, selected, nodeDefinition }: TemplateProps) {
  return (
    <Card selected={selected} className="p-3 min-w-[140px]">
      <div className="flex items-center gap-2">
        <div className={`w-5 h-5 ${nodeDefinition.rendering.colors.primary} flex items-center justify-center rounded text-white text-xs font-bold`}>
          {nodeDefinition.rendering.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white truncate">
            {data.identifier.displayName}
          </div>
          <div className="text-xs text-gray-400">
            Data Source
          </div>
        </div>
      </div>

      {/* Output port */}
      {nodeDefinition.ports.outputs.map((port) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          className={`w-3 h-3 ${nodeDefinition.rendering.colors.handle} !border-2 !border-white`}
          style={{ top: '50%' }}
        />
      ))}
    </Card>
  );
}

// Dynamic node icon based on node type and data
function NodeIcon({ icon, data, nodeDefinition }: { 
  icon: string; 
  data: NodeData; 
  nodeDefinition: NonNullable<ReturnType<typeof getNodeDefinition>>; 
}) {
  const colors = nodeDefinition.rendering.colors;
  
  // Special handling for geometry nodes with color preview
  if (nodeDefinition.execution.category === 'geometry') {
    const nodeColor = (data as Record<string, unknown>).color as string || '#666';
    const iconClasses = nodeDefinition.type === 'circle' ? 'rounded-full' : 'rounded';
    
    return (
      <div 
        className={`w-6 h-6 flex items-center justify-center text-white font-bold ${iconClasses}`}
        style={{ backgroundColor: nodeColor }}
      >
        {icon}
      </div>
    );
  }
  
  // Default icon rendering
  return (
    <div className={`w-6 h-6 ${colors.primary} flex items-center justify-center rounded text-white font-bold text-sm`}>
      {icon}
    </div>
  );
}

// Dynamic body content based on node type
function NodeBodyContent({ 
  data, 
  nodeDefinition 
}: { 
  data: NodeData; 
  nodeDefinition: NonNullable<ReturnType<typeof getNodeDefinition>>; 
}) {
  const category = nodeDefinition.execution.category;
  
  switch (category) {
    case 'geometry':
      return <GeometryNodeBody data={data} nodeDefinition={nodeDefinition} />;
    case 'timing':
      return <TimingNodeBody data={data} />;
    case 'animation':
      return <AnimationNodeBody data={data} />;
    case 'logic':
      return <LogicNodeBody data={data} />;
    case 'output':
      return <OutputNodeBody data={data} />;
    default:
      return <DefaultNodeBody data={data} />;
  }
}

function GeometryNodeBody({ data, nodeDefinition }: { data: NodeData; nodeDefinition: NonNullable<ReturnType<typeof getNodeDefinition>> }) {
  const props = data as Record<string, unknown>;
  const position = props.position as { x: number; y: number };
  
  return (
    <div className="space-y-1 text-xs text-gray-300">
      {nodeDefinition.type === 'triangle' && (
        <div>Size: {props.size}px</div>
      )}
      {nodeDefinition.type === 'circle' && (
        <div>Radius: {props.radius}px</div>
      )}
      {nodeDefinition.type === 'rectangle' && (
        <div>Size: {props.width}×{props.height}px</div>
      )}
      <div>Position: ({position.x}, {position.y})</div>
      <div className="flex items-center gap-2">
        <span>Color:</span>
        <div 
          className={`w-4 h-4 border border-gray-500 ${nodeDefinition.type === 'circle' ? 'rounded-full' : 'rounded'}`}
          style={{ backgroundColor: props.color as string }}
        />
      </div>
    </div>
  );
}

function TimingNodeBody({ data }: { data: NodeData }) {
  const props = data as Record<string, unknown>;
  const appearanceTime = props.appearanceTime as number;
  
  return (
    <div className="space-y-1 text-xs text-gray-300">
      <div>Appears at: {appearanceTime}s</div>
      {appearanceTime === 0 ? (
        <div className="text-green-400">Instant presence</div>
      ) : (
        <div className="text-blue-400">Delayed presence</div>
      )}
    </div>
  );
}

function AnimationNodeBody({ data }: { data: NodeData }) {
  if (!isAnimationNodeData(data)) return <DefaultNodeBody data={data} />;
  
  const trackCount = data.tracks?.length || 0;
  const trackTypes = data.tracks?.map(t => t.type) || [];
  const uniqueTypes = [...new Set(trackTypes)];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-gray-300">
        <span>Tracks:</span>
        <span className="text-white font-medium">{trackCount}</span>
      </div>
      
      {trackCount > 0 && (
        <div className="flex flex-wrap gap-1">
          {uniqueTypes.map((type) => (
            <span
              key={type}
              className={`text-xs px-2 py-1 rounded ${TRACK_COLORS[type]} text-white`}
            >
              {TRACK_ICONS[type]} {type}
            </span>
          ))}
        </div>
      )}

      {trackCount === 0 && (
        <div className="text-xs text-gray-500 text-center py-2">
          No tracks defined
        </div>
      )}

      <div className="mt-3 pt-2 border-t border-gray-700">
        <div className="text-xs text-gray-400 text-center">
          Double-click to edit timeline
        </div>
      </div>
    </div>
  );
}

function LogicNodeBody({ data }: { data: NodeData }) {
  if (isFilterNodeData(data)) {
    const selectedCount = data.selectedObjectIds?.length || 0;
    const hasSelection = selectedCount > 0;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-gray-300">
          <span>Selected:</span>
          <span className="text-white font-medium">{selectedCount}</span>
        </div>
        
        {hasSelection ? (
          <div className="text-xs text-green-400">
            {selectedCount} object{selectedCount !== 1 ? 's' : ''} passing through
          </div>
        ) : (
          <div className="text-xs text-yellow-400">
            No objects selected
          </div>
        )}

        <div className="mt-3 pt-2 border-t border-gray-700">
          <div className="text-xs text-gray-400 text-center">
            Configure in Properties panel
          </div>
        </div>
      </div>
    );
  }
  
  return <DefaultNodeBody data={data} />;
}

function OutputNodeBody({ data }: { data: NodeData }) {
  if (!isSceneNodeData(data)) return <DefaultNodeBody data={data} />;
  
  const getResolutionLabel = (width: number, height: number) => {
    if (width === 1920 && height === 1080) return "FHD";
    if (width === 1280 && height === 720) return "HD";
    if (width === 3840 && height === 2160) return "4K";
    if (width === 1080 && height === 1080) return "Square";
    return "Custom";
  };

  const getQualityLabel = (crf: number) => {
    if (crf <= 18) return "High";
    if (crf <= 28) return "Medium";
    return "Low";
  };

  return (
    <div className="space-y-2 text-xs text-gray-300">
      <div className="flex items-center justify-between">
        <span>Resolution:</span>
        <span className="text-white font-medium">
          {getResolutionLabel(data.width, data.height)} ({data.width}×{data.height})
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span>Frame Rate:</span>
        <span className="text-white font-medium">{data.fps} FPS</span>
      </div>

      <div className="flex items-center justify-between">
        <span>Duration:</span>
        <span className="text-white font-medium">{data.duration}s</span>
      </div>

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

      <div className="flex items-center justify-between">
        <span>Quality:</span>
        <span className="text-white font-medium">
          {getQualityLabel(data.videoCrf)} ({data.videoPreset})
        </span>
      </div>

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

function DefaultNodeBody({ data }: { data: NodeData }) {
  return (
    <div className="text-xs text-gray-400">
      Node ID: {data.identifier.sequence}
    </div>
  );
}