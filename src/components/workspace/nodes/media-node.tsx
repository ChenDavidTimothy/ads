'use client';

import { useMemo } from 'react';
import type { NodeProps } from 'reactflow';
import { Image, Settings } from 'lucide-react';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import { NodeLayout, type PortConfig } from './components/node-layout';
import type { MediaNodeData } from '@/shared/types/nodes';

export function MediaNode({
  data,
  selected,
  onOpenMedia,
}: NodeProps<MediaNodeData> & { onOpenMedia?: () => void }) {
  const nodeDefinition = getNodeDefinition('media');

  const inputs = useMemo<PortConfig[]>(() => {
    const definitions = nodeDefinition?.ports.inputs ?? [];
    if (definitions.length === 0) {
      return [
        {
          id: 'input',
          label: 'Image input',
          tooltip: 'Connect an image stream or asset',
          handleClassName: 'bg-[var(--node-animation)]',
        },
      ];
    }

    return definitions.map((port) => ({
      id: port.id,
      label: 'Image input',
      tooltip: 'Connect an image stream or asset',
      handleClassName: 'bg-[var(--node-animation)]',
    }));
  }, [nodeDefinition]);

  const outputs = useMemo<PortConfig[]>(() => {
    const definitions = nodeDefinition?.ports.outputs ?? [];
    if (definitions.length === 0) {
      return [
        {
          id: 'output',
          label: 'Media output',
          tooltip: 'Emits the edited media asset',
          handleClassName: 'bg-[var(--node-animation)]',
        },
      ];
    }

    return definitions.map((port) => ({
      id: port.id,
      label: 'Media output',
      tooltip: 'Emits the edited media asset',
      handleClassName: 'bg-[var(--node-animation)]',
    }));
  }, [nodeDefinition]);

  const currentAsset = data.imageAssetId ? 'Selected' : 'No asset';
  const cropInfo = data.cropWidth > 0 ? `${data.cropWidth}×${data.cropHeight}` : 'Full size';
  const displayInfo = data.displayWidth > 0 ? `${data.displayWidth}×${data.displayHeight}` : 'Auto';

  const handleDoubleClick = () => {
    if (onOpenMedia) {
      onOpenMedia();
      return;
    }

    window.dispatchEvent(
      new CustomEvent('open-media-editor', {
        detail: { nodeId: data.identifier.id },
      })
    );
  };

  return (
    <NodeLayout
      selected={selected}
      title={data.identifier.displayName}
      subtitle="Media preparation"
      icon={<Image size={14} aria-label="Media node icon" />}
      iconClassName="bg-[var(--node-animation)]"
      inputs={inputs}
      outputs={outputs}
      onDoubleClick={handleDoubleClick}
      className="cursor-pointer"
      headerAccessory={<Settings size={12} className="text-[var(--text-tertiary)]" />}
      footer="Double-click to edit in the Media tab"
    >
      <div className="text-xs text-[var(--text-secondary)]">Asset: {currentAsset}</div>
      <div className="text-xs text-[var(--text-secondary)]">Crop: {cropInfo}</div>
      <div className="text-xs text-[var(--text-secondary)]">Display: {displayInfo}</div>
    </NodeLayout>
  );
}
