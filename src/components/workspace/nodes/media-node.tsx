'use client';

import type { NodeProps } from 'reactflow';

import { NodeLayout } from './node-layout';
import { buildPortDisplays } from './port-utils';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { MediaNodeData } from '@/shared/types/nodes';
import { Image as ImageIcon, Settings } from 'lucide-react';

export function MediaNode({
  data,
  selected,
  onOpenMedia,
}: NodeProps<MediaNodeData> & { onOpenMedia?: () => void }) {
  const nodeDefinition = getNodeDefinition('media');

  const inputs = buildPortDisplays(nodeDefinition?.ports.inputs, 'input', {
    input: {
      label: 'Image objects to refine',
      description: 'Connect upstream image objects before applying media adjustments.',
    },
  });

  const outputs = buildPortDisplays(nodeDefinition?.ports.outputs, 'output', {
    output: {
      label: 'Media-adjusted image objects',
      description: 'Delivers cropped and sized images to the rest of your scene.',
    },
  });

  const handleDoubleClick = () => {
    if (onOpenMedia) {
      onOpenMedia();
      return;
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('open-media-editor', {
          detail: { nodeId: data.identifier.id },
        })
      );
    }
  };

  const assetStatus = data.imageAssetId ? 'Asset selected' : 'No asset';
  const cropInfo =
    data.cropWidth > 0 && data.cropHeight > 0
      ? `${data.cropWidth}×${data.cropHeight}`
      : 'Full frame';
  const displayInfo =
    data.displayWidth > 0 && data.displayHeight > 0
      ? `${data.displayWidth}×${data.displayHeight}`
      : 'Auto fit';

  return (
    <NodeLayout
      selected={selected}
      className="cursor-pointer transition-colors hover:bg-[var(--surface-interactive)]"
      title={data.identifier.displayName}
      subtitle={data.imageAssetId ? 'Asset linked from library' : 'No asset linked yet'}
      icon={<ImageIcon className="h-3 w-3" />}
      iconBackgroundClass="bg-[var(--node-animation)] text-[var(--text-primary)]"
      headerAside={<Settings className="h-3 w-3 text-[var(--text-tertiary)]" />}
      inputs={inputs}
      outputs={outputs}
      accentHandleClass="!bg-[var(--node-animation)]"
      onDoubleClick={handleDoubleClick}
      footer="Double-click to open the Media editor"
    >
      <div className="flex items-center justify-between text-xs">
        <span>Asset</span>
        <span className="font-medium text-[var(--text-primary)]">{assetStatus}</span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span>Crop</span>
        <span className="font-medium text-[var(--text-primary)]">{cropInfo}</span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span>Display</span>
        <span className="font-medium text-[var(--text-primary)]">{displayInfo}</span>
      </div>
    </NodeLayout>
  );
}
