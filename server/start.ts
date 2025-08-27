import express from "express";
import { registerRoutes } from "./routes.js";
import { setupVite, serveStatic } from "./vite.js";
import { addDiagnosticRoutes } from "./diagnostic-endpoint.js";
import { createDebugMiddleware, createDatabaseErrorHandler } from "./debug.middleware.js";
import { createTrainingSessionsTables } from "./db.js";
import { db } from "./db.js";

// Simple server startup for deployment
async function startApplication() {
  console.log('🚀 Starting application...');
  
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  
  // Add middleware
  app.use(createDebugMiddleware());
  app.use(createDatabaseErrorHandler());
  
  // Health check endpoint
  app.get('/health', async (req, res) => {
    try {
      await db.execute('SELECT 1 as test');
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  app.get('/ready', (req, res) => {
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  });
  
  // Setup diagnostic routes
  addDiagnosticRoutes(app);
  
  // Initialize database
  try {
    await createTrainingSessionsTables();
    console.log('✅ Database initialized');
  } catch (error) {
    console.warn('Database initialization warning:', error instanceof Error ? error.message : String(error));
  }
  
  // Setup routes
  const server = await registerRoutes(app);
  
  // Setup frontend
  if (app.get("env") === "development") {
    await setupVite(app, server);
    console.log('✅ Development environment configured');
  } else {
    serveStatic(app);
    console.log('✅ Production environment configured');
  }
  
  // Start server
  const port = 5000;
  const host = '0.0.0.0';
  
  server.listen(port, host, () => {
    console.log('✅ Server started successfully');
    console.log(`🌐 Listening on http://${host}:${port}`);
    console.log(`🏥 Health: http://${host}:${port}/health`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('📡 Received SIGTERM, shutting down gracefully');
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });
  
  process.on('SIGINT', () => {
    console.log('📡 Received SIGINT, shutting down gracefully');
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });
}

startApplication().catch((error) => {
  console.error('💥 Application failed to start:', error);
  process.exit(1);
});