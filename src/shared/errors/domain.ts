// src/shared/errors/domain.ts

export type DomainErrorCode =
  | 'ERR_SCENE_REQUIRED'
  | 'ERR_TOO_MANY_SCENES'
  | 'ERR_CIRCULAR_DEPENDENCY'
  | 'ERR_INVALID_CONNECTION'
  | 'ERR_NODE_VALIDATION_FAILED'
  | 'ERR_SCENE_VALIDATION_FAILED'
  | 'ERR_MISSING_INSERT_CONNECTION'
  | 'ERR_MULTIPLE_INSERT_CONNECTIONS'
  | 'ERR_DUPLICATE_OBJECT_IDS'
  | 'ERR_UNKNOWN_NODE_TYPE';

export interface DomainErrorDetails {
  nodeId?: string;
  nodeName?: string;
  duplicateIds?: string[];
  sourceNodeId?: string;
  targetNodeId?: string;
  edgeId?: string;
  info?: Record<string, unknown>;
}

export class DomainError extends Error {
  public readonly code: DomainErrorCode;
  public readonly details?: DomainErrorDetails;
  public readonly isUserError: boolean;

  constructor(message: string, code: DomainErrorCode, details?: DomainErrorDetails, isUserError = true) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
    this.isUserError = isUserError;
  }
}

export class SceneRequiredError extends DomainError {
  constructor() {
    super('Scene node is required', 'ERR_SCENE_REQUIRED');
    this.name = 'SceneRequiredError';
  }
}

export class TooManyScenesError extends DomainError {
  constructor() {
    super('Only one scene node allowed per workspace', 'ERR_TOO_MANY_SCENES');
    this.name = 'TooManyScenesError';
  }
}

export class CircularDependencyError extends DomainError {
  constructor() {
    super('Circular dependency detected in node graph', 'ERR_CIRCULAR_DEPENDENCY');
    this.name = 'CircularDependencyError';
  }
}

export class InvalidConnectionError extends DomainError {
  constructor(message: string, details?: DomainErrorDetails) {
    super(message, 'ERR_INVALID_CONNECTION', details);
    this.name = 'InvalidConnectionError';
  }
}

export class NodeValidationError extends DomainError {
  constructor(errors: string[]) {
    super('Node validation failed', 'ERR_NODE_VALIDATION_FAILED', { info: { errors } });
    this.name = 'NodeValidationError';
  }
}

export class SceneValidationError extends DomainError {
  constructor(errors: string[]) {
    super('Scene validation failed', 'ERR_SCENE_VALIDATION_FAILED', { info: { errors } });
    this.name = 'SceneValidationError';
  }
}

export class MissingInsertConnectionError extends DomainError {
  constructor(nodeName: string, nodeId: string) {
    super(
      `Geometry node ${nodeName} must connect to an Insert node (directly or through Filter nodes) to appear in the scene.`,
      'ERR_MISSING_INSERT_CONNECTION',
      { nodeId, nodeName },
    );
    this.name = 'MissingInsertConnectionError';
  }
}

export class MultipleInsertConnectionsError extends DomainError {
  constructor(nodeName: string, nodeId: string, attemptedInsertId: string, existingInsertId: string) {
    super(
      `Object ${nodeName} cannot connect to multiple Insert nodes.`,
      'ERR_MULTIPLE_INSERT_CONNECTIONS',
      { nodeId, nodeName, info: { attemptedInsertId, existingInsertId } },
    );
    this.name = 'MultipleInsertConnectionsError';
  }
}

export class DuplicateObjectIdsError extends DomainError {
  constructor(nodeName: string, nodeId: string, duplicateIds: string[]) {
    super(
      `Node ${nodeName} receives duplicate object IDs. Use a Merge node to combine identical objects.`,
      'ERR_DUPLICATE_OBJECT_IDS',
      { nodeId, nodeName, duplicateIds },
    );
    this.name = 'DuplicateObjectIdsError';
  }
}

export class UnknownNodeTypeError extends DomainError {
  constructor(nodeType: string) {
    super(`Unknown node type: ${nodeType}`, 'ERR_UNKNOWN_NODE_TYPE', { info: { nodeType } }, false);
    this.name = 'UnknownNodeTypeError';
  }
}

export function isDomainError(error: unknown): error is DomainError {
  if (error instanceof DomainError) return true;
  if (typeof error !== 'object' || error === null) return false;
  const maybe = error as { code?: unknown; isUserError?: unknown };
  return typeof maybe.code === 'string' && typeof maybe.isUserError === 'boolean';
}


