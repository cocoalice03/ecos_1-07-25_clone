import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.js";
import { setupVite, serveStatic, log } from "./vite.js";
import { checkDatabaseHealth } from "./db.js";
import { addDiagnosticRoutes } from "./diagnostic-endpoint.js";
import { createDebugMiddleware, createDatabaseErrorHandler } from "./debug.middleware.js";
import { databaseCircuitBreaker } from "./middleware/circuit-breaker.middleware.js";
import { generalRateLimit, rateLimitStatus } from "./middleware/rate-limit.middleware.js";
import { 
  errorHandler, 
  addRequestId, 
  handleError, 
  notFoundHandler, 
  setupGlobalErrorHandling 
} from "./middleware/error-handler.middleware.js";
import { startupSequencer } from "./services/startup-sequencer.service.js";
import { createReadinessGate, addReadinessHeaders } from "./middleware/readiness-gate.middleware.js";
import { logger } from "./services/logger.service.js";


// Simplified environment validation
function validateEnvironment() {
  const missing = ['DATABASE_URL', 'OPENAI_API_KEY', 'PINECONE_API_KEY'].filter(v => !process.env[v]);
  if (missing.length > 0) {
    logger.warn(`Missing environment variables: ${missing.join(', ')}`, { missingVariables: missing });
  }
}

const app = express();

// Setup global error handling
setupGlobalErrorHandling();

// Add request ID tracking
app.use(addRequestId());

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add readiness gate (blocks API requests until services ready)
app.use(createReadinessGate());

// Add readiness headers to responses
app.use(addReadinessHeaders);

// Add rate limiting (apply to all routes)
app.use(generalRateLimit.middleware());

// Add debug middleware
app.use(createDebugMiddleware());
app.use(createDatabaseErrorHandler());

// Health check endpoint with robust error handling
app.get('/health', async (req: Request, res: Response) => {
  const healthStatus: {
    status: string;
    timestamp: string;
    environment: string;
    services: { database: string; server: string; };
    uptime?: number;
  } = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      database: 'unknown',
      server: 'healthy'
    }
  };

  try {
    // Use the centralized health check function
    const dbHealthPromise = checkDatabaseHealth();

    const timeoutPromise = new Promise<any>((resolve) => {
      setTimeout(() => resolve({ status: 'timeout', error: 'Database health check timeout' }), 5000);
    });

    // Race between database check and timeout
    const dbHealth = await Promise.race([dbHealthPromise, timeoutPromise]);
    healthStatus.services.database = dbHealth.status;

    // Include uptime info
    healthStatus.uptime = Date.now() - new Date().getTime();

    // Overall health determination - server can be healthy even if DB is down (graceful degradation)
    if (dbHealth.status === 'unhealthy' || dbHealth.status === 'timeout') {
      healthStatus.status = 'degraded';
    }

    // Always return 200 for health endpoint to prevent load balancer issues
    res.status(200).json(healthStatus);
  } catch (error) {
    // Never let the health check crash the server
    logger.error('Health check error', { error: error instanceof Error ? error.message : String(error) });
    res.status(200).json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: 'error',
        server: 'healthy'
      },
      error: error instanceof Error ? error.message : 'Unknown health check error'
    });
  }
});

// Ready endpoint - indicates server is ready to receive requests
app.get('/ready', (req: Request, res: Response) => {
  try {
    const readinessStatus = startupSequencer.getReadinessStatus();
    
    if (readinessStatus.ready) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        processUptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        ...readinessStatus
      });
    } else {
      res.status(503).json({
        status: 'not-ready',
        timestamp: new Date().toISOString(),
        message: 'Services are still initializing',
        ...readinessStatus
      });
    }
  } catch (error) {
    // Even readiness check should not crash
    logger.error('Ready check error', { error: error instanceof Error ? error.message : String(error) });
    res.status(503).json({
      status: 'not-ready',
      timestamp: new Date().toISOString(),
      error: 'Server not ready'
    });
  }
});

// Circuit breaker status endpoint for monitoring
app.get('/circuit-breaker', (req: Request, res: Response) => {
  try {
    const status = databaseCircuitBreaker.getStatus();
    res.status(200).json({
      circuitBreaker: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get circuit breaker status',
      timestamp: new Date().toISOString()
    });
  }
});

// Rate limiter status endpoint
app.get('/rate-limit-status', rateLimitStatus());


(async () => {
  logger.info('Starting ECOS-Infirmier Application...');
  
  // Validate environment
  validateEnvironment();
  
  // Setup diagnostic routes
  addDiagnosticRoutes(app);

  // Initialize services in sequence (CRITICAL for stability)
  logger.info('🚀 Initializing services sequentially...');
  try {
    await startupSequencer.waitForReady(30000); // 30 second timeout
    logger.info('✅ All services ready - server can now accept requests');
  } catch (error: any) {
    logger.warn('⚠️ Service initialization incomplete', { error: error.message });
    logger.warn('⚠️ Server will start in degraded mode');
  }

  // Setup routes
  const server = await registerRoutes(app);

  // Security middleware for sensitive files
  app.use((req, res, next) => {
    const sensitivePaths = [
      '/.env', '/package.json', '/.replit', '/server', '/shared', '/scripts'
    ];

    if (sensitivePaths.some(path => req.path.startsWith(path))) {
      return res.status(404).json({ error: "Not Found" });
    }
    next();
  });

  // Setup frontend serving BEFORE error handlers
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Error handler health check endpoint
  app.get('/error-handler-status', errorHandler.healthCheck());

  // 404 handler for undefined routes (only for non-frontend routes)
  app.use('/api', notFoundHandler());

  // Main error handler (must be last middleware)
  app.use(handleError());

  // Start server with error handling
  const port = parseInt(process.env.PORT || '5000', 10);
  const host = '127.0.0.1';
  
  server.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`Port ${port} is already in use. Please stop any running servers and try again.`, { port, code: error.code });
      process.exit(1);
    } else {
      logger.error('Server error', { error: error.message, code: error.code });
      process.exit(1);
    }
  });
  
  server.listen(port, host, () => {
    logger.info('Server started successfully', {
      host,
      port,
      environment: process.env.NODE_ENV || 'development',
      urls: {
        app: `http://${host}:${port}`,
        health: `http://${host}:${port}/health`,
        ready: `http://${host}:${port}/ready`
      }
    });
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down gracefully');
    server.close(() => process.exit(0));
  });

  process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down gracefully');
    server.close(() => process.exit(0));
  });

})().catch((error) => {
  logger.error('Application startup failed', { 
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  });
  process.exit(1);
});