import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "../server/routes";
import { db, users } from "../server/db";
import { addDiagnosticRoutes } from "../server/diagnostic-endpoint";
import { createDebugMiddleware, createDatabaseErrorHandler } from "../server/debug.middleware";
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Simplified environment validation
function validateEnvironment() {
  const missing = ['DATABASE_URL', 'OPENAI_API_KEY', 'PINECONE_API_KEY'].filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.warn(`Missing environment variables: ${missing.join(', ')}`);
  }
}

// Create Express app
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add debug middleware
app.use(createDebugMiddleware());
app.use(createDatabaseErrorHandler());

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  try {
    // Test database connection - simple query
    const result = await db.select().from(users).limit(1);
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'production'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Ready endpoint
app.get('/ready', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ready',
    timestamp: new Date().toISOString()
  });
});

// Logging middleware
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

      console.log(logLine);
    }
  });

  next();
});

// Initialize app
let initialized = false;

async function initializeApp() {
  if (initialized) return;
  
  console.log('Initializing ECOS serverless function...');
  
  // Validate environment
  validateEnvironment();
  
  // Setup diagnostic routes
  addDiagnosticRoutes(app);

  // Database initialization is handled by Supabase
  console.log('Database connection managed by Supabase.');

  // Setup API routes
  await registerRoutes(app);

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

  // Error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error(`Serverless Error [${status}]:`, message);
    res.status(status).json({ message });
  });

  initialized = true;
  console.log('ECOS serverless function initialized');
}

// Vercel serverless handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await initializeApp();
    
    // Handle the request through Express
    return new Promise((resolve, reject) => {
      app(req as any, res as any, (err: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(res);
        }
      });
    });
  } catch (error) {
    console.error('Serverless handler error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}