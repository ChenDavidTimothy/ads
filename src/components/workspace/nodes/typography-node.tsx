'use client';

import { useMemo } from 'react';
import type { NodeProps } from 'reactflow';
import { Type } from 'lucide-react';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import { NodeLayout, type PortConfig } from './components/node-layout';
import type { TypographyNodeData } from '@/shared/types/nodes';

interface TypographyNodeProps extends NodeProps<TypographyNodeData> {
  onOpenTypography?: () => void;
}

export function TypographyNode({ data, selected, onOpenTypography }: TypographyNodeProps) {
  const nodeDefinition = getNodeDefinition('typography');

  const inputs = useMemo<PortConfig[]>(() => {
    const definitions = nodeDefinition?.ports.inputs ?? [];
    if (definitions.length === 0) {
      return [
        {
          id: 'input',
          label: 'Text objects',
          tooltip: 'Incoming text objects that will be styled',
          handleClassName: 'bg-[var(--node-animation)]',
        },
      ];
    }

    return definitions.map((port) => ({
      id: port.id,
      label: 'Text objects',
      tooltip: 'Incoming text objects that will be styled',
      handleClassName: 'bg-[var(--node-animation)]',
    }));
  }, [nodeDefinition]);

  const outputs = useMemo<PortConfig[]>(() => {
    const definitions = nodeDefinition?.ports.outputs ?? [];
    if (definitions.length === 0) {
      return [
        {
          id: 'output',
          label: 'Styled text',
          tooltip: 'Emits text objects with typography applied',
          handleClassName: 'bg-[var(--node-animation)]',
        },
      ];
    }

    return definitions.map((port) => ({
      id: port.id,
      label: 'Styled text',
      tooltip: 'Emits text objects with typography applied',
      handleClassName: 'bg-[var(--node-animation)]',
    }));
  }, [nodeDefinition]);

  const currentFont = `${data.fontFamily ?? 'Arial'} ${data.fontWeight ?? 'normal'}`;

  const handleDoubleClick = () => {
    if (onOpenTypography) {
      onOpenTypography();
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const ws = params.get('workspace');
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'typography');
    url.searchParams.set('node', data.identifier.id);
    if (ws) url.searchParams.set('workspace', ws);
    window.history.pushState({}, '', url.toString());
  };

  return (
    <NodeLayout
      selected={selected}
      title={data.identifier.displayName}
      subtitle={
        data.content
          ? data.content.length > 40
            ? `${data.content.slice(0, 37)}…`
            : data.content
          : 'Typography styling'
      }
      icon={<Type size={14} />}
      iconClassName="bg-[var(--node-animation)]"
      inputs={inputs}
      outputs={outputs}
      onDoubleClick={handleDoubleClick}
      className="cursor-pointer"
    >
      <div className="text-xs text-[var(--text-secondary)]">Font: {currentFont}</div>
      <div className="flex items-center justify-between text-xs">
        <span>Align</span>
        <span className="font-medium text-[var(--text-primary)]">{data.textAlign ?? 'center'}</span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span>Line height</span>
        <span className="font-medium text-[var(--text-primary)]">{data.lineHeight ?? 1.2}</span>
      </div>
    </NodeLayout>
  );
}
