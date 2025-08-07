// src/server/logger.ts
import { isDomainError } from "@/shared/errors/domain";

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogMeta {
  [key: string]: unknown;
}

function serialize(meta?: LogMeta): string {
  try {
    return JSON.stringify(meta ?? {});
  } catch {
    return '{}';
  }
}

function log(level: LogLevel, message: string, meta?: LogMeta): void {
  const line = {
    ts: new Date().toISOString(),
    level,
    message,
    ...((meta ?? {}) as Record<string, unknown>),
  };
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

export const logger = {
  debug(message: string, meta?: LogMeta) { log('debug', message, meta); },
  info(message: string, meta?: LogMeta) { log('info', message, meta); },
  warn(message: string, meta?: LogMeta) { log('warn', message, meta); },
  error(message: string, meta?: LogMeta) { log('error', message, meta); },
  errorWithStack(message: string, error: unknown, meta?: LogMeta) {
    const base: LogMeta = meta ?? {};
    if (error instanceof Error) {
      base.error = { name: error.name, message: error.message, stack: error.stack };
    } else {
      base.error = { message: String(error) };
    }
    log('error', message, base);
  },
  domain(message: string, error: unknown, meta?: LogMeta) {
    if (isDomainError(error)) {
      this.warn(message, { ...(meta ?? {}), errorCode: error.code, details: error.details });
    } else {
      this.errorWithStack(message, error, meta);
    }
  }
};


