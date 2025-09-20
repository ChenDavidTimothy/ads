// src/components/workspace/nodes/text-node.tsx - Text source node UI
'use client';

import type { NodeProps } from 'reactflow';
import { Type } from 'lucide-react';

import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { TextNodeData } from '@/shared/types/nodes';

import {
  NodeCard,
  NodeHeader,
  NodePortIndicator,
  getNodeCategoryLabel,
  getNodeCategoryVisuals,
} from './components/node-chrome';

export function TextNode({ data, selected }: NodeProps<TextNodeData>) {
  const nodeDefinition = getNodeDefinition('text');
  const category = nodeDefinition?.execution.category;
  const visuals = getNodeCategoryVisuals(category);
  const categoryLabel = getNodeCategoryLabel(category);

  const content = data.content?.trim() ?? 'Hello World';
  const previewContent = content.length > 40 ? `${content.slice(0, 37)}…` : content;
  const fontSize = data.fontSize ?? (nodeDefinition?.defaults.fontSize as number) ?? 24;

  return (
    <NodeCard selected={selected}>
      <NodeHeader
        icon={<Type size={14} />}
        title={data.identifier.displayName}
        accentClassName={visuals.iconBg}
        subtitle={categoryLabel}
        meta={<span className="text-xs text-[var(--text-secondary)]">{fontSize}px</span>}
      />

      <div className="space-y-[var(--space-2)] text-xs text-[var(--text-secondary)]">
        <div className="rounded border border-[var(--border-primary)] bg-[var(--surface-2)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-primary)]">
          “{previewContent}”
        </div>
        <div className="text-xs text-[var(--text-muted)]">
          Text content source
        </div>
      </div>

      {nodeDefinition?.ports.outputs.map((port) => (
        <NodePortIndicator
          key={port.id}
          id={port.id}
          side="right"
          type="source"
          top="50%"
          label="Text output"
          description="Sends this text element to the next node."
          handleClassName={visuals.handle}
          accent={category}
        />
      ))}
    </NodeCard>
  );
}
