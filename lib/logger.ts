// =============================================
// LOGGER UTILITY
// Wraps console methods for production safety
// Only logs in development, silences in production
// =============================================

const isDevelopment = process.env.NODE_ENV === 'development';

interface LoggerOptions {
  forceLog?: boolean; // Log even in production (for critical errors)
}

class Logger {
  private prefix: string;

  constructor(prefix: string = 'ZOIRO') {
    this.prefix = prefix;
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${this.prefix}] [${level}] ${timestamp}: ${message}`;
  }

  /**
   * Log info message (development only)
   */
  info(message: string, ...args: any[]): void {
    if (isDevelopment) {
    }
  }

  /**
   * Log warning (development only)
   */
  warn(message: string, ...args: any[]): void {
    if (isDevelopment) {
      console.warn(this.formatMessage('WARN', message), ...args);
    }
  }

  /**
   * Log error (always logs, but sanitized in production)
   */
  error(message: string, error?: unknown, options?: LoggerOptions): void {
    if (isDevelopment || options?.forceLog) {
      console.error(this.formatMessage('ERROR', message), error);
    } else {
      // In production, log minimal info without exposing stack traces
      console.error(this.formatMessage('ERROR', message));
    }
  }

  /**
   * Log debug info (development only)
   */
  debug(message: string, ...args: any[]): void {
    if (isDevelopment) {
      console.debug(this.formatMessage('DEBUG', message), ...args);
    }
  }

  /**
   * Log performance timing (development only)
   */
  time(label: string): void {
    if (isDevelopment) {
      console.time(`[${this.prefix}] ${label}`);
    }
  }

  timeEnd(label: string): void {
    if (isDevelopment) {
      console.timeEnd(`[${this.prefix}] ${label}`);
    }
  }

  /**
   * Create a child logger with a sub-prefix
   */
  child(subPrefix: string): Logger {
    return new Logger(`${this.prefix}:${subPrefix}`);
  }
}

// Export singleton instances for different modules
export const logger = new Logger('ZOIRO');
export const portalLogger = new Logger('PORTAL');
export const apiLogger = new Logger('API');
export const authLogger = new Logger('AUTH');

// Helper function to safely stringify errors
export function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
}

// Export class for custom loggers
export { Logger };
