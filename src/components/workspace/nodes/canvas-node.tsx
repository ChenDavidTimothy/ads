// src/components/workspace/nodes/canvas-node.tsx - Canvas styling node UI
'use client';

import type { NodeProps } from 'reactflow';
import { Palette } from 'lucide-react';

import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { CanvasNodeData } from '@/shared/types/nodes';

import {
  NodeCard,
  NodeHeader,
  NodePortIndicator,
  getNodeCategoryLabel,
  getNodeCategoryVisuals,
} from './components/node-chrome';

interface CanvasNodeProps extends NodeProps<CanvasNodeData> {
  onOpenCanvas?: () => void;
}

export function CanvasNode({ data, selected, onOpenCanvas }: CanvasNodeProps) {
  const nodeDefinition = getNodeDefinition('canvas');
  const category = nodeDefinition?.execution.category;
  const visuals = getNodeCategoryVisuals(category);
  const categoryLabel = getNodeCategoryLabel(category);

  const handleDoubleClick = () => {
    if (onOpenCanvas) {
      onOpenCanvas();
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const ws = params.get('workspace');
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'canvas');
    url.searchParams.set('node', data?.identifier?.id ?? '');
    if (ws) url.searchParams.set('workspace', ws);
    window.history.pushState({}, '', url.toString());
  };

  return (
    <NodeCard selected={selected} className="cursor-pointer" onDoubleClick={handleDoubleClick}>
      {nodeDefinition?.ports.inputs.map((port) => (
        <NodePortIndicator
          key={port.id}
          id={port.id}
          side="left"
          type="target"
          top="50%"
          label="Objects to style"
          description="Connect the items you want to adjust on the canvas."
          handleClassName={visuals.handle}
          accent={category}
        />
      ))}

      <NodeHeader
        icon={<Palette size={14} />}
        title={data?.identifier?.displayName ?? 'Canvas'}
        accentClassName={visuals.iconBg}
        subtitle={categoryLabel}
      />

      <div className="space-y-[var(--space-2)] text-xs text-[var(--text-secondary)]">
        <div className="flex items-center justify-between">
          <span>Opacity</span>
          <span className="font-medium text-[var(--text-primary)]">{data.opacity ?? 1}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Fill color</span>
          <span className="font-medium text-[var(--text-primary)]">
            {data.fillColor ?? '#ffffff'}
          </span>
        </div>
        <div className="rounded border border-dashed border-[var(--border-primary)] px-[var(--space-3)] py-[var(--space-2)] text-[11px]">
          Double-click to adjust transforms and layer order in the canvas panel.
        </div>
      </div>

      {nodeDefinition?.ports.outputs.map((port) => (
        <NodePortIndicator
          key={port.id}
          id={port.id}
          side="right"
          type="source"
          top="50%"
          label="Styled objects"
          description="Outputs the objects with canvas styling applied."
          handleClassName={visuals.handle}
          accent={category}
        />
      ))}
    </NodeCard>
  );
}
