/**
 * Production-ready unified logging utility
 * Combines environment-aware console logging with structured JSON output
 * Includes domain error handling and enhanced error tracking
 *
 * Can be disabled by setting DISABLE_LOGGING=true environment variable
 */

import { isDomainError } from '@/shared/errors/domain';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogMeta = Record<string, unknown>;

const isDevelopment = process.env.NODE_ENV === 'development';
const isLoggingEnabled = process.env.DISABLE_LOGGING !== 'true';

function log(level: LogLevel, message: string, meta?: LogMeta): void {
  // Early return if logging is disabled
  if (!isLoggingEnabled) return;
  const line = {
    ts: new Date().toISOString(),
    level,
    message,
    ...((meta ?? {}) as Record<string, unknown>),
  };

  if (isDevelopment) {
    // Console logging for development with readable format
    const logMethod =
      level === 'error'
        ? console.error
        : level === 'warn'
          ? console.warn
          : level === 'debug'
            ? console.debug
            : console.log;

    logMethod(`[${level.toUpperCase()}]`, message, meta ?? '');
  } else {
    // JSON structured logging for production
    const output = JSON.stringify(line);
    switch (level) {
      case 'debug':
        console.debug(output);
        break;
      case 'info':
        console.info(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'error':
        console.error(output);
        break;
    }
  }
}

export const logger = {
  debug(message: string, meta?: LogMeta) {
    if (isDevelopment) {
      log('debug', message, meta);
    }
  },
  info(message: string, meta?: LogMeta) {
    log('info', message, meta);
  },
  warn(message: string, meta?: LogMeta) {
    log('warn', message, meta);
  },
  error(message: string, meta?: LogMeta) {
    log('error', message, meta);
  },
  errorWithStack(message: string, error: unknown, meta?: LogMeta) {
    const base: LogMeta = meta ?? {};
    if (error instanceof Error) {
      base.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    } else {
      base.error = { message: String(error) };
    }
    log('error', message, base);
  },
  domain(message: string, error: unknown, meta?: LogMeta) {
    if (isDomainError(error)) {
      this.warn(message, {
        ...(meta ?? {}),
        errorCode: error.code,
        details: error.details,
      });
    } else {
      this.errorWithStack(message, error, meta);
    }
  },
  isEnabled: () => isLoggingEnabled,
};
