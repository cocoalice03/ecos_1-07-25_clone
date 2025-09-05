// Production-ready Vercel API handler with fallback systems
// Handles both TypeScript route imports and direct API responses

let expressApp = null;
let routesLoaded = false;

// Initialize Express app with comprehensive error handling
async function initializeApp() {
  if (expressApp && routesLoaded) {
    return expressApp;
  }

  try {
    // Dynamic import to handle potential TypeScript compilation issues
    const express = await import('express');
    const app = express.default();
    
    // Middleware setup
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Enhanced CORS middleware
    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
      res.header('Access-Control-Max-Age', '86400'); // 24 hours
      
      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }
      next();
    });

    // Comprehensive health check
    app.get('/api/health', async (req, res) => {
      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'production',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '1.0.0',
        checks: {}
      };

      // Environment variables check
      healthStatus.checks.environment = {
        supabase_url: !!process.env.SUPABASE_URL,
        supabase_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        supabase_anon_key: !!process.env.SUPABASE_ANON_KEY
      };

      // Database connectivity check
      try {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
        
        if (supabaseUrl && supabaseKey) {
          const response = await fetch(`${supabaseUrl}/rest/v1/scenarios?limit=1`, {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 5000
          });
          
          healthStatus.checks.database = {
            connected: response.ok,
            status: response.status,
            responseTime: response.ok ? 'under_5s' : 'timeout_or_error'
          };
        } else {
          healthStatus.checks.database = {
            connected: false,
            error: 'Missing credentials'
          };
        }
      } catch (error) {
        healthStatus.checks.database = {
          connected: false,
          error: error.message
        };
      }

      const isHealthy = healthStatus.checks.environment.supabase_url && 
                       (healthStatus.checks.environment.supabase_service_key || healthStatus.checks.environment.supabase_anon_key);
      
      if (!isHealthy) {
        healthStatus.status = 'degraded';
      }

      res.status(isHealthy ? 200 : 503).json(healthStatus);
    });

    // Fallback scenarios endpoint (in case the dedicated one fails)
    app.get('/api/scenarios', async (req, res) => {
      try {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
          return res.status(200).json({
            scenarios: [],
            connected: false,
            error: 'Database configuration missing',
            source: 'main-api-fallback'
          });
        }

        const response = await fetch(`${supabaseUrl}/rest/v1/scenarios?order=created_at.desc`, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });

        if (response.ok) {
          const scenarios = await response.json();
          return res.status(200).json({
            scenarios: scenarios || [],
            connected: true,
            source: 'main-api-direct',
            count: scenarios?.length || 0
          });
        } else {
          return res.status(200).json({
            scenarios: [],
            connected: false,
            error: `Database error: ${response.status}`,
            source: 'main-api-error'
          });
        }
      } catch (error) {
        return res.status(200).json({
          scenarios: [],
          connected: false,
          error: error.message,
          source: 'main-api-exception'
        });
      }
    });

    // Try to load TypeScript routes
    try {
      const { registerRoutes } = await import('../server/routes.js');
      registerRoutes(app);
      routesLoaded = true;
      console.log('✅ TypeScript routes loaded successfully');
    } catch (error) {
      console.warn('⚠️ TypeScript routes failed to load:', error.message);
      console.log('🔄 Running with fallback API endpoints only');
    }

    // Global error handler
    app.use((err, req, res, next) => {
      console.error(`[${new Date().toISOString()}] API Error:`, {
        url: req.url,
        method: req.method,
        error: err.message,
        stack: err.stack
      });
      
      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-vercel-id'] || 'unknown'
      });
    });

    // 404 handler
    app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `API endpoint ${req.method} ${req.url} not found`,
        availableEndpoints: ['/api/health', '/api/scenarios'],
        timestamp: new Date().toISOString()
      });
    });

    expressApp = app;
    return app;
  } catch (error) {
    console.error('❌ Failed to initialize Express app:', error);
    throw error;
  }
}

// Main Vercel handler
export default async function handler(req, res) {
  try {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    
    const app = await initializeApp();
    return app(req, res);
  } catch (error) {
    console.error('❌ Handler initialization failed:', error);
    
    // Ultimate fallback response
    res.status(500).json({
      error: 'Service Initialization Failed',
      message: error.message,
      timestamp: new Date().toISOString(),
      fallback: true
    });
  }
}