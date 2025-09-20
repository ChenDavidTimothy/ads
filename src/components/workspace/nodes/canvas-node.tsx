'use client';

import { useMemo } from 'react';
import type { NodeProps } from 'reactflow';
import { Palette } from 'lucide-react';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import { NodeLayout, type PortConfig } from './components/node-layout';
import type { CanvasNodeData } from '@/shared/types/nodes';

type CanvasNodeProps = NodeProps<CanvasNodeData> & {
  onOpenCanvas?: () => void;
};

export function CanvasNode({ data, selected, onOpenCanvas }: CanvasNodeProps) {
  const nodeDefinition = getNodeDefinition('canvas');

  const inputs = useMemo<PortConfig[]>(() => {
    const definitions = nodeDefinition?.ports.inputs ?? [];
    if (definitions.length === 0) {
      return [
        {
          id: 'input',
          label: 'Objects to draw',
          tooltip: 'Incoming objects placed on this canvas',
          handleClassName: 'bg-[var(--node-geometry)]',
        },
      ];
    }

    return definitions.map((port) => ({
      id: port.id,
      label: 'Objects to draw',
      tooltip: 'Incoming objects placed on this canvas',
      handleClassName: 'bg-[var(--node-geometry)]',
    }));
  }, [nodeDefinition]);

  const outputs = useMemo<PortConfig[]>(() => {
    const definitions = nodeDefinition?.ports.outputs ?? [];
    if (definitions.length === 0) {
      return [
        {
          id: 'output',
          label: 'Canvas result',
          tooltip: 'Emits the composed canvas for downstream nodes',
          handleClassName: 'bg-[var(--node-geometry)]',
        },
      ];
    }

    return definitions.map((port) => ({
      id: port.id,
      label: 'Canvas result',
      tooltip: 'Emits the composed canvas for downstream nodes',
      handleClassName: 'bg-[var(--node-geometry)]',
    }));
  }, [nodeDefinition]);

  const handleDoubleClick = () => {
    if (onOpenCanvas) {
      onOpenCanvas();
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const ws = params.get('workspace');
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'canvas');
    url.searchParams.set('node', data.identifier.id);
    if (ws) url.searchParams.set('workspace', ws);
    window.history.pushState({}, '', url.toString());
  };

  return (
    <NodeLayout
      selected={selected}
      title={data.identifier.displayName}
      subtitle="Canvas composition"
      icon={<Palette size={14} />}
      iconClassName="bg-[var(--node-geometry)]"
      inputs={inputs}
      outputs={outputs}
      onDoubleClick={handleDoubleClick}
      measureDeps={[]}
      className="cursor-pointer"
      footer="Double-click to edit in the Canvas tab"
    />
  );
}
