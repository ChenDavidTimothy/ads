// AUTO-GENERATED - Executor to node type mappings
export const EXECUTOR_NODE_MAPPINGS = {
  geometry: ['triangle', 'circle', 'rectangle'],
  timing: ['insert'],
  logic: ['filter', 'merge', 'constants', 'print', 'compare', 'if_else', 'boolean_op'],
  animation: ['animation'],
  scene: ['scene'],
} as const;

export type ExecutorType = keyof typeof EXECUTOR_NODE_MAPPINGS;
