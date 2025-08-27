import express, { type Express, type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.js";
import { addDiagnosticRoutes } from "./diagnostic-endpoint.js";
import { createDebugMiddleware, createDatabaseErrorHandler } from "./debug.middleware.js";
import { db, users, testDatabaseConnection, checkDatabaseHealth } from "./db.js";
import { 
  createMonitoringMiddleware, 
  createMonitoringRoutes, 
  createErrorTrackingMiddleware 
} from "./middleware/monitoring.middleware.js";
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface ServerlessAppConfig {
  environment: 'development' | 'production';
  enableDebug: boolean;
  maxResponseTime: number;
  enableHealthChecks: boolean;
}

class ServerlessApplication {
  private app: Express | null = null;
  private initialized = false;
  private initializationPromise: Promise<Express> | null = null;
  private config: ServerlessAppConfig;
  
  constructor(config?: Partial<ServerlessAppConfig>) {
    this.config = {
      environment: (process.env.NODE_ENV as 'development' | 'production') || 'production',
      enableDebug: process.env.NODE_ENV !== 'production',
      maxResponseTime: 25000, // 25s for Vercel timeout buffer
      enableHealthChecks: true,
      ...config
    };
  }

  private validateEnvironment(): { isValid: boolean; missing: string[] } {
    const required = ['DATABASE_URL'];
    const optional = ['OPENAI_API_KEY', 'PINECONE_API_KEY'];
    const missing = required.filter(v => !process.env[v]);
    
    if (missing.length > 0) {
      console.error(`❌ Missing critical environment variables: ${missing.join(', ')}`);
    }
    
    const optionalMissing = optional.filter(v => !process.env[v]);
    if (optionalMissing.length > 0) {
      console.warn(`⚠️ Missing optional environment variables: ${optionalMissing.join(', ')}`);
    }
    
    return { isValid: missing.length === 0, missing };
  }

  private setupMiddleware(app: Express): void {
    // Basic middleware
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: false, limit: '10mb' }));

    // Performance monitoring middleware (must be early)
    app.use(createMonitoringMiddleware());

    // Security middleware
    app.use((req, res, next) => {
      // Prevent sensitive file access
      const sensitivePaths = [
        '/.env', '/package.json', '/.replit', '/server', '/shared', '/scripts',
        '/node_modules', '/.git', '/dist/index.js'
      ];

      if (sensitivePaths.some(path => req.path.startsWith(path))) {
        return res.status(404).json({ error: "Not Found" });
      }
      next();
    });

    // Debug middleware in development
    if (this.config.enableDebug) {
      app.use(createDebugMiddleware());
    }
    
    // Database error handling
    app.use(createDatabaseErrorHandler());

    // Request timeout middleware
    app.use((req, res, next) => {
      const timeout = setTimeout(() => {
        if (!res.headersSent) {
          res.status(504).json({ 
            error: 'Request timeout',
            message: 'The request took too long to process'
          });
        }
      }, this.config.maxResponseTime);

      res.on('finish', () => clearTimeout(timeout));
      next();
    });
  }

  private setupHealthChecks(app: Express): void {
    if (!this.config.enableHealthChecks) return;

    // Get monitoring routes
    const monitoringRoutes = createMonitoringRoutes();

    // Enhanced health check with monitoring integration
    app.get('/health', monitoringRoutes.healthCheck);

    // Readiness check
    app.get('/ready', (req: Request, res: Response) => {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        initialized: this.initialized,
        environment: this.config.environment
      });
    });

    // Liveness check (always returns 200 if the process is running)
    app.get('/live', (req: Request, res: Response) => {
      res.status(200).json({
        status: 'alive',
        timestamp: new Date().toISOString(),
        pid: process.pid,
        uptime: process.uptime()
      });
    });

    // Performance metrics endpoint
    app.get('/metrics', monitoringRoutes.metrics);

    // Performance report endpoint
    app.get('/report', monitoringRoutes.report);

    // Custom metric recording endpoint
    app.post('/metrics', monitoringRoutes.recordMetric);
  }

  private setupErrorHandling(app: Express): void {
    // Error tracking middleware (must be before error handlers)
    app.use(createErrorTrackingMiddleware());

    // 404 handler for unknown routes
    app.use('*', (req: Request, res: Response) => {
      res.status(404).json({ 
        error: 'Not Found',
        message: `Route ${req.method} ${req.originalUrl} not found`,
        timestamp: new Date().toISOString()
      });
    });

    // Global error handler
    app.use((err: any, req: Request, res: Response, next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      const errorId = Math.random().toString(36).substr(2, 9);
      
      console.error(`[${errorId}] Serverless Error [${status}]:`, {
        message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString()
      });
      
      res.status(status).json({ 
        error: this.config.environment === 'production' ? 'Internal Server Error' : message,
        message: this.config.environment === 'production' ? 'An error occurred processing your request' : message,
        errorId,
        timestamp: new Date().toISOString()
      });
    });
  }

  private async initializeApplication(): Promise<Express> {
    if (this.initialized && this.app) {
      return this.app;
    }

    console.log(`🚀 Initializing ECOS serverless application (${this.config.environment})`);
    
    // Validate environment
    const { isValid, missing } = this.validateEnvironment();
    if (!isValid) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    // Create Express app
    const app = express();
    
    // Setup middleware
    this.setupMiddleware(app);
    
    // Setup health checks
    this.setupHealthChecks(app);

    // Setup diagnostic routes (for debugging)
    if (this.config.enableDebug) {
      addDiagnosticRoutes(app);
    }

    // Register API routes
    try {
      await registerRoutes(app);
      console.log('✅ API routes registered successfully');
    } catch (error) {
      console.error('❌ Failed to register routes:', error);
      throw error;
    }

    // Setup error handling (must be last)
    this.setupErrorHandling(app);

    this.app = app;
    this.initialized = true;
    
    console.log('✅ ECOS serverless application initialized successfully');
    return app;
  }

  async getApplication(): Promise<Express> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    if (this.initialized && this.app) {
      return this.app;
    }

    this.initializationPromise = this.initializeApplication();
    return this.initializationPromise;
  }

  async handleRequest(req: VercelRequest, res: VercelResponse): Promise<void> {
    try {
      const app = await this.getApplication();
      
      return new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Request handling timeout'));
        }, this.config.maxResponseTime);

        app(req as any, res as any, (err: any) => {
          clearTimeout(timeoutId);
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('Critical serverless handler error:', error);
      
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Application initialization failed',
          timestamp: new Date().toISOString()
        });
      }
    }
  }
}

// Create singleton instance
const serverlessApp = new ServerlessApplication();

export { ServerlessApplication, serverlessApp };