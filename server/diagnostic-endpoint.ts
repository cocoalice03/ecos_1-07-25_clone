
import { Request, Response } from "express";
import { authService } from "./middleware/auth.middleware.js";

export function addDiagnosticRoutes(app: any) {
  // Auth debugging endpoint
  app.get("/api/diagnostic/auth-check", async (req: Request, res: Response) => {
    try {
      const { email } = req.query;
      const ADMIN_EMAILS = authService.getAdminEmails();
      
      const authInfo = {
        receivedEmail: email,
        emailType: typeof email,
        emailString: String(email || ''),
        emailLowerCase: String(email || '').toLowerCase(),
        adminEmails: ADMIN_EMAILS,
        isAuthorized: authService.isAdmin(String(email || '')),
        includes: ADMIN_EMAILS.includes(String(email || '').toLowerCase()),
        query: req.query,
        timestamp: new Date().toISOString()
      };
      
      res.json(authInfo);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      });
    }
  });

  // Simple auth test endpoint
  app.get("/api/diagnostic/auth-test", async (req: Request, res: Response) => {
    try {
      const { email } = req.query;
      const ADMIN_EMAILS = authService.getAdminEmails();
      
      const result = {
        inputEmail: email,
        emailType: typeof email,
        isString: typeof email === 'string',
        normalizedEmail: typeof email === 'string' ? email.toLowerCase().trim() : null,
        adminEmails: ADMIN_EMAILS,
        normalizedAdminEmails: ADMIN_EMAILS.map(e => e.toLowerCase().trim()),
        isAuthorized: authService.isAdmin(email as string),
        timestamp: new Date().toISOString()
      };
      
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      });
    }
  });

  app.get("/api/diagnostic/health", async (req: Request, res: Response) => {
    try {
      const health = {
        timestamp: new Date().toISOString(),
        status: "healthy",
        checks: {
          memory: process.memoryUsage(),
          uptime: process.uptime(),
          platform: process.platform,
          nodeVersion: process.version,
          env: {
            NODE_ENV: process.env.NODE_ENV,
            hasOpenAI: !!process.env.OPENAI_API_KEY,
            hasPinecone: !!process.env.PINECONE_API_KEY
          }
        }
      };
      
      res.json(health);
    } catch (error) {
      res.status(500).json({
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/diagnostic/routes", async (req: Request, res: Response) => {
    try {
      // Get all registered routes
      const routes: any[] = [];
      
      app._router.stack.forEach((middleware: any) => {
        if (middleware.route) {
          routes.push({
            path: middleware.route.path,
            methods: Object.keys(middleware.route.methods)
          });
        } else if (middleware.name === 'router') {
          middleware.handle.stack.forEach((handler: any) => {
            if (handler.route) {
              routes.push({
                path: handler.route.path,
                methods: Object.keys(handler.route.methods)
              });
            }
          });
        }
      });

      res.json({ routes });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
}
