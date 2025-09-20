'use client';

import type { NodeProps } from 'reactflow';

import { NodeLayout } from './node-layout';
import { buildPortDisplays } from './port-utils';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { TextNodeData } from '@/shared/types/nodes';
import { Type } from 'lucide-react';

export function TextNode({ data, selected }: NodeProps<TextNodeData>) {
  const nodeDefinition = getNodeDefinition('text');

  const outputs = buildPortDisplays(nodeDefinition?.ports.outputs, 'output', {
    output: {
      label: 'Text content for scene layout',
      description: 'Sends styled text content to typography or animation nodes.',
    },
  });

  const content = data.content?.trim() || 'Hello World';
  const preview = content.length > 28 ? `${content.substring(0, 25)}…` : content;
  const fontSize = data.fontSize ?? 24;

  return (
    <NodeLayout
      selected={selected}
      title={data.identifier.displayName}
      subtitle={`Preview: ${preview}`}
      icon={<Type className="h-3 w-3" />}
      iconBackgroundClass="bg-[var(--node-text)] text-[var(--text-primary)]"
      inputs={[]}
      outputs={outputs}
      accentHandleClass="!bg-[var(--node-text)]"
      footer="Double-click to edit text in the Typography tab"
    >
      <div className="rounded bg-[var(--surface-2)]/80 px-[var(--space-2)] py-[var(--space-1)] font-mono text-[10px] text-[var(--text-primary)]">
        “{preview}”
      </div>
      <div className="flex items-center justify-between text-xs">
        <span>Font size</span>
        <span className="font-medium text-[var(--text-primary)]">{fontSize}px</span>
      </div>
    </NodeLayout>
  );
}
