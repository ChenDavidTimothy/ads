export type TrpcErrorCode =
  | 'BAD_REQUEST'
  | 'FORBIDDEN'
  | 'INTERNAL_SERVER_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED';

export class AssetsServiceError extends Error {
  public readonly code: TrpcErrorCode;

  constructor(code: TrpcErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AssetsServiceError';
    this.code = code;
  }
}

export function isAssetsServiceError(error: unknown): error is AssetsServiceError {
  return error instanceof AssetsServiceError;
}
