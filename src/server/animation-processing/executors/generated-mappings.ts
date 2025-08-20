// AUTO-GENERATED - Executor to node type mappings
export const EXECUTOR_NODE_MAPPINGS = {
  geometry: ['triangle', 'circle', 'rectangle'],
  timing: ['insert'],
  logic: ['filter', 'merge', 'constants', 'result', 'compare', 'if_else', 'boolean_op', 'math_op', 'duplicate'],
  animation: ['animation', 'canvas', 'typography'],
  scene: ['scene', 'frame'],
  image: ['image'],
  text: ['text'],
} as const;

export type ExecutorType = keyof typeof EXECUTOR_NODE_MAPPINGS;
