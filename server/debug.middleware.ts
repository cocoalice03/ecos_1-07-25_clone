
export function createDebugMiddleware() {
  return (req: any, res: any, next: any) => {
    // Log all requests in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔄 ${req.method} ${req.path}`, {
        query: req.query,
        body: req.body ? Object.keys(req.body) : undefined,
        timestamp: new Date().toISOString()
      });
    }

    // Catch async errors
    const originalSend = res.send;
    res.send = function(data: any) {
      if (res.statusCode >= 400) {
        console.error(`❌ Error response ${res.statusCode} for ${req.method} ${req.path}:`, data);
      }
      return originalSend.call(this, data);
    };

    next();
  };
}

export function createDatabaseErrorHandler() {
  return (error: any, req: any, res: any, next: any) => {
    if (error.code === 'CONNECTION_LOST' || error.code === 'PROTOCOL_CONNECTION_LOST') {
      console.error('🔴 Database connection lost:', error);
      return res.status(503).json({
        error: 'Database connection lost',
        message: 'The database connection was lost. Please try again.',
        code: error.code
      });
    }

    if (error.message && error.message.includes('WebSocket')) {
      console.error('🔴 WebSocket database error:', error);
      return res.status(503).json({
        error: 'Database WebSocket error',
        message: 'WebSocket connection to database failed. Please try again.',
        details: error.message
      });
    }

    next(error);
  };
}
