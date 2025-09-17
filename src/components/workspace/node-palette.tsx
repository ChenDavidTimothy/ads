// src/components/workspace/node-palette.tsx - Registry-driven node palette
'use client';

import { useState, useMemo, useCallback } from 'react';
import { type XYPosition } from 'reactflow';
import { Search, Shapes, Clock, Cpu, Monitor, Database, Type, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CollapsibleSection } from './flow/components/collapsible-section';
import { generateNodeColors, generateNodePalette } from '@/shared/registry/registry-utils';

interface NodePaletteProps {
  onAddNode: (nodeType: string, position: XYPosition) => void;
}

export function NodePalette({ onAddNode }: NodePaletteProps) {
  // Generate palette structure from registry
  const palette = generateNodePalette();
  const nodeColors = generateNodeColors();

  // Search state
  const [query, setQuery] = useState('');
  const isSearching = query.trim().length > 0;

  // All nodes for search
  const allNodes = useMemo(
    () => [
      ...palette.geometryNodes,
      ...palette.textNodes,
      ...palette.dataNodes,
      ...palette.timingNodes,
      ...palette.logicNodes,
      ...palette.animationNodes,
      ...palette.imageNodes,
      ...palette.inputNodes,
      ...palette.outputNodes,
    ],
    [palette]
  );

  // Filtered search results
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return allNodes.filter((node) => node.label.toLowerCase().includes(q));
  }, [allNodes, query]);

  // Reusable node button renderer
  const renderNodeButton = useCallback(
    (node: { type: string; label: string; icon: string }) => {
      const handleNodeClick = (nodeType: string) => {
        onAddNode(nodeType, { x: 250, y: 250 });
      };

      return (
        <Button
          key={node.type}
          onClick={() => handleNodeClick(node.type)}
          className="w-full justify-start gap-[var(--space-3)] border border-[var(--border-primary)] bg-[var(--surface-2)] hover:bg-[var(--surface-interactive)]"
          size="md"
        >
          {/* Category color indicator */}
          <span
            className={`inline-block h-4 w-1.5 rounded-[var(--radius-sm)] ${nodeColors[node.type]?.primary ?? 'bg-[var(--accent-primary)]'}`}
          />
          {/* Placeholder for future icon system; keep label tight */}
          <span className="text-[13px]">{node.label}</span>
        </Button>
      );
    },
    [onAddNode, nodeColors]
  );

  // Category section renderer using CollapsibleSection
  const renderCategorySection = (
    title: string,
    nodes: Array<{ type: string; label: string; icon: string }>,
    iconComponent: React.ReactNode
  ) => {
    if (nodes.length === 0) return null;

    return (
      <CollapsibleSection
        title={title}
        icon={iconComponent}
        defaultExpanded={true}
        persistKey={`nodes-${title.toLowerCase()}`}
      >
        <div className="space-y-[var(--space-2)]">{nodes.map(renderNodeButton)}</div>
      </CollapsibleSection>
    );
  };

  return (
    <div className="w-[var(--sidebar-width)] overflow-y-auto border-r border-[var(--border-primary)] bg-[var(--surface-1)] p-[var(--space-4)]">
      <h2 className="mb-[var(--space-4)] text-base font-semibold text-[var(--text-primary)]">
        Nodes
      </h2>

      {/* Search Input - Always Visible */}
      <div className="relative mb-[var(--space-4)]">
        <Input
          placeholder="Search nodes..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8 pl-8 text-sm"
        />
        <Search
          size={12}
          className="absolute top-1/2 left-3 -translate-y-1/2 text-[var(--text-tertiary)]"
        />
      </div>

      {/* Search Results - Visible When Searching */}
      {isSearching && (
        <div className="mb-[var(--space-4)]">
          <h3 className="mb-[var(--space-3)] text-xs font-semibold text-[var(--text-tertiary)] uppercase">
            Search Results ({filtered.length})
          </h3>
          {filtered.length === 0 ? (
            <div className="py-4 text-center text-sm text-[var(--text-tertiary)]">
              No nodes found
            </div>
          ) : (
            <div className="space-y-[var(--space-2)]">{filtered.map(renderNodeButton)}</div>
          )}
        </div>
      )}

      {/* Category Sections - Hidden When Searching */}
      {!isSearching && (
        <>
          {renderCategorySection('Image', palette.imageNodes, <Database size={16} />)}
          {renderCategorySection('Input', palette.inputNodes, <Database size={16} />)}
          {renderCategorySection('Geometry', palette.geometryNodes, <Shapes size={16} />)}
          {renderCategorySection('Text', palette.textNodes, <Type size={16} />)}
          {renderCategorySection('Data', palette.dataNodes, <Database size={16} />)}
          {renderCategorySection('Timing', palette.timingNodes, <Clock size={16} />)}
          {renderCategorySection('Logic', palette.logicNodes, <Cpu size={16} />)}
          {renderCategorySection('Editor', palette.animationNodes, <Edit size={16} />)}
          {renderCategorySection('Output', palette.outputNodes, <Monitor size={16} />)}
        </>
      )}
    </div>
  );
}
