// src/components/editor/nodes/boolean-op-node.tsx - Boolean operation logic node
"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { getNodeDefinitionWithDynamicPorts } from "@/shared/registry/registry-utils";
import type { BooleanOpNodeData } from "@/shared/types/nodes";

export function BooleanOpNode({ data, selected }: NodeProps<BooleanOpNodeData>) {
  const nodeDefinition = getNodeDefinitionWithDynamicPorts('boolean_op', data);
  
  const getOperatorDisplay = () => {
    switch (data.operator) {
      case 'and': return 'AND';
      case 'or': return 'OR';
      case 'not': return 'NOT';
      case 'xor': return 'XOR';
    }
  };

  const getOperatorSymbol = () => {
    switch (data.operator) {
      case 'and': return '∧';
      case 'or': return '∨';
      case 'not': return '¬';
      case 'xor': return '⊕';
    }
  };

  return (
    <Card selected={selected} className="p-4 min-w-[180px]">
      {/* Dynamic input ports */}
      {nodeDefinition?.ports.inputs.map((port, index) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          className={`w-3 h-3 ${nodeDefinition?.rendering.colors.handle ?? 'bg-amber-500'} !border-2 !border-white`}
          style={{ top: `${35 + (index * 30)}%` }}
        />
      ))}

      <CardHeader className="p-0 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-amber-600 flex items-center justify-center rounded text-white font-bold text-sm">
            ⊙
          </div>
          <span className="font-semibold text-white">
            {data.identifier.displayName}
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-2">
        <div className="bg-gray-700 p-2 rounded border text-center">
          <div className="text-sm font-mono text-white">
            Bool ({getOperatorDisplay()})
          </div>
          <div className="text-lg text-white font-mono mt-1">
            {data.operator === 'not' ? `${getOperatorSymbol()}A` : `A ${getOperatorSymbol()} B`}
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-300">Operation:</span>
          <span className="text-xs text-white font-medium">
            {getOperatorDisplay()}
          </span>
        </div>

        <div className="text-xs text-center">
          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
            Boolean Logic
          </span>
        </div>

        <div className="mt-3 pt-2 border-t border-gray-700">
          <div className="text-xs text-gray-400 text-center">
            {data.operator === 'not' ? '1 Input' : '2 Inputs'} → Boolean
          </div>
        </div>
      </CardContent>

      {/* Output port */}
      {nodeDefinition?.ports.outputs.map((port) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          className={`w-3 h-3 ${nodeDefinition?.rendering.colors.handle ?? 'bg-amber-500'} !border-2 !border-white`}
          style={{ top: '50%' }}
        />
      ))}
    </Card>
  );
}
