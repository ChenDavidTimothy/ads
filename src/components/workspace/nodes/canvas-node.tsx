'use client';

import type { NodeProps } from 'reactflow';

import { NodeLayout } from './node-layout';
import { buildPortDisplays } from './port-utils';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { CanvasNodeData } from '@/shared/types/nodes';
import { Palette } from 'lucide-react';

type CanvasNodeProps = NodeProps<CanvasNodeData> & {
  onOpenCanvas?: () => void;
};

export function CanvasNode({ data, selected, onOpenCanvas }: CanvasNodeProps) {
  const nodeDefinition = getNodeDefinition('canvas');

  const inputs = buildPortDisplays(nodeDefinition?.ports.inputs, 'input', {
    input: {
      label: 'Objects to style',
      description: 'Connect shapes, text, or media to apply static styling.',
    },
  });

  const outputs = buildPortDisplays(nodeDefinition?.ports.outputs, 'output', {
    output: {
      label: 'Styled objects',
      description: 'Outputs objects with the canvas styling applied.',
    },
  });

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
    <NodeLayout
      selected={selected}
      className="cursor-pointer transition-colors hover:bg-[var(--surface-interactive)]"
      title={data?.identifier?.displayName ?? 'Canvas'}
      subtitle="Static styling adjustments"
      icon={<Palette className="h-3 w-3" />}
      iconBackgroundClass="bg-[var(--node-geometry)] text-[var(--text-primary)]"
      inputs={inputs}
      outputs={outputs}
      accentHandleClass="!bg-[var(--node-geometry)]"
      onDoubleClick={handleDoubleClick}
      footer="Double-click to edit in the Canvas tab"
    >
      <div className="text-xs text-[var(--text-secondary)]">
        Use the Canvas editor to fine-tune fill, stroke, and transforms.
      </div>
    </NodeLayout>
  );
}
