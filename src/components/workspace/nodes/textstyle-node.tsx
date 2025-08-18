"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { getNodeDefinition } from "@/shared/registry/registry-utils";
import type { TextStyleNodeData } from "@/shared/types/nodes";
import { Type, Settings } from "lucide-react";

interface TextStyleNodeProps extends NodeProps<TextStyleNodeData> {
  onOpenTextStyle?: () => void;
}

export function TextstyleNode({ data, selected, onOpenTextStyle }: TextStyleNodeProps) {
  const nodeDefinition = getNodeDefinition('textstyle');

  const handleDoubleClick = () => {
    if (onOpenTextStyle) return onOpenTextStyle();
    
    // Fallback URL navigation (follows AnimationNode pattern)
    const params = new URLSearchParams(window.location.search);
    const ws = params.get('workspace');
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'textstyle');
    url.searchParams.set('node', data?.identifier?.id ?? '');
    if (ws) url.searchParams.set('workspace', ws);
    window.history.pushState({}, '', url.toString());
  };

  const currentFont = `${data.fontFamily || 'Arial'} ${data.fontWeight || 'normal'}`;

  return (
    <Card 
      selected={selected} 
      className="p-[var(--card-padding)] min-w-[var(--node-min-width)] cursor-pointer transition-all hover:bg-[var(--surface-interactive)]" 
      onDoubleClick={handleDoubleClick}
    >
      {nodeDefinition?.ports.inputs.map((port) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          className="w-3 h-3 bg-[var(--node-animation)] !border-2 !border-[var(--text-primary)]"
          style={{ top: '50%' }}
        />
      ))}

      <CardHeader className="p-0 pb-[var(--space-3)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <div className="w-6 h-6 bg-[var(--node-animation)] flex items-center justify-center rounded text-[var(--text-primary)]">
            <Type size={12} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[var(--text-primary)] truncate">
              {data?.identifier?.displayName ?? 'Text Style'}
            </div>
          </div>
          <Settings size={12} className="text-[var(--text-tertiary)]" />
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-1 text-xs text-[var(--text-secondary)]">
        <div className="truncate">Font: {currentFont}</div>
        <div>Align: {data.textAlign || 'center'}</div>
        <div>Line Height: {data.lineHeight || 1.2}</div>
        <div className="text-[var(--text-tertiary)] text-[10px] pt-1">
          Double-click to edit in Text Style tab
        </div>
      </CardContent>

      {nodeDefinition?.ports.outputs.map((port) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          className="w-3 h-3 bg-[var(--node-animation)] !border-2 !border-[var(--text-primary)]"
          style={{ top: '50%' }}
        />
      ))}
    </Card>
  );
}
