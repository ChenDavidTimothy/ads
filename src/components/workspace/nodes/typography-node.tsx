// src/components/workspace/nodes/typography-node.tsx - Typography node UI
'use client';

import type { NodeProps } from 'reactflow';
import { Type, SlidersHorizontal } from 'lucide-react';

import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { TypographyNodeData } from '@/shared/types/nodes';

import {
  NodeCard,
  NodeHeader,
  NodePortIndicator,
  getNodeCategoryLabel,
  getNodeCategoryVisuals,
} from './components/node-chrome';

interface TypographyNodeProps extends NodeProps<TypographyNodeData> {
  onOpenTypography?: () => void;
}

export function TypographyNode({ data, selected, onOpenTypography }: TypographyNodeProps) {
  const nodeDefinition = getNodeDefinition('typography');
  const category = nodeDefinition?.execution.category;
  const visuals = getNodeCategoryVisuals(category);
  const categoryLabel = getNodeCategoryLabel(category);

  const handleDoubleClick = () => {
    if (onOpenTypography) {
      onOpenTypography();
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const ws = params.get('workspace');
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'typography');
    url.searchParams.set('node', data?.identifier?.id ?? '');
    if (ws) url.searchParams.set('workspace', ws);
    window.history.pushState({}, '', url.toString());
  };

  const currentFont = `${data.fontFamily || 'Arial'} ${data.fontWeight || 'normal'}`;

  return (
    <NodeCard selected={selected} className="cursor-pointer" onDoubleClick={handleDoubleClick}>
      {nodeDefinition?.ports.inputs.map((port) => (
        <NodePortIndicator
          key={port.id}
          id={port.id}
          side="left"
          type="target"
          top="50%"
          label="Text to style"
          description="Feed in the text elements you want to format."
          handleClassName={visuals.handle}
          accent={category}
        />
      ))}

      <NodeHeader
        icon={<Type size={14} />}
        title={data?.identifier?.displayName ?? 'Typography'}
        accentClassName={visuals.iconBg}
        subtitle={categoryLabel}
        meta={
          <span className="flex items-center gap-[var(--space-1)] text-xs text-[var(--text-secondary)]">
            <SlidersHorizontal size={12} />
            {currentFont}
          </span>
        }
      />

      <div className="space-y-[var(--space-2)] text-xs text-[var(--text-secondary)]">
        <div className="flex items-center justify-between">
          <span>Alignment</span>
          <span className="font-medium text-[var(--text-primary)]">
            {data.textAlign || 'center'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Line height</span>
          <span className="font-medium text-[var(--text-primary)]">{data.lineHeight ?? 1.2}</span>
        </div>
        <div className="text-xs text-[var(--text-muted)]">Advanced text styling</div>
      </div>

      {nodeDefinition?.ports.outputs.map((port) => (
        <NodePortIndicator
          key={port.id}
          id={port.id}
          side="right"
          type="source"
          top="50%"
          label="Styled text"
          description="Outputs the text with the configured typography applied."
          handleClassName={visuals.handle}
          accent={category}
        />
      ))}
    </NodeCard>
  );
}
