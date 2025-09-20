'use client';

import { useMemo, useState } from 'react';
import { useWorkspace } from '@/components/workspace/workspace-context';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { getNodeDefinition } from '@/shared/registry/registry-utils';
import { NodeLayout, type PortConfig } from './components/node-layout';
import type { NodeData } from '@/shared/types/nodes';

export function BatchNode({ id }: { id: string }) {
  const { state, updateFlow } = useWorkspace();
  const node = state.flow.nodes.find((n) => n.id === id);
  const nodeId = node?.data?.identifier?.id ?? id;

  const data = (node?.data ?? {}) as Record<string, unknown> & {
    keys?: string[];
    variableBindings?: Record<string, { boundResultNodeId?: string }>;
  };
  const keys = Array.isArray(data.keys)
    ? (data.keys as unknown[]).filter((k): k is string => typeof k === 'string')
    : [];

  const [open, setOpen] = useState(false);
  const [localInput, setLocalInput] = useState('');

  const nodeDefinition = getNodeDefinition('batch');

  const inputs = useMemo<PortConfig[]>(() => {
    const definitions = nodeDefinition?.ports.inputs ?? [];
    if (definitions.length === 0) {
      return [
        {
          id: 'input',
          label: 'Stream to batch',
          tooltip: 'Incoming data that should be processed in batches',
          handleClassName: 'bg-[var(--node-logic)]',
          handleProps: { onDoubleClick: (event) => event.stopPropagation() },
        },
      ];
    }

    return definitions.map((port) => ({
      id: port.id,
      label: 'Stream to batch',
      tooltip: 'Incoming data that should be processed in batches',
      handleClassName: 'bg-[var(--node-logic)]',
      handleProps: { onDoubleClick: (event) => event.stopPropagation() },
    }));
  }, [nodeDefinition]);

  const outputs = useMemo<PortConfig[]>(() => {
    const definitions = nodeDefinition?.ports.outputs ?? [];
    if (definitions.length === 0) {
      return [
        {
          id: 'output',
          label: 'Batch results',
          tooltip: 'Emits one result per key for each item in the batch',
          handleClassName: 'bg-[var(--node-logic)]',
          handleProps: { onDoubleClick: (event) => event.stopPropagation() },
        },
      ];
    }

    return definitions.map((port) => ({
      id: port.id,
      label: 'Batch results',
      tooltip: 'Emits one result per key for each item in the batch',
      handleClassName: 'bg-[var(--node-logic)]',
      handleProps: { onDoubleClick: (event) => event.stopPropagation() },
    }));
  }, [nodeDefinition]);

  const handleAddKey = () => {
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

  const handleRemoveKey = (key: string) => {
    const nextKeys = keys.filter((k) => k !== key);
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
        selected={Boolean(node?.selected)}
        title={node?.data?.identifier?.displayName ?? 'Batch'}
        subtitle={`${keys.length} key${keys.length === 1 ? '' : 's'} configured`}
        icon={
          <span role="img" aria-label="batch">
            🏷️
          </span>
        }
        iconClassName="bg-[var(--node-logic)]"
        inputs={inputs}
        outputs={outputs}
        onDoubleClick={() => setOpen(true)}
        className="cursor-pointer"
        footer="Double-click to manage batch outputs"
      >
      </NodeLayout>

      {open ? (
        <Modal isOpen={open} onClose={() => setOpen(false)} title="Batch Keys" size="sm">
          <div className="p-[var(--space-4)]">
            <div className="mb-[var(--space-2)] text-[12px] text-[var(--text-secondary)]">
              Add or remove keys
            </div>
            <div className="flex gap-[var(--space-2)]">
              <Input
                placeholder="Enter key"
                value={localInput}
                onChange={(event) => setLocalInput(event.target.value)}
              />
              <Button onClick={handleAddKey}>Add</Button>
            </div>

            <div className="mt-[var(--space-3)] space-y-[var(--space-2)]">
              {keys.length === 0 ? (
                <div className="text-[12px] text-[var(--text-tertiary)]">No keys yet.</div>
              ) : (
                keys.map((key) => (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded border border-[var(--border)] px-[var(--space-2)] py-[var(--space-1)]"
                  >
                    <div className="text-[12px]">{key}</div>
                    <Button variant="ghost" size="sm" onClick={() => handleRemoveKey(key)}>
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
