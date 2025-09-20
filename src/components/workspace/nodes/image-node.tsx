'use client';

import type { NodeProps } from 'reactflow';

import { NodeLayout } from './node-layout';
import { buildPortDisplays } from './port-utils';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { ImageNodeData } from '@/shared/types/nodes';
import { Image as ImageIcon } from 'lucide-react';

export function ImageNode({ data, selected }: NodeProps<ImageNodeData>) {
  const nodeDefinition = getNodeDefinition('image');
  const outputs = buildPortDisplays(nodeDefinition?.ports.outputs, 'output', {
    output: {
      label: 'Image asset for scenes',
      description: 'Passes the selected still image to media or canvas nodes.',
    },
  });

  return (
    <NodeLayout
      selected={selected}
      title={data.identifier.displayName}
      subtitle="Starter image asset"
      icon={<ImageIcon className="h-3 w-3" />}
      iconBackgroundClass="bg-[var(--node-input)] text-[var(--text-primary)]"
      inputs={[]}
      outputs={outputs}
      accentHandleClass="!bg-[var(--node-input)]"
      footer="Connect to a Media node to choose and crop the image"
    >
      <div className="text-xs text-[var(--text-secondary)]">
        Placeholder asset until a media item is selected.
      </div>
    </NodeLayout>
  );
}
