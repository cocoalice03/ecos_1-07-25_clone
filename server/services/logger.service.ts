interface LogContext {
  [key: string]: any;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  service?: string;
  requestId?: string;
}

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  TRACE = 'trace'
}

class Logger {
  private service: string;
  private isDevelopment: boolean;

  constructor(serviceName: string = 'app') {
    this.service = serviceName;
    this.isDevelopment = process.env.NODE_ENV !== 'production';
  }

  private formatLog(level: LogLevel, message: string, context?: LogContext): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      service: this.service,
      requestId: this.getCurrentRequestId()
    };
  }

  private getCurrentRequestId(): string | undefined {
    // This can be enhanced with async local storage or request context
    return undefined;
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    const entry = this.formatLog(level, message, context);

    if (this.isDevelopment) {
      // Pretty print for development
      const emoji = this.getLevelEmoji(level);
      const coloredLevel = this.getColoredLevel(level);
      
      if (context && Object.keys(context).length > 0) {
        console.log(`${emoji} ${coloredLevel} [${this.service}] ${message}`, context);
      } else {
        console.log(`${emoji} ${coloredLevel} [${this.service}] ${message}`);
      }
    } else {
      // JSON format for production
      console.log(JSON.stringify(entry));
    }
  }

  private getLevelEmoji(level: LogLevel): string {
    switch (level) {
      case LogLevel.ERROR: return '❌';
      case LogLevel.WARN: return '⚠️';
      case LogLevel.INFO: return '✅';
      case LogLevel.DEBUG: return '🔍';
      case LogLevel.TRACE: return '📝';
      default: return 'ℹ️';
    }
  }

  private getColoredLevel(level: LogLevel): string {
    // Return colored level for development (can be enhanced with actual colors)
    return level.toUpperCase();
  }

  error(message: string, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      this.log(LogLevel.DEBUG, message, context);
    }
  }

  trace(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      this.log(LogLevel.TRACE, message, context);
    }
  }

  // Database operation logging
  database(operation: string, duration?: number, context?: LogContext): void {
    const logContext = {
      operation,
      duration: duration ? `${duration}ms` : undefined,
      ...context
    };
    this.info(`Database ${operation}`, logContext);
  }

  // HTTP request logging
  request(method: string, path: string, statusCode?: number, duration?: number, context?: LogContext): void {
    const logContext = {
      method,
      path,
      statusCode,
      duration: duration ? `${duration}ms` : undefined,
      ...context
    };

    if (statusCode && statusCode >= 400) {
      this.error(`HTTP ${method} ${path}`, logContext);
    } else {
      this.info(`HTTP ${method} ${path}`, logContext);
    }
  }

  // Service initialization logging
  service(serviceName: string, status: 'starting' | 'ready' | 'error', duration?: number, context?: LogContext): void {
    const logContext = {
      service: serviceName,
      status,
      duration: duration ? `${duration}ms` : undefined,
      ...context
    };

    switch (status) {
      case 'starting':
        this.info(`Service ${serviceName} starting`, logContext);
        break;
      case 'ready':
        this.info(`Service ${serviceName} ready`, logContext);
        break;
      case 'error':
        this.error(`Service ${serviceName} failed`, logContext);
        break;
    }
  }
}

// Create logger instances
export const logger = new Logger('ecos-app');
export const dbLogger = new Logger('database');
export const authLogger = new Logger('auth');
export const apiLogger = new Logger('api');

// Legacy console replacement (for gradual migration)
export const createLogger = (serviceName: string) => new Logger(serviceName);