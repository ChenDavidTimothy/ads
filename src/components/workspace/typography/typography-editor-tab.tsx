'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Node } from 'reactflow';
import { Type } from 'lucide-react';

import { SelectionList } from '@/components/ui/selection';
import { InspectorLayout } from '@/components/workspace/inspector';
import { useWorkspace } from '@/components/workspace/workspace-context';
import { FlowTracker } from '@/lib/flow/flow-tracking';
import { applyPerObjectAssignmentUpdate } from '@/shared/properties/assignments';
import type { PerObjectAssignments } from '@/shared/properties/assignments';
import type { TypographyNodeData } from '@/shared/types/nodes';

import { TypographyDefaultProperties } from './typography-default-properties';
import { TypographyPerObjectProperties } from './typography-per-object-properties';

export function TypographyEditorTab({ nodeId }: { nodeId: string }) {
  const { state, updateUI, updateFlow } = useWorkspace();

  const typographyNode = useMemo(
    () =>
      state.flow.nodes.find((n) => n.data?.identifier?.id === nodeId) as
        | Node<TypographyNodeData>
        | undefined,
    [state.flow.nodes, nodeId]
  );

  const assignments = useMemo<PerObjectAssignments>(
    () => typographyNode?.data?.perObjectAssignments ?? {},
    [typographyNode]
  );

  const upstreamObjects = useMemo(() => {
    const tracker = new FlowTracker();
    return tracker
      .getUpstreamObjects(nodeId, state.flow.nodes, state.flow.edges)
      .filter((obj) => obj.type === 'text')
      .map((obj) => ({
        data: {
          identifier: {
            id: obj.id,
            displayName: obj.displayName,
            type: obj.type,
          },
        },
        type: obj.type,
      }));
  }, [nodeId, state.flow.nodes, state.flow.edges]);

  useEffect(() => {
    console.log(
      `[Typography] Detected ${upstreamObjects.length} text objects for Typography node ${nodeId}:`,
      upstreamObjects.map((o) => ({
        id: o.data.identifier.id,
        name: o.data.identifier.displayName,
        type: o.data.identifier.type,
      }))
    );
  }, [upstreamObjects, nodeId]);

  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

  const handleUpdateAssignment = useCallback(
    (updates: Record<string, unknown>) => {
      if (!selectedObjectId) return;

      const nextAssignments = applyPerObjectAssignmentUpdate(
        assignments,
        selectedObjectId,
        updates
      );

      updateFlow({
        nodes: state.flow.nodes.map((n) => {
          if (n.data?.identifier?.id !== nodeId) return n;
          return { ...n, data: { ...n.data, perObjectAssignments: nextAssignments } };
        }),
      });
    },
    [assignments, selectedObjectId, state.flow.nodes, nodeId, updateFlow]
  );

  const handleBack = useCallback(() => {
    updateUI({
      activeTab: 'flow',
      selectedNodeId: undefined,
      selectedNodeType: undefined,
    });
  }, [updateUI]);

  const sidebar = (
    <>
      <SelectionList
        mode="single"
        items={upstreamObjects.map((o) => ({
          id: o.data.identifier.id,
          label: o.data.identifier.displayName,
        }))}
        selectedId={selectedObjectId}
        onSelect={setSelectedObjectId}
        showDefault={true}
        defaultLabel="Default"
        emptyLabel="No text objects detected"
      />

      <div className="border-t border-[var(--border-primary)] pt-[var(--space-2)] text-xs text-[var(--text-tertiary)]">
        Detected: {upstreamObjects.length} text object
        {upstreamObjects.length !== 1 ? 's' : ''}
      </div>
    </>
  );

  const content = (
    <div className="flex h-full w-full items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-[var(--space-4)] flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-2)]">
          <svg
            className="h-8 w-8 text-[var(--text-tertiary)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
        </div>
      </div>
    </div>
  );

  const properties = selectedObjectId ? (
    <TypographyPerObjectProperties
      nodeId={nodeId}
      objectId={selectedObjectId}
      assignments={assignments}
      onChange={handleUpdateAssignment}
    />
  ) : (
    <TypographyDefaultProperties nodeId={nodeId} />
  );

  return (
    <InspectorLayout
      title="Typography"
      headerIcon={<Type size={16} />}
      sidebar={sidebar}
      content={content}
      properties={properties}
      onBack={handleBack}
      headerHeightClassName="h-[var(--header-height)]"
    />
  );
}
