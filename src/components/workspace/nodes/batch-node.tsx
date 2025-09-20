'use client';

import { useState } from 'react';

import { NodeLayout } from './node-layout';
import { buildPortDisplays } from './port-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useWorkspace } from '@/components/workspace/workspace-context';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import type { NodeData } from '@/shared/types/nodes';
import type { BatchNodeData } from '@/shared/types/nodes';

export function BatchNode({ id }: { id: string }) {
  const { state, updateFlow } = useWorkspace();
  const node = state.flow.nodes.find((n) => n.id === id);
  const nodeId = node?.data?.identifier?.id ?? id;

  const data = (node?.data ?? {}) as unknown as BatchNodeData & {
    variableBindings?: Record<string, { boundResultNodeId?: string }>;
  };
  const keys = Array.isArray(data.keys)
    ? (data.keys as unknown[]).filter((k) => typeof k === 'string')
    : [];

  const [open, setOpen] = useState(false);
  const [localInput, setLocalInput] = useState('');

  const nodeDefinition = getNodeDefinition('batch');

  const inputs = buildPortDisplays(nodeDefinition?.ports.inputs, 'input', {
    input: {
      label: 'Objects to tag',
      description: 'Connect objects that should be grouped by batch keys.',
    },
  });

  const outputs = buildPortDisplays(nodeDefinition?.ports.outputs, 'output', {
    output: {
      label: 'Tagged objects',
      description: 'Forwards the objects with batch metadata attached.',
    },
  });

  const openModal = () => setOpen(true);
  const closeModal = () => setOpen(false);

  const addKey = () => {
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
  };

  const removeKey = (keyToRemove: string) => {
    const nextKeys = keys.filter((key) => key !== keyToRemove);
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
  };

  return (
    <>
      <NodeLayout
        selected={node?.selected ?? false}
        className="cursor-pointer"
        title={node?.data?.identifier?.displayName ?? 'Batch'}
        subtitle={keys.length ? `${keys.length} key${keys.length === 1 ? '' : 's'} configured` : 'No keys yet'}
        icon={<span className="text-xs">🏷️</span>}
        iconBackgroundClass="bg-[var(--node-logic)] text-[var(--text-primary)]"
        inputs={inputs}
        outputs={outputs}
        accentHandleClass="!bg-[var(--node-logic)]"
        onDoubleClick={openModal}
        footer="Double-click or use the Keys button to edit batch tags"
      >
        <div className="flex items-center justify-between text-xs">
          <span>Keys</span>
          <span className="font-medium text-[var(--text-primary)]">{keys.length}</span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            openModal();
          }}
        >
          Manage keys
        </Button>
      </NodeLayout>

      {open ? (
        <Modal isOpen={open} onClose={closeModal} title="Batch Keys" size="sm">
          <div className="p-[var(--space-4)]">
            <div className="mb-[var(--space-2)] text-[12px] text-[var(--text-secondary)]">
              Add or remove keys used for batch rendering.
            </div>
            <div className="flex gap-[var(--space-2)]">
              <Input
                placeholder="Enter key"
                value={localInput}
                onChange={(e) => setLocalInput(e.target.value)}
              />
              <Button onClick={addKey}>Add</Button>
            </div>

            <div className="mt-[var(--space-3)] space-y-[var(--space-2)]">
              {keys.length === 0 ? (
                <div className="text-[12px] text-[var(--text-tertiary)]">No keys yet.</div>
              ) : (
                keys.map((key) => (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded border border-[var(--border-primary)] px-[var(--space-2)] py-[var(--space-1)]"
                  >
                    <div className="text-[12px]">{key}</div>
                    <Button variant="ghost" size="sm" onClick={() => removeKey(key)}>
                      Remove
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-[var(--space-3)] text-right text-[10px] text-[var(--text-tertiary)]">
              Changes update your workspace immediately. Use Save to persist.
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
