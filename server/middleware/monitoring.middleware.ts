import { Request, Response, NextFunction } from 'express';
import { performanceMonitor } from '../monitoring/performance-monitor';

/**
 * Performance Monitoring Middleware
 * 
 * This middleware automatically tracks request performance, errors,
 * and other metrics for every request processed by the Express server.
 */

interface MonitoringRequest extends Request {
  startTime?: number;
  requestId?: string;
}

/**
 * Generate a unique request ID for tracking
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Main monitoring middleware
 */
export function createMonitoringMiddleware() {
  return (req: MonitoringRequest, res: Response, next: NextFunction): void => {
    // Track request start time
    req.startTime = Date.now();
    req.requestId = generateRequestId();

    // Add request ID to response headers for debugging
    res.setHeader('X-Request-ID', req.requestId);

    let responseSize = 0;
    let capturedResponse: any = undefined;

    // Hook into response to capture data
    const originalSend = res.send;
    const originalJson = res.json;

    res.send = function (this: Response, body: any) {
      if (body) {
        responseSize = Buffer.byteLength(body, 'utf8');
        capturedResponse = body;
      }
      return originalSend.call(this, body);
    };

    res.json = function (this: Response, obj: any) {
      if (obj) {
        const jsonString = JSON.stringify(obj);
        responseSize = Buffer.byteLength(jsonString, 'utf8');
        capturedResponse = obj;
      }
      return originalJson.call(this, obj);
    };

    // Listen for response finish to record metrics
    res.on('finish', () => {
      const duration = Date.now() - (req.startTime || Date.now());
      
      // Record request metrics
      performanceMonitor.recordRequest({
        method: req.method,
        path: req.route?.path || req.path,
        statusCode: res.statusCode,
        duration,
        userAgent: req.get('User-Agent'),
        responseSize,
        errorMessage: res.statusCode >= 400 ? 
          (capturedResponse?.error || capturedResponse?.message) : undefined
      });

      // Log slow requests
      if (duration > 2000) { // Requests slower than 2 seconds
        console.warn(`🐌 Slow request detected: ${req.method} ${req.path} took ${duration}ms`);
      }

      // Log error requests
      if (res.statusCode >= 400) {
        console.error(`❌ Error request: ${req.method} ${req.path} - ${res.statusCode} in ${duration}ms`);
      }
    });

    // Handle request errors
    res.on('error', (error) => {
      const duration = Date.now() - (req.startTime || Date.now());
      
      performanceMonitor.recordRequest({
        method: req.method,
        path: req.route?.path || req.path,
        statusCode: 500,
        duration,
        userAgent: req.get('User-Agent'),
        errorMessage: error.message
      });
    });

    next();
  };
}

/**
 * Database query monitoring decorator
 */
export function monitorDatabaseQuery<T extends (...args: any[]) => Promise<any>>(
  queryFn: T,
  queryName: string
): T {
  return (async (...args: Parameters<T>) => {
    const startTime = Date.now();
    let success = false;
    let errorMessage: string | undefined;
    let rowsAffected: number | undefined;

    try {
      const result = await queryFn(...args);
      success = true;
      
      // Try to extract rows affected from result
      if (result && typeof result === 'object') {
        if (Array.isArray(result)) {
          rowsAffected = result.length;
        } else if (typeof result.rowCount === 'number') {
          rowsAffected = result.rowCount;
        } else if (typeof result.changes === 'number') {
          rowsAffected = result.changes;
        }
      }
      
      return result;
    } catch (error) {
      success = false;
      errorMessage = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      
      performanceMonitor.recordDatabaseQuery({
        query: queryName,
        duration,
        success,
        rowsAffected,
        errorMessage
      });

      // Log slow queries
      if (duration > 1000) {
        console.warn(`🐌 Slow database query: ${queryName} took ${duration}ms`);
      }
    }
  }) as T;
}

/**
 * Create monitoring endpoints for health checks and metrics
 */
export function createMonitoringRoutes() {
  return {
    // Health check endpoint with detailed metrics
    healthCheck: async (req: Request, res: Response) => {
      try {
        const status = performanceMonitor.getSystemStatus();
        
        res.status(status.healthy ? 200 : 503).json({
          status: status.healthy ? 'healthy' : 'unhealthy',
          timestamp: status.timestamp,
          uptime: status.uptime,
          memory: status.memory,
          requestStats: {
            total: status.requestStats.totalRequests,
            errorRate: parseFloat(status.requestStats.errorRate.toFixed(2)),
            avgResponseTime: Math.round(status.requestStats.averageResponseTime),
            p95ResponseTime: Math.round(status.requestStats.p95ResponseTime)
          },
          databaseStats: {
            total: status.databaseStats.totalQueries,
            errorRate: parseFloat(status.databaseStats.errorRate.toFixed(2)),
            avgQueryTime: Math.round(status.databaseStats.averageQueryTime),
            p95QueryTime: Math.round(status.databaseStats.p95QueryTime)
          },
          environment: process.env.NODE_ENV || 'unknown'
        });
      } catch (error) {
        res.status(500).json({
          status: 'error',
          message: 'Health check failed',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    },

    // Detailed metrics endpoint
    metrics: async (req: Request, res: Response) => {
      try {
        const minutes = parseInt(req.query.minutes as string) || 60;
        
        const requestStats = performanceMonitor.getRequestStats(minutes);
        const databaseStats = performanceMonitor.getDatabaseStats(minutes);
        const systemStatus = performanceMonitor.getSystemStatus();
        
        res.json({
          timeframe: `${minutes} minutes`,
          timestamp: new Date(),
          requests: {
            total: requestStats.totalRequests,
            errorRate: parseFloat(requestStats.errorRate.toFixed(2)),
            responseTime: {
              average: Math.round(requestStats.averageResponseTime),
              p50: Math.round(requestStats.p50ResponseTime),
              p95: Math.round(requestStats.p95ResponseTime),
              p99: Math.round(requestStats.p99ResponseTime)
            },
            statusCodes: requestStats.statusCodeDistribution
          },
          database: {
            total: databaseStats.totalQueries,
            errorRate: parseFloat(databaseStats.errorRate.toFixed(2)),
            queryTime: {
              average: Math.round(databaseStats.averageQueryTime),
              p95: Math.round(databaseStats.p95QueryTime)
            },
            slowQueries: databaseStats.slowQueries.length
          },
          system: {
            uptime: systemStatus.uptime,
            memory: systemStatus.memory,
            healthy: systemStatus.healthy
          }
        });
      } catch (error) {
        res.status(500).json({
          error: 'Metrics collection failed',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    },

    // Performance report endpoint
    report: async (req: Request, res: Response) => {
      try {
        const report = performanceMonitor.generateReport();
        
        res.setHeader('Content-Type', 'text/plain');
        res.send(report);
      } catch (error) {
        res.status(500).json({
          error: 'Report generation failed',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    },

    // Custom metric recording endpoint (for client-side metrics)
    recordMetric: async (req: Request, res: Response) => {
      try {
        const { name, value, unit, tags } = req.body;
        
        if (!name || typeof value !== 'number' || !unit) {
          return res.status(400).json({
            error: 'Invalid metric data',
            message: 'name, value, and unit are required'
          });
        }
        
        performanceMonitor.recordMetric(name, value, unit, tags);
        
        res.json({
          success: true,
          message: 'Metric recorded successfully'
        });
      } catch (error) {
        res.status(500).json({
          error: 'Failed to record metric',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }
  };
}

/**
 * Error tracking middleware
 */
export function createErrorTrackingMiddleware() {
  return (error: any, req: Request, res: Response, next: NextFunction): void => {
    // Record error metric
    performanceMonitor.recordMetric('application_error', 1, 'count', {
      path: req.path,
      method: req.method,
      errorType: error.constructor.name,
      statusCode: (error.status || error.statusCode || 500).toString()
    });

    // Log error details
    console.error('🚨 Application Error:', {
      message: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

    // Continue with default error handling
    next(error);
  };
}

export { performanceMonitor };