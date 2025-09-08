import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CircuitBreakerError } from './circuit-breaker.middleware.js';
import { logger } from '../services/logger.service.js';

export enum ErrorCode {
  // General errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  
  // Authentication & Authorization
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  AUTH_INVALID = 'AUTH_INVALID',
  AUTH_EXPIRED = 'AUTH_EXPIRED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_EMAIL = 'INVALID_EMAIL',
  INVALID_INPUT = 'INVALID_INPUT',
  
  // Database
  DATABASE_ERROR = 'DATABASE_ERROR',
  DATABASE_UNAVAILABLE = 'DATABASE_UNAVAILABLE',
  CIRCUIT_BREAKER_OPEN = 'CIRCUIT_BREAKER_OPEN',
  
  // ECOS specific
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  SCENARIO_NOT_FOUND = 'SCENARIO_NOT_FOUND',
  EVALUATION_FAILED = 'EVALUATION_FAILED',
  
  // External services
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  OPENAI_ERROR = 'OPENAI_ERROR',
  PINECONE_ERROR = 'PINECONE_ERROR'
}

export interface ErrorDetails {
  field?: string;
  value?: any;
  constraint?: string;
  message?: string;
}

export class APIError extends Error {
  public statusCode: number;
  public code: ErrorCode;
  public details?: ErrorDetails[];
  public timestamp: Date;
  public requestId?: string;

  constructor(
    message: string,
    statusCode: number = 500,
    code: ErrorCode = ErrorCode.INTERNAL_ERROR,
    details?: ErrorDetails[]
  ) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.timestamp = new Date();
  }

  public toJSON() {
    return {
      error: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
      requestId: this.requestId
    };
  }

  // Factory methods for common errors
  static badRequest(message: string, details?: ErrorDetails[]): APIError {
    return new APIError(message, 400, ErrorCode.INVALID_REQUEST, details);
  }

  static unauthorized(message: string = 'Authentication required'): APIError {
    return new APIError(message, 401, ErrorCode.AUTH_REQUIRED);
  }

  static forbidden(message: string = 'Permission denied'): APIError {
    return new APIError(message, 403, ErrorCode.PERMISSION_DENIED);
  }

  static notFound(message: string = 'Resource not found'): APIError {
    return new APIError(message, 404, ErrorCode.RESOURCE_NOT_FOUND);
  }

  static validationError(message: string, details?: ErrorDetails[]): APIError {
    return new APIError(message, 400, ErrorCode.VALIDATION_ERROR, details);
  }

  static databaseError(message: string): APIError {
    return new APIError(message, 503, ErrorCode.DATABASE_ERROR);
  }

  static circuitBreakerOpen(message: string): APIError {
    return new APIError(message, 503, ErrorCode.CIRCUIT_BREAKER_OPEN);
  }

  static rateLimitExceeded(message: string): APIError {
    return new APIError(message, 429, ErrorCode.RATE_LIMIT_EXCEEDED);
  }

  static internal(message: string = 'Internal server error'): APIError {
    return new APIError(message, 500, ErrorCode.INTERNAL_ERROR);
  }

  static sessionNotFound(message: string = 'Session not found'): APIError {
    return new APIError(message, 404, ErrorCode.SESSION_NOT_FOUND);
  }

  static scenarioNotFound(message: string = 'Scenario not found'): APIError {
    return new APIError(message, 404, ErrorCode.SCENARIO_NOT_FOUND);
  }

  static evaluationFailed(message: string = 'Evaluation failed'): APIError {
    return new APIError(message, 422, ErrorCode.EVALUATION_FAILED);
  }

  static externalServiceError(message: string, details?: ErrorDetails[]): APIError {
    return new APIError(message, 503, ErrorCode.EXTERNAL_SERVICE_ERROR, details);
  }
}

interface ErrorResponse {
  error: string;
  code: ErrorCode;
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  requestId?: string;
  details?: ErrorDetails[];
  stack?: string;
}

export class ErrorHandler {
  private isDevelopment: boolean;
  private correlationIdHeader: string;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
    this.correlationIdHeader = 'x-correlation-id';
  }

  // Request ID generation middleware
  public addRequestId() {
    return (req: Request, res: Response, next: NextFunction) => {
      const requestId = req.headers[this.correlationIdHeader] as string || 
        `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      req.requestId = requestId;
      res.setHeader(this.correlationIdHeader, requestId);
      
      next();
    };
  }

  // Main error handler middleware
  public handleError() {
    return (error: any, req: Request, res: Response, next: NextFunction) => {
      const requestId = req.requestId;
      let apiError: APIError;

      // Convert different error types to APIError
      if (error instanceof APIError) {
        apiError = error;
      } else if (error instanceof z.ZodError) {
        apiError = this.handleZodError(error);
      } else if (error instanceof CircuitBreakerError) {
        apiError = this.handleCircuitBreakerError(error);
      } else if (error.name === 'ValidationError') {
        apiError = APIError.validationError(error.message);
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        apiError = APIError.databaseError('Database connection failed');
      } else if (error.statusCode || error.status) {
        // HTTP-like errors
        const statusCode = error.statusCode || error.status;
        const code = this.mapStatusCodeToErrorCode(statusCode);
        apiError = new APIError(error.message || 'Request failed', statusCode, code);
      } else {
        // Generic error
        apiError = APIError.internal(
          this.isDevelopment ? error.message : 'An unexpected error occurred'
        );
      }

      apiError.requestId = requestId;

      // Log error (in production, this should go to a proper logging service)
      this.logError(error, req, apiError);

      // Create response
      const response: ErrorResponse = {
        error: apiError.message,
        code: apiError.code,
        statusCode: apiError.statusCode,
        timestamp: apiError.timestamp.toISOString(),
        path: req.path,
        method: req.method,
        requestId: apiError.requestId,
        details: apiError.details
      };

      // Add stack trace in development
      if (this.isDevelopment && error.stack) {
        response.stack = error.stack;
      }

      // Send response
      res.status(apiError.statusCode).json(response);
    };
  }

  // Handle unhandled promise rejections
  public setupGlobalHandlers() {
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      logger.error('Unhandled Promise Rejection', { reason, promise: promise.toString() });
      
      // In production, you might want to gracefully shutdown
      if (process.env.NODE_ENV === 'production') {
        logger.error('Shutting down due to unhandled promise rejection');
        process.exit(1);
      }
    });

    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
      
      // Always exit on uncaught exceptions
      process.exit(1);
    });
  }

  // Async wrapper to catch promise rejections
  public asyncHandler(fn: Function) {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  private handleZodError(error: z.ZodError): APIError {
    const details: ErrorDetails[] = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      value: err.path.length > 0 ? err.path.reduce((obj, key) => obj?.[key], error as any) : undefined,
      constraint: err.code
    }));

    return APIError.validationError('Request validation failed', details);
  }

  private handleCircuitBreakerError(error: CircuitBreakerError): APIError {
    return APIError.circuitBreakerOpen(error.message);
  }

  private mapStatusCodeToErrorCode(statusCode: number): ErrorCode {
    switch (statusCode) {
      case 400: return ErrorCode.INVALID_REQUEST;
      case 401: return ErrorCode.AUTH_REQUIRED;
      case 403: return ErrorCode.PERMISSION_DENIED;
      case 404: return ErrorCode.RESOURCE_NOT_FOUND;
      case 429: return ErrorCode.RATE_LIMIT_EXCEEDED;
      case 503: return ErrorCode.DATABASE_UNAVAILABLE;
      default: return ErrorCode.INTERNAL_ERROR;
    }
  }

  private logError(originalError: any, req: Request, apiError: APIError) {
    const logData = {
      requestId: apiError.requestId,
      method: req.method,
      path: req.path,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      error: {
        message: apiError.message,
        code: apiError.code,
        statusCode: apiError.statusCode,
        stack: this.isDevelopment ? originalError.stack : undefined
      },
      query: req.query,
      body: this.sanitizeBody(req.body)
    };

    if (apiError.statusCode >= 500) {
      logger.error('API Error - Server', logData);
    } else if (apiError.statusCode >= 400) {
      logger.warn('API Error - Client', logData);
    }
  }

  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') return body;

    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'auth'];
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  // 404 handler for undefined routes
  public notFoundHandler() {
    return (req: Request, res: Response, next: NextFunction) => {
      const error = APIError.notFound(`Route ${req.method} ${req.path} not found`);
      next(error);
    };
  }

  // Health check for error handling system
  public healthCheck() {
    return (req: Request, res: Response) => {
      res.status(200).json({
        errorHandler: {
          status: 'healthy',
          environment: this.isDevelopment ? 'development' : 'production',
          timestamp: new Date().toISOString()
        }
      });
    };
  }
}

// Create singleton instance
export const errorHandler = new ErrorHandler();

// Convenience exports
export const asyncHandler = errorHandler.asyncHandler.bind(errorHandler);
export const addRequestId = errorHandler.addRequestId.bind(errorHandler);
export const handleError = errorHandler.handleError.bind(errorHandler);
export const notFoundHandler = errorHandler.notFoundHandler.bind(errorHandler);

// Global error handling setup
export const setupGlobalErrorHandling = () => {
  errorHandler.setupGlobalHandlers();
};

// Helper function for consistent error responses
export const sendErrorResponse = (res: Response, error: APIError) => {
  const response: ErrorResponse = {
    error: error.message,
    code: error.code,
    statusCode: error.statusCode,
    timestamp: error.timestamp.toISOString(),
    path: res.req?.path || '',
    method: res.req?.method || '',
    requestId: error.requestId,
    details: error.details
  };

  res.status(error.statusCode).json(response);
};

// Declare module augmentation for Request
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}