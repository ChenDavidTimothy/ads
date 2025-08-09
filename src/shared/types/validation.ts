// src/shared/types/validation.ts - Runtime type validation for logic nodes
import type { ExecutionValue } from "@/server/animation-processing/execution-context";

export type LogicDataType = 'number' | 'boolean' | 'string' | 'color';

export interface TypedValue<T = unknown> {
  data: T;
  type: LogicDataType;
  validated: true;
  source: string;
}

export class TypeValidationError extends Error {
  constructor(
    public readonly nodeId: string,
    public readonly portId: string,
    public readonly expected: LogicDataType,
    public readonly received: string,
    public readonly receivedFrom: string
  ) {
    super(`Type mismatch at ${nodeId}.${portId}: expected ${expected}, got ${received} from ${receivedFrom}`);
    this.name = 'TypeValidationError';
  }
}

export function validateAndCoerce<T>(
  value: unknown,
  expectedType: LogicDataType,
  sourceInfo: { nodeId: string; portId: string; sourceNodeId: string }
): TypedValue<T> {
  const { nodeId, portId, sourceNodeId } = sourceInfo;
  
  switch (expectedType) {
    case 'number': {
      if (typeof value === 'number' && !isNaN(value)) {
        return { data: value as T, type: 'number', validated: true, source: sourceNodeId };
      }
      if (typeof value === 'string' && value.trim() !== '' && !isNaN(Number(value))) {
        const numValue = Number(value);
        return { data: numValue as T, type: 'number', validated: true, source: sourceNodeId };
      }
      throw new TypeValidationError(nodeId, portId, 'number', typeof value, sourceNodeId);
    }
    
    case 'boolean': {
      if (typeof value === 'boolean') {
        return { data: value as T, type: 'boolean', validated: true, source: sourceNodeId };
      }
      if (typeof value === 'string' && (value === 'true' || value === 'false')) {
        return { data: (value === 'true') as T, type: 'boolean', validated: true, source: sourceNodeId };
      }
      if (typeof value === 'number') {
        return { data: (value !== 0) as T, type: 'boolean', validated: true, source: sourceNodeId };
      }
      throw new TypeValidationError(nodeId, portId, 'boolean', typeof value, sourceNodeId);
    }
    
    case 'string': {
      if (typeof value === 'string') {
        return { data: value as T, type: 'string', validated: true, source: sourceNodeId };
      }
      // Safe coercion for primitives
      return { data: String(value) as T, type: 'string', validated: true, source: sourceNodeId };
    }
    
    case 'color': {
      if (typeof value === 'string' && /^#([0-9a-fA-F]{3}){1,2}$/.test(value)) {
        return { data: value as T, type: 'color', validated: true, source: sourceNodeId };
      }
      throw new TypeValidationError(nodeId, portId, 'color', typeof value, sourceNodeId);
    }
    
    default: {
      const _exhaustive: never = expectedType;
      throw new Error(`Unsupported validation type: ${_exhaustive}`);
    }
  }
}

export function getValueType(value: unknown): LogicDataType | 'unknown' {
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'string') {
    if (/^#([0-9a-fA-F]{3}){1,2}$/.test(value)) return 'color';
    return 'string';
  }
  return 'unknown';
}
