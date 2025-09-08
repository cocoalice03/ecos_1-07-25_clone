
import { apiLogger } from "./services/logger.service.js";

export function createDebugMiddleware() {
  // Only enable debug middleware in development
  if (process.env.NODE_ENV !== 'development') {
    return (req: any, res: any, next: any) => next();
  }

  return (req: any, res: any, next: any) => {
    // Log all requests in development only
    apiLogger.request(req.method, req.path, undefined, undefined, {
      query: req.query,
      bodyKeys: req.body ? Object.keys(req.body) : undefined
    });

    // Catch async errors in development only
    const originalSend = res.send;
    res.send = function(data: any) {
      if (res.statusCode >= 400) {
        apiLogger.error(`Error response ${res.statusCode} for ${req.method} ${req.path}`, {
          statusCode: res.statusCode,
          method: req.method,
          path: req.path,
          responseData: typeof data === 'object' ? data : { message: data }
        });
      }
      return originalSend.call(this, data);
    };

    next();
  };
}

export function createDatabaseErrorHandler() {
  return (error: any, req: any, res: any, next: any) => {
    if (error.code === 'CONNECTION_LOST' || error.code === 'PROTOCOL_CONNECTION_LOST') {
      apiLogger.error('Database connection lost', { 
        errorCode: error.code, 
        message: error.message,
        path: req.path,
        method: req.method
      });
      return res.status(503).json({
        error: 'Database connection lost',
        message: 'The database connection was lost. Please try again.',
        code: error.code
      });
    }

    if (error.message && error.message.includes('WebSocket')) {
      apiLogger.error('WebSocket database error', { 
        message: error.message,
        path: req.path,
        method: req.method
      });
      return res.status(503).json({
        error: 'Database WebSocket error',
        message: 'WebSocket connection to database failed. Please try again.',
        details: error.message
      });
    }

    next(error);
  };
}
