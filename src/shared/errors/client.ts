// src/shared/errors/client.ts
import type { DomainErrorCode, DomainErrorDetails } from "./domain";

export interface TrpcErrorDataShape {
  errorCode?: DomainErrorCode;
  details?: DomainErrorDetails;
}

export interface MaybeTrpcDomainError {
  message?: string;
  data?: TrpcErrorDataShape | Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function extractDomainError(error: unknown): {
  code: DomainErrorCode;
  details?: DomainErrorDetails;
  message?: string;
} | null {
  if (!isRecord(error)) return null;
  const maybeData = (error as { data?: unknown }).data;
  if (!isRecord(maybeData)) return null;

  const errorCode = (maybeData as { errorCode?: unknown }).errorCode;
  if (typeof errorCode !== "string") return null;

  // Narrow details
  const rawDetails = (maybeData as { details?: unknown }).details;
  const details = isRecord(rawDetails)
    ? (rawDetails as DomainErrorDetails)
    : undefined;

  const message = (error as { message?: unknown }).message;
  return {
    code: errorCode as DomainErrorCode,
    details,
    message: typeof message === "string" ? message : undefined,
  };
}
