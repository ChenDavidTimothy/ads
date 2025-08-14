"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { getNodeDefinition } from "@/shared/registry/registry-utils";
import type { MergeNodeData } from "@/shared/types/nodes";

export function MergeNode({ data, selected }: NodeProps<MergeNodeData>) {
  const nodeDefinition = getNodeDefinition('merge');
  const portCount = data.inputPortCount || 2;
  
  // Generate dynamic input ports
  const inputPorts = Array.from({ length: portCount }, (_, i) => ({
    id: `input${i + 1}`,
    label: i === 0 ? 'Input 1 (Priority)' : `Input ${i + 1}`,
  }));

  // Calculate port spacing to avoid overlap
  const getPortTopPosition = (index: number) => {
    if (portCount <= 2) {
      return index === 0 ? '30%' : '70%';
    } else if (portCount === 3) {
      return ['25%', '50%', '75%'][index];
    } else if (portCount === 4) {
      return ['20%', '40%', '60%', '80%'][index];
    } else { // 5 ports
      return ['15%', '30%', '50%', '70%', '85%'][index];
    }
  };

  // Dynamic height based on port count for better port spacing
  const getNodeHeight = () => {
    if (portCount <= 2) return 'min-h-[120px]';
    if (portCount === 3) return 'min-h-[140px]';
    if (portCount === 4) return 'min-h-[160px]';
    return 'min-h-[180px]'; // 5 ports
  };

  const handleClass = "bg-[var(--node-logic)]";

  return (
    <Card className={`p-4 min-w-[200px] ${getNodeHeight()} ${selected ? 'ring-2 ring-[var(--accent-500)]' : ''}`}>
      {/* Dynamic input ports */}
      {inputPorts.map((port, index) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          className={`w-3 h-3 ${handleClass} !border-2 !border-[var(--text-primary)]`}
          style={{ top: getPortTopPosition(index) }}
        />
      ))}

      <CardHeader className="p-0 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[var(--node-logic)] flex items-center justify-center rounded text-[var(--text-primary)] font-bold text-sm">
            ⊕
          </div>
          <span className="font-semibold text-[var(--text-primary)]">
            {data.identifier.displayName}
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-secondary)]">Ports:</span>
          <span className="text-xs text-[var(--text-primary)] font-medium">{portCount}</span>
        </div>
        
        <div className="text-xs text-[var(--accent-600)]">
          Port 1 has merge priority
        </div>

        <div className="mt-3 pt-2 border-t border-[var(--border-primary)]">
          <div className="text-xs text-[var(--text-tertiary)] text-center">
            Resolves object ID conflicts
          </div>
        </div>
      </CardContent>

      {/* Single output port */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className={`w-3 h-3 ${handleClass} !border-2 !border-[var(--text-primary)]`}
        style={{ top: '50%' }}
      />
    </Card>
  );
}
