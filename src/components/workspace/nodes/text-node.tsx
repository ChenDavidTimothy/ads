'use client';

import { useMemo } from 'react';
import type { NodeProps } from 'reactflow';
import { Type } from 'lucide-react';
import { NodeLayout, type PortConfig } from './components/node-layout';
import type { TextNodeData } from '@/shared/types/nodes';

export function TextNode({ data, selected }: NodeProps<TextNodeData>) {
  const displayContent = useMemo(() => {
    const content = data.content || 'Hello World';
    return content.length > 40 ? `${content.slice(0, 37)}…` : content;
  }, [data.content]);

  const outputs = useMemo<PortConfig[]>(
    () => [
      {
        id: 'output',
        label: 'Text object',
        tooltip: 'Outputs the configured text element',
        handleClassName: 'bg-[var(--node-text)]',
      },
    ],
    [],
  );

  return (
    <NodeLayout
      selected={selected}
      title={data.identifier.displayName}
      subtitle={displayContent}
      icon={<Type size={14} />}
      iconClassName="bg-[var(--node-text)]"
      inputs={[]}
      outputs={outputs}
    >
      <div className="flex items-center justify-between">
        <span>Font size</span>
        <span className="font-medium text-[var(--text-primary)]">{data.fontSize}px</span>
      </div>
    </NodeLayout>
  );
}
