/**
 * Production-ready logging utility
 * Logs to console in development, can be extended for production logging services
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  userId?: string;
  path?: string;
  [key: string]: unknown;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  private log(level: LogLevel, message: string, context?: LogContext, error?: unknown) {
    const timestamp = new Date().toISOString();
    const logData: Record<string, unknown> = {
      timestamp,
      level,
      message,
      context,
    };
    if (error) {
      logData.error = this.serializeError(error);
    }

    if (this.isDevelopment) {
      // Console logging for development
      const logMethod = level === 'error' ? console.error : 
                       level === 'warn' ? console.warn : 
                       console.log;
      
      logMethod(`[${level.toUpperCase()}]`, message, context ?? '', error ?? '');
    } else {
      // In production, you'd send to logging service (e.g., Sentry, LogRocket, etc.)
      console.log(JSON.stringify(logData));
    }
  }

  private serializeError(error: unknown) {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }
    return String(error);
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext, error?: unknown) {
    this.log('warn', message, context, error);
  }

  error(message: string, context?: LogContext, error?: unknown) {
    this.log('error', message, context, error);
  }

  debug(message: string, context?: LogContext) {
    if (this.isDevelopment) {
      this.log('debug', message, context);
    }
  }
}

export const logger = new Logger();
