// src/components/workspace/nodes/batch-node.tsx - Batch tagging node UI
'use client';

import React from 'react';
import type { NodeProps } from 'reactflow';
import { Tag } from 'lucide-react';

import { useWorkspace } from '@/components/workspace/workspace-context';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { NodeData } from '@/shared/types/nodes';

import {
  NodeCard,
  NodeHeader,
  NodePortIndicator,
  getNodeCategoryLabel,
  getNodeCategoryVisuals,
} from './components/node-chrome';

export function BatchNode({ id }: { id: string }) {
  const { state, updateFlow } = useWorkspace();
  const node = state.flow.nodes.find((n) => n.id === id);
  const nodeId = node?.data?.identifier?.id ?? id;

  const data = (node?.data ?? {}) as unknown as Record<string, unknown> & {
    keys?: string[];
    variableBindings?: Record<string, { boundResultNodeId?: string }>;
  };
  const keys = Array.isArray(data.keys)
    ? (data.keys as unknown[]).filter((k) => typeof k === 'string')
    : [];

  const [open, setOpen] = React.useState(false);
  const [localInput, setLocalInput] = React.useState('');

  const nodeDefinition = getNodeDefinition('batch');
  const category = nodeDefinition?.execution.category;
  const visuals = getNodeCategoryVisuals(category);
  const categoryLabel = getNodeCategoryLabel(category);

  return (
    <NodeCard className="cursor-pointer" onDoubleClick={() => setOpen(true)}>
      {nodeDefinition?.ports.inputs.map((port) => (
        <NodePortIndicator
          key={port.id}
          id={port.id}
          side="left"
          type="target"
          top="50%"
          label="Incoming stream"
          description="Objects passing through will receive tags."
          handleClassName={visuals.handle}
          accent={category}
          onHandleDoubleClick={(event) => event.stopPropagation()}
        />
      ))}

      <NodeHeader
        icon={<Tag size={14} />}
        title={node?.data?.identifier?.displayName ?? 'Batch'}
        accentClassName={visuals.iconBg}
        subtitle={categoryLabel}
        meta={<span className="text-xs text-[var(--text-secondary)]">{keys.length} keys</span>}
      />

      <div className="space-y-[var(--space-2)] text-xs text-[var(--text-secondary)]">
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          Manage keys
        </Button>
        <div className="text-xs text-[var(--text-muted)]">
          Batch processing
        </div>
      </div>

      {nodeDefinition?.ports.outputs.map((port) => (
        <NodePortIndicator
          key={port.id}
          id={port.id}
          side="right"
          type="source"
          top="50%"
          label="Tagged stream"
          description="Outputs the same objects with batch metadata attached."
          handleClassName={visuals.handle}
          accent={category}
          onHandleDoubleClick={(event) => event.stopPropagation()}
        />
      ))}

      {open ? (
        <Modal isOpen={open} onClose={() => setOpen(false)} title="Batch keys" size="sm">
          <div className="space-y-[var(--space-3)] p-[var(--space-4)] text-xs text-[var(--text-secondary)]">
            <div className="text-[11px] text-[var(--text-tertiary)]">
              Add or remove keys. Updates apply immediately.
            </div>
            <div className="flex gap-[var(--space-2)]">
              <Input
                placeholder="Enter key"
                value={localInput}
                onChange={(e) => setLocalInput(e.target.value)}
              />
              <Button
                onClick={() => {
                  const value = localInput.trim();
                  if (!value || keys.includes(value)) return;
                  const nextKeys = [...keys, value];
                  updateFlow({
                    nodes: state.flow.nodes.map((n) =>
                      n.id !== id
                        ? n
                        : {
                            ...n,
                            data: {
                              ...n.data,
                              keys: nextKeys,
                            } as NodeData,
                          }
                    ),
                  });
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(
                      new CustomEvent('batch-keys-updated', {
                        detail: {
                          nodeIdentifierId: nodeId,
                          keys: [...nextKeys],
                        },
                      })
                    );
                  }
                  setLocalInput('');
                }}
              >
                Add
              </Button>
            </div>

            <div className="space-y-[var(--space-2)]">
              {keys.length === 0 ? (
                <div className="text-[11px] text-[var(--text-tertiary)]">No keys yet.</div>
              ) : (
                keys.map((k) => (
                  <div
                    key={k}
                    className="flex items-center justify-between rounded border border-[var(--border-primary)] px-[var(--space-2)] py-[var(--space-1)]"
                  >
                    <div>{k}</div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const nextKeys = keys.filter((x) => x !== k);
                        updateFlow({
                          nodes: state.flow.nodes.map((n) =>
                            n.id !== id
                              ? n
                              : {
                                  ...n,
                                  data: {
                                    ...n.data,
                                    keys: nextKeys,
                                  } as NodeData,
                                }
                          ),
                        });
                        if (typeof window !== 'undefined') {
                          window.dispatchEvent(
                            new CustomEvent('batch-keys-updated', {
                              detail: {
                                nodeIdentifierId: nodeId,
                                keys: [...nextKeys],
                              },
                            })
                          );
                        }
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </Modal>
      ) : null}
    </NodeCard>
  );
}
