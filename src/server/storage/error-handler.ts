// src/server/storage/error-handler.ts
import { STORAGE_CONFIG } from "./config";

export enum StorageErrorCode {
  // Environment errors
  MISSING_ENV_VARS = "MISSING_ENV_VARS",
  INVALID_ENV_VARS = "INVALID_ENV_VARS",

  // Bucket errors
  BUCKET_NOT_FOUND = "BUCKET_NOT_FOUND",
  BUCKET_ACCESS_DENIED = "BUCKET_ACCESS_DENIED",
  BUCKET_QUOTA_EXCEEDED = "BUCKET_QUOTA_EXCEEDED",

  // File errors
  FILE_TOO_LARGE = "FILE_TOO_LARGE",
  UNSUPPORTED_FILE_TYPE = "UNSUPPORTED_FILE_TYPE",
  INVALID_FILE_CONTENT = "INVALID_FILE_CONTENT",

  // Upload errors
  UPLOAD_FAILED = "UPLOAD_FAILED",
  UPLOAD_TIMEOUT = "UPLOAD_TIMEOUT",
  NETWORK_ERROR = "NETWORK_ERROR",

  // URL errors
  SIGNED_URL_FAILED = "SIGNED_URL_FAILED",
  URL_EXPIRED = "URL_EXPIRED",

  // System errors
  TEMP_FILE_ERROR = "TEMP_FILE_ERROR",
  CLEANUP_FAILED = "CLEANUP_FAILED",
  INITIALIZATION_FAILED = "INITIALIZATION_FAILED",

  // Unknown errors
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

// Define structured error details interface instead of Record<string, any>
export interface StorageErrorDetails {
  missingVars?: string[];
  bucketName?: string;
  reason?: string;
  accessible?: boolean;
  fileSize?: number;
  maxSize?: number;
  fileType?: string;
  bucket?: string;
  remoteKey?: string;
  attempt?: number;
  operation?: string;
  timeoutMs?: number;
  originalError?: string;
  [key: string]: unknown; // Allow additional properties while maintaining type safety
}

export interface StorageError extends Error {
  code: StorageErrorCode;
  details?: StorageErrorDetails;
  retryable: boolean;
  timestamp: string;
  userId?: string;
  bucket?: string;
  filePath?: string;
}

// Type guard for objects that might be errors
function isErrorLike(
  error: unknown,
): error is { message?: unknown; code?: unknown; stack?: unknown } {
  return typeof error === "object" && error !== null;
}

// Type guard for network-related errors
function hasNetworkErrorMessage(error: unknown): error is { message: string } {
  return isErrorLike(error) && typeof error.message === "string";
}

export class StorageErrorHandler {
  private static readonly RETRYABLE_ERRORS = new Set([
    StorageErrorCode.NETWORK_ERROR,
    StorageErrorCode.UPLOAD_TIMEOUT,
    StorageErrorCode.BUCKET_QUOTA_EXCEEDED,
  ]);

  static createError(
    code: StorageErrorCode,
    message: string,
    details?: StorageErrorDetails,
    userId?: string,
    bucket?: string,
    filePath?: string,
  ): StorageError {
    const error = new Error(message) as StorageError;
    error.code = code;
    error.details = details;
    error.retryable = this.RETRYABLE_ERRORS.has(code);
    error.timestamp = new Date().toISOString();
    error.userId = userId;
    error.bucket = bucket;
    error.filePath = filePath;

    return error;
  }

  static isRetryableError(error: unknown): boolean {
    // Check if error has a code property that matches retryable errors
    if (
      isErrorLike(error) &&
      typeof error.code === "string" &&
      this.RETRYABLE_ERRORS.has(error.code as StorageErrorCode)
    ) {
      return true;
    }

    // Check for network-related errors by message content
    if (hasNetworkErrorMessage(error)) {
      const message = error.message.toLowerCase();
      return (
        message.includes("network") ??
        message.includes("timeout") ??
        message.includes("connection") ??
        message.includes("econnreset") ??
        message.includes("enotfound")
      );
    }

    return false;
  }

  static getRetryDelay(attempt: number): number {
    const baseDelay = STORAGE_CONFIG.RETRY_DELAY_MS;
    const maxDelay = STORAGE_CONFIG.MAX_RETRY_DELAY_MS;

    // Exponential backoff with jitter
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter

    return Math.min(exponentialDelay + jitter, maxDelay);
  }

  static formatErrorForLogging(error: StorageError): string {
    const parts = [
      `[${error.code}] ${error.message}`,
      `Timestamp: ${error.timestamp}`,
      `Retryable: ${error.retryable}`,
      error.userId && `User: ${error.userId}`,
      error.bucket && `Bucket: ${error.bucket}`,
      error.filePath && `File: ${error.filePath}`,
      error.details && `Details: ${JSON.stringify(error.details)}`,
    ].filter(Boolean);

    return parts.join(" | ");
  }

  static createEnvironmentError(missingVars: string[]): StorageError {
    return this.createError(
      StorageErrorCode.MISSING_ENV_VARS,
      `Missing required environment variables: ${missingVars.join(", ")}`,
      { missingVars },
    );
  }

  static createBucketError(
    bucketName: string,
    reason: string,
    accessible: boolean,
  ): StorageError {
    const code = accessible
      ? StorageErrorCode.BUCKET_ACCESS_DENIED
      : StorageErrorCode.BUCKET_NOT_FOUND;
    return this.createError(
      code,
      `Bucket '${bucketName}' is not accessible: ${reason}`,
      { bucketName, reason, accessible },
    );
  }

  static createFileSizeError(
    fileSize: number,
    maxSize: number,
    fileType: string,
  ): StorageError {
    return this.createError(
      StorageErrorCode.FILE_TOO_LARGE,
      `File size ${(fileSize / 1024 / 1024).toFixed(2)}MB exceeds maximum allowed size of ${(maxSize / 1024 / 1024).toFixed(2)}MB for ${fileType}`,
      { fileSize, maxSize, fileType },
    );
  }

  static createUploadError(
    bucket: string,
    remoteKey: string,
    reason: string,
    attempt: number,
  ): StorageError {
    return this.createError(
      StorageErrorCode.UPLOAD_FAILED,
      `Upload failed for ${remoteKey} to bucket ${bucket}: ${reason}`,
      { bucket, remoteKey, reason, attempt },
    );
  }

  static createNetworkError(operation: string, reason: string): StorageError {
    return this.createError(
      StorageErrorCode.NETWORK_ERROR,
      `Network error during ${operation}: ${reason}`,
      { operation, reason },
    );
  }

  static createTimeoutError(
    operation: string,
    timeoutMs: number,
  ): StorageError {
    return this.createError(
      StorageErrorCode.UPLOAD_TIMEOUT,
      `Operation '${operation}' timed out after ${timeoutMs}ms`,
      { operation, timeoutMs },
    );
  }

  static wrapError(
    originalError: unknown,
    code: StorageErrorCode,
    message?: string,
  ): StorageError {
    const errorMessage =
      message ??
      (isErrorLike(originalError) && typeof originalError.message === "string"
        ? originalError.message
        : "Unknown error occurred");

    const error = this.createError(code, errorMessage, {
      originalError:
        isErrorLike(originalError) && typeof originalError.message === "string"
          ? originalError.message
          : String(originalError),
    });

    // Preserve original stack trace if available
    if (isErrorLike(originalError) && typeof originalError.stack === "string") {
      error.stack = originalError.stack;
    }

    return error;
  }
}
