// src/components/workspace/nodes/math-op-node.tsx - Math operation logic node
"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { getNodeDefinitionWithDynamicPorts } from "@/shared/registry/registry-utils";
import type { MathOpNodeData } from "@/shared/types/nodes";

export function MathOpNode({ data, selected }: NodeProps<MathOpNodeData>) {
  const nodeDefinition = getNodeDefinitionWithDynamicPorts('math_op', data as unknown as Record<string, unknown>);
  
  const getOperatorDisplay = () => {
    switch (data.operator) {
      case 'add': return 'ADD';
      case 'subtract': return 'SUB';
      case 'multiply': return 'MUL';
      case 'divide': return 'DIV';
      case 'modulo': return 'MOD';
      case 'power': return 'POW';
      case 'sqrt': return 'SQRT';
      case 'abs': return 'ABS';
      case 'min': return 'MIN';
      case 'max': return 'MAX';
    }
  };

  const getOperatorSymbol = () => {
    switch (data.operator) {
      case 'add': return '+';
      case 'subtract': return '-';
      case 'multiply': return '×';
      case 'divide': return '÷';
      case 'modulo': return '%';
      case 'power': return '^';
      case 'sqrt': return '√A';
      case 'abs': return '|A|';
      case 'min': return 'min';
      case 'max': return 'max';
    }
  };

  const isUnaryOperation = () => data.operator === 'sqrt' || data.operator === 'abs';

  return (
    <Card selected={selected} className="p-4 min-w-[180px]">
      {/* Dynamic input ports */}
      {nodeDefinition?.ports.inputs.map((port, index) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          className={`w-3 h-3 ${nodeDefinition?.rendering.colors.handle ?? 'bg-emerald-500'} !border-2 !border-white`}
          style={{ top: `${35 + (index * 30)}%` }}
        />
      ))}

      <CardHeader className="p-0 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-emerald-600 flex items-center justify-center rounded text-white font-bold text-sm">
            🧮
          </div>
          <span className="font-semibold text-white">
            {data.identifier.displayName}
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-2">
        <div className="bg-gray-700 p-2 rounded border text-center">
          <div className="text-sm font-mono text-white">
            Math ({getOperatorDisplay()})
          </div>
          <div className="text-lg text-white font-mono mt-1">
            {isUnaryOperation() ? getOperatorSymbol() : `A ${getOperatorSymbol()} B`}
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
            Number Math
          </span>
        </div>

        <div className="mt-3 pt-2 border-t border-gray-700">
          <div className="text-xs text-gray-400 text-center">
            {isUnaryOperation() ? '1 Input' : '2 Inputs'} → Number
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
          className={`w-3 h-3 ${nodeDefinition?.rendering.colors.handle ?? 'bg-emerald-500'} !border-2 !border-white`}
          style={{ top: '50%' }}
        />
      ))}
    </Card>
  );
}
