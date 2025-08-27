// Load environment variables first
import dotenv from "dotenv";
dotenv.config();

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.js";
import { setupVite, serveStatic, log } from "./vite.js";
import { db, users, checkDatabaseHealth } from "./db.js";
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


// Simplified environment validation
function validateEnvironment() {
  const missing = ['DATABASE_URL', 'OPENAI_API_KEY', 'PINECONE_API_KEY'].filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.warn(`Missing environment variables: ${missing.join(', ')}`);
  }
}

const app = express();

// Setup global error handling
setupGlobalErrorHandling();

// Add request ID tracking
app.use(addRequestId());

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add rate limiting (apply to all routes)
app.use(generalRateLimit.middleware());

// Add debug middleware
app.use(createDebugMiddleware());
app.use(createDatabaseErrorHandler());

// Health check endpoint with robust error handling
app.get('/health', async (req: Request, res: Response) => {
  const healthStatus = {
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

    // Include circuit breaker info if available
    if (dbHealth.circuitBreaker) {
      healthStatus.services.circuitBreaker = dbHealth.circuitBreaker.state;
    }

    // Overall health determination - server can be healthy even if DB is down (graceful degradation)
    if (dbHealth.status === 'unhealthy' || dbHealth.status === 'timeout') {
      healthStatus.status = 'degraded';
    }

    // Always return 200 for health endpoint to prevent load balancer issues
    res.status(200).json(healthStatus);
  } catch (error) {
    // Never let the health check crash the server
    console.error('Health check error:', error);
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
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0'
    });
  } catch (error) {
    // Even readiness check should not crash
    console.error('Ready check error:', error);
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

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  console.log('Starting LearnWorlds RAG Application...');
  
  // Validate environment
  validateEnvironment();
  
  // Setup diagnostic routes
  addDiagnosticRoutes(app);

  // Database initialization is now handled by Firebase Admin SDK.
  // The previous SQL-based table creation is no longer needed.
  console.log('Database connection managed by Firebase.');

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
  const host = '0.0.0.0';
  
  server.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Please stop any running servers and try again.`);
      process.exit(1);
    } else {
      console.error('Server error:', error.message);
      process.exit(1);
    }
  });
  
  server.listen(port, host, () => {
    console.log('Server started successfully');
    console.log(`Listening on http://${host}:${port}`);
    console.log(`Health check: http://${host}:${port}/health`);
    console.log(`Ready check: http://${host}:${port}/ready`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully');
    server.close(() => process.exit(0));
  });

  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully');
    server.close(() => process.exit(0));
  });

})().catch((error) => {
  console.error('Application startup failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});