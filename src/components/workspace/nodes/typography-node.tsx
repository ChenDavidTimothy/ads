'use client';

import type { NodeProps } from 'reactflow';

import { NodeLayout } from './node-layout';
import { buildPortDisplays } from './port-utils';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { TypographyNodeData } from '@/shared/types/nodes';
import { Settings, Type } from 'lucide-react';

interface TypographyNodeProps extends NodeProps<TypographyNodeData> {
  onOpenTypography?: () => void;
}

export function TypographyNode({ data, selected, onOpenTypography }: TypographyNodeProps) {
  const nodeDefinition = getNodeDefinition('typography');

  const inputs = buildPortDisplays(nodeDefinition?.ports.inputs, 'input', {
    input: {
      label: 'Text objects to style',
      description: 'Feed raw text objects to apply typography presets.',
    },
  });

  const outputs = buildPortDisplays(nodeDefinition?.ports.outputs, 'output', {
    output: {
      label: 'Typography-styled text',
      description: 'Produces text objects with the selected typography applied.',
    },
  });

  const handleDoubleClick = () => {
    if (onOpenTypography) return onOpenTypography();

    const params = new URLSearchParams(window.location.search);
    const ws = params.get('workspace');
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'typography');
    url.searchParams.set('node', data?.identifier?.id ?? '');
    if (ws) url.searchParams.set('workspace', ws);
    window.history.pushState({}, '', url.toString());
  };

  const fontFamily = data.fontFamily || 'Arial';
  const fontWeight = data.fontWeight || 'normal';
  const subtitle = `${fontFamily} ${fontWeight}`;
  return (
    <NodeLayout
      selected={selected}
      className="cursor-pointer transition-colors hover:bg-[var(--surface-interactive)]"
      title={data?.identifier?.displayName ?? 'Typography'}
      subtitle={subtitle}
      icon={<Type className="h-3 w-3" />}
      iconBackgroundClass="bg-[var(--node-animation)] text-[var(--text-primary)]"
      headerAside={<Settings className="h-3 w-3 text-[var(--text-tertiary)]" />}
      inputs={inputs}
      outputs={outputs}
      accentHandleClass="!bg-[var(--node-animation)]"
      onDoubleClick={handleDoubleClick}
      footer="Double-click to open the Typography editor"
    >
      <div className="flex items-center justify-between text-xs">
        <span>Align</span>
        <span className="font-medium text-[var(--text-primary)]">{data.textAlign || 'center'}</span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span>Line height</span>
        <span className="font-medium text-[var(--text-primary)]">{data.lineHeight ?? 1.2}</span>
      </div>
    </NodeLayout>
  );
}
