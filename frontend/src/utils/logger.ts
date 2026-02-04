/**
 * Frontend Logger Utility
 *
 * Centralized logging for the frontend application.
 * In production, logs can be sent to a monitoring service.
 * In development, logs are shown in console.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: string;
  data?: unknown;
  timestamp: string;
}

const isDev = import.meta.env.DEV;

/**
 * Format log entry for console output
 */
function formatLog(entry: LogEntry): string {
  const prefix = entry.context ? `[${entry.context}]` : '';
  return `${entry.timestamp} ${entry.level.toUpperCase()} ${prefix} ${entry.message}`;
}

/**
 * Log to console in development
 */
function logToConsole(entry: LogEntry): void {
  if (!isDev) return;

  const formatted = formatLog(entry);

  switch (entry.level) {
    case 'debug':
      console.debug(formatted, entry.data ?? '');
      break;
    case 'info':
      console.info(formatted, entry.data ?? '');
      break;
    case 'warn':
      console.warn(formatted, entry.data ?? '');
      break;
    case 'error':
      console.error(formatted, entry.data ?? '');
      break;
  }
}

/**
 * Create a log entry
 */
function createLogEntry(
  level: LogLevel,
  message: string,
  context?: string,
  data?: unknown,
): LogEntry {
  return {
    level,
    message,
    context,
    data,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Logger class with context support
 */
class Logger {
  private context?: string;

  constructor(context?: string) {
    this.context = context;
  }

  /**
   * Create a child logger with a specific context
   */
  withContext(context: string): Logger {
    return new Logger(context);
  }

  debug(message: string, data?: unknown): void {
    const entry = createLogEntry('debug', message, this.context, data);
    logToConsole(entry);
  }

  info(message: string, data?: unknown): void {
    const entry = createLogEntry('info', message, this.context, data);
    logToConsole(entry);
  }

  warn(message: string, data?: unknown): void {
    const entry = createLogEntry('warn', message, this.context, data);
    logToConsole(entry);
  }

  error(message: string, data?: unknown): void {
    const entry = createLogEntry('error', message, this.context, data);
    logToConsole(entry);
  }
}

// Default logger instance
export const logger = new Logger();

// Pre-configured loggers for common contexts
export const loggers = {
  system: new Logger('System'),
  finance: new Logger('Finance'),
  reception: new Logger('Reception'),
  patients: new Logger('Patients'),
  doctors: new Logger('Doctors'),
  auth: new Logger('Auth'),
  print: new Logger('Print'),
  queue: new Logger('Queue'),
};

export default logger;
