// src/components/workspace/nodes/if-else-node.tsx - If/Else node UI
'use client';

import type { NodeProps } from 'reactflow';
import { GitBranch } from 'lucide-react';

import type { IfElseNodeData } from '@/shared/types/nodes';
import { getNodeDefinition } from '@/shared/registry/registry-utils';

import {
  NodeCard,
  NodeHeader,
  NodePortIndicator,
  getNodeCategoryLabel,
  getNodeCategoryVisuals,
} from './components/node-chrome';

export function IfElseNode({ data, selected }: NodeProps<IfElseNodeData>) {
  const nodeDefinition = getNodeDefinition('if_else');
  const category = nodeDefinition?.execution.category;
  const visuals = getNodeCategoryVisuals(category);
  const categoryLabel = getNodeCategoryLabel(category);

  return (
    <NodeCard selected={selected}>
      <NodePortIndicator
        id="condition"
        side="left"
        type="target"
        top="35%"
        label="Condition signal"
        description="When this is active the True branch is used."
        handleClassName={visuals.handle}
        accent={category}
      />
      <NodePortIndicator
        id="data"
        side="left"
        type="target"
        top="65%"
        label="Data to route"
        description="This payload is sent to either branch."
        handleClassName={visuals.handle}
        accent={category}
      />

      <NodeHeader
        icon={<GitBranch size={14} />}
        title={data.identifier.displayName}
        accentClassName={visuals.iconBg}
        subtitle={categoryLabel}
      />

      <div className="space-y-[var(--space-2)] text-xs text-[var(--text-secondary)]">
        <div className="text-xs text-[var(--text-muted)]">Conditional routing</div>
      </div>

      <NodePortIndicator
        id="true_path"
        side="right"
        type="source"
        top="35%"
        label="True path"
        description="Emits when the condition is active."
        handleClassName="!bg-[var(--success-500)]"
        badgeClassName="border border-[rgba(16,185,129,0.45)] bg-[rgba(16,185,129,0.16)] text-[var(--text-primary)]"
        icon={<span className="text-[0.65rem] leading-none">✓</span>}
      />
      <NodePortIndicator
        id="false_path"
        side="right"
        type="source"
        top="65%"
        label="False path"
        description="Emits when the condition is inactive."
        handleClassName="!bg-[var(--danger-500)]"
        badgeClassName="border border-[rgba(239,68,68,0.45)] bg-[rgba(239,68,68,0.18)] text-[var(--text-primary)]"
        icon={<span className="text-[0.65rem] leading-none">✕</span>}
      />
    </NodeCard>
  );
}
