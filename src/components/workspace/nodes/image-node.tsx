'use client';

import { useMemo } from 'react';
import type { NodeProps } from 'reactflow';
import { Image } from 'lucide-react';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import { NodeLayout, type PortConfig } from './components/node-layout';
import type { ImageNodeData } from '@/shared/types/nodes';

export function ImageNode({ data, selected }: NodeProps<ImageNodeData>) {
  const nodeDefinition = getNodeDefinition('image');

  const outputs = useMemo<PortConfig[]>(() => {
    const definitions = nodeDefinition?.ports.outputs ?? [];
    return definitions.map((port) => ({
      id: port.id,
      label: port.label || 'Image stream',
      tooltip: 'Provides image assets to downstream nodes',
      handleClassName: 'bg-[var(--node-input)]',
    }));
  }, [nodeDefinition]);

  return (
    <NodeLayout
      selected={selected}
      title={data.identifier.displayName}
      subtitle="Imported image asset"
      icon={<Image size={14} aria-label="Image node icon" />}
      iconClassName="bg-[var(--node-input)]"
      inputs={[]}
      outputs={outputs}
    >
      <div className="text-xs text-[var(--text-secondary)]">Connect to a Media node to edit this image.</div>
    </NodeLayout>
  );
}
