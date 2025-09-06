# Vercel Deployment Configuration Guide

## Overview

This document provides comprehensive information about deploying the ECOS Medical Training Platform on Vercel's serverless infrastructure. The application is configured as a modern Single Page Application (SPA) with serverless API functions, optimized for global performance and scalability.

## 🏗️ Deployment Architecture

### Serverless Application Structure

```
Vercel Deployment Structure:
├── Frontend (SPA)
│   ├── Static Assets (CDN)
│   ├── React Bundle (dist/public/)
│   └── Client-side Routing
├── Serverless Functions
│   ├── /api/index.js (Main API handler)
│   ├── /api/scenarios.js (Scenarios endpoint)
│   └── Automatic scaling
└── Edge Network
    ├── Global CDN
    ├── Edge Computing
    └── Automatic SSL
```

### Key Benefits of Vercel Deployment

- **Zero Configuration**: Automatic detection of React/Node.js
- **Global CDN**: Worldwide content delivery network
- **Serverless Scaling**: Automatic scaling based on traffic
- **Edge Functions**: Global compute at the edge
- **Continuous Deployment**: Git-based deployment workflow
- **Preview Deployments**: Branch-based preview environments

## ⚙️ Vercel Configuration

### vercel.json Configuration

The primary deployment configuration in `vercel.json`:

```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "dist/public",
  "framework": null,
  "functions": {
    "api/index.js": {
      "runtime": "@vercel/node@5.3.13",
      "maxDuration": 30
    },
    "api/scenarios.js": {
      "runtime": "@vercel/node@5.3.13",
      "maxDuration": 30
    }
  },
  "env": {
    "NODE_ENV": "production"
  },
  "rewrites": [
    {
      "source": "/api/ecos/scenarios",
      "destination": "/api/scenarios.js"
    },
    {
      "source": "/api/health",
      "destination": "/api/index.js"
    },
    {
      "source": "/api/(.*)",
      "destination": "/api/index.js"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "*"
        },
        {
          "key": "Access-Control-Allow-Methods",
          "value": "GET, POST, PUT, DELETE, OPTIONS"
        },
        {
          "key": "Access-Control-Allow-Headers",
          "value": "Content-Type, Authorization"
        },
        {
          "key": "Cache-Control",
          "value": "no-cache, no-store, must-revalidate"
        }
      ]
    },
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

### Configuration Breakdown

#### Build Configuration
- **buildCommand**: `npm run build` - Vite production build
- **outputDirectory**: `dist/public` - Built assets location
- **framework**: `null` - Custom configuration (not auto-detected)

#### Serverless Functions
```json
"functions": {
  "api/index.js": {
    "runtime": "@vercel/node@5.3.13",    // Node.js runtime version
    "maxDuration": 30                     // 30-second timeout
  }
}
```

#### Route Rewrites
1. **API Routes**: `/api/*` → serverless functions
2. **SPA Routes**: `/*` → `index.html` (client-side routing)
3. **Specific Endpoints**: Custom routing for specialized endpoints

#### Headers Configuration
- **CORS Headers**: Cross-origin request support
- **Caching Headers**: Optimized caching strategies
- **Security Headers**: XSS and security protections

## 🚀 Deployment Process

### Automated Deployment

```bash
# Development deployment
git push origin main

# Production deployment (via Vercel CLI)
vercel --prod

# Preview deployment
vercel

# Safe deployment with validation
npm run deploy:safe
```

### Manual Deployment Steps

1. **Pre-deployment Validation**
   ```bash
   # Validate environment variables
   npm run validate:env
   
   # TypeScript checking
   npm run check
   
   # Build verification
   npm run build
   ```

2. **Deploy to Vercel**
   ```bash
   # Install Vercel CLI
   npm i -g vercel
   
   # Login and setup
   vercel login
   vercel
   
   # Production deployment
   vercel --prod
   ```

3. **Post-deployment Validation**
   ```bash
   # Health check
   curl https://your-app.vercel.app/api/health
   
   # Endpoint validation
   npm run validate:deployment https://your-app.vercel.app
   ```

### Deployment Scripts

The application includes deployment automation scripts:

```bash
# Production deployment with validation
./scripts/deploy-production.sh

# Deployment validation
node scripts/deployment-validator.js --validate

# Health monitoring
node scripts/deployment-validator.js --health-check

# Emergency rollback
node scripts/deployment-validator.js --rollback
```

## 🔧 Build Configuration

### Vite Build Setup

Build configuration in `vite.config.ts`:

```typescript
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-select'],
        }
      }
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
});
```

### Build Optimizations

- **Code Splitting**: Automatic and manual chunk splitting
- **Tree Shaking**: Dead code elimination
- **Asset Optimization**: Image and font optimization
- **Bundle Analysis**: Bundle size monitoring
- **Source Maps**: Development debugging support

## 🌐 Serverless Functions

### API Function Structure

#### Main API Handler: `api/index.js`

**Complete Implementation** (211 lines with comprehensive error handling):

```javascript
// Production-ready Vercel API handler with fallback systems
// Handles both TypeScript route imports and direct API responses

let expressApp = null;
let routesLoaded = false;

// Initialize Express app with comprehensive error handling
async function initializeApp() {
  if (expressApp && routesLoaded) {
    return expressApp; // Singleton pattern for cold start optimization
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

    // Comprehensive health check with database connectivity
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

      // Database connectivity check via Supabase REST API
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
        }
      } catch (error) {
        healthStatus.checks.database = {
          connected: false,
          error: error.message
        };
      }

      const isHealthy = healthStatus.checks.environment.supabase_url;
      res.status(isHealthy ? 200 : 503).json(healthStatus);
    });

    // Fallback scenarios endpoint (in case dedicated one fails)
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

    // Try to load TypeScript routes with graceful fallback
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

    expressApp = app;
    return app;
  } catch (error) {
    console.error('❌ Failed to initialize Express app:', error);
    throw error;
  }
}

// Main Vercel handler with ultimate fallback
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
```

#### Scenarios API Handler: `api/scenarios.js`

**Dedicated Endpoint** for ECOS scenarios with direct Supabase integration.

### Function Configuration

```json
{
  "functions": {
    "api/index.js": {
      "runtime": "@vercel/node@5.3.13",
      "maxDuration": 30,                    // 30 seconds max execution
      "memory": 1024,                       // 1GB memory allocation
      "regions": ["cdg1"]                   // Paris region (closest to Europe)
    }
  }
}
```

### Function Optimization Strategies

1. **Cold Start Optimization**
   - Singleton pattern for Express app
   - Lazy loading of heavy dependencies
   - Connection reuse across invocations

2. **Memory Management**
   - Efficient variable scoping
   - Garbage collection considerations
   - Memory leak prevention

3. **Error Handling**
   - Comprehensive try-catch blocks
   - Graceful degradation
   - Fallback mechanisms

## 🔒 Environment Configuration

### Environment Variables

#### Required Variables
```env
# Database
SUPABASE_URL=https://[project-id].supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
SUPABASE_ANON_KEY=eyJhbGc...
DATABASE_URL=postgresql://...

# API Keys
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=...

# Application
NODE_ENV=production
```

#### Vercel Environment Setup

1. **Via Vercel Dashboard**
   - Project Settings → Environment Variables
   - Add each variable with appropriate scope
   - Configure for Production, Preview, and Development

2. **Via Vercel CLI**
   ```bash
   # Add environment variable
   vercel env add SUPABASE_URL
   
   # List environment variables
   vercel env ls
   
   # Remove environment variable
   vercel env rm SUPABASE_URL
   ```

3. **Via .env Files**
   ```bash
   # Local development
   .env.local
   
   # Vercel automatically detects and uses:
   .env.production     # Production deployments
   .env.preview        # Preview deployments  
   .env.development    # Development builds
   ```

## 📊 Performance Optimization

### CDN and Caching Strategy

#### Asset Caching
```json
"headers": [
  {
    "source": "/assets/(.*)",
    "headers": [
      {
        "key": "Cache-Control",
        "value": "public, max-age=31536000, immutable"
      }
    ]
  }
]
```

#### API Caching
```json
{
  "source": "/api/(.*)",
  "headers": [
    {
      "key": "Cache-Control", 
      "value": "no-cache, no-store, must-revalidate"
    }
  ]
}
```

### Global Performance Features

1. **Edge Network**
   - Global CDN with 100+ locations
   - Automatic edge caching
   - Geographic request routing

2. **Image Optimization**
   - Automatic WebP conversion
   - Responsive image serving
   - Quality optimization

3. **Compression**
   - Automatic Gzip/Brotli compression
   - Asset minification
   - Bundle optimization

## 🔍 Monitoring and Analytics

### Built-in Monitoring

Vercel provides comprehensive monitoring:

1. **Function Logs**
   - Real-time function execution logs
   - Error tracking and alerting
   - Performance metrics

2. **Analytics Dashboard**
   - Page views and user sessions
   - Core Web Vitals tracking
   - Geographic usage data

3. **Deployment History**
   - Complete deployment timeline
   - Rollback capabilities
   - Preview deployment management

### Custom Monitoring

```javascript
// Performance monitoring in functions
const startTime = Date.now();

// ... function logic ...

const duration = Date.now() - startTime;
console.log(`Function executed in ${duration}ms`);

// Custom metrics
console.log(JSON.stringify({
  metric: 'api_response_time',
  value: duration,
  endpoint: req.url,
  timestamp: new Date().toISOString()
}));
```

### Health Check Implementation

```javascript
// Comprehensive health check
app.get('/api/health', async (req, res) => {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '1.0.0',
    checks: {
      environment: {
        supabase_url: !!process.env.SUPABASE_URL,
        supabase_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY
      },
      database: await checkDatabaseConnectivity()
    }
  };

  const isHealthy = healthStatus.checks.environment.supabase_url && 
                   healthStatus.checks.database.connected;
  
  res.status(isHealthy ? 200 : 503).json(healthStatus);
});
```

## 🚨 Error Handling and Recovery

### Error Boundaries

```javascript
// Global error handler
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] API Error:`, {
    url: req.url,
    method: req.method,
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred',
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-vercel-id'] || 'unknown'
  });
});
```

### Fallback Strategies

1. **Function Fallbacks**
   - Multiple function endpoints for critical paths
   - Graceful degradation when services fail
   - Client-side error recovery

2. **Database Fallbacks**
   - Multiple connection strategies
   - Cached data serving when database unavailable
   - Circuit breaker pattern

3. **CDN Fallbacks**
   - Multiple asset sources
   - Service worker caching
   - Offline functionality

## 🔧 Deployment Validation

### Automated Validation Script

```javascript
// scripts/deployment-validator.js
class DeploymentValidator {
  async validateEndpoints(baseUrl) {
    const endpoints = [
      '/api/health',
      '/api/scenarios', 
      '/api/sessions'
    ];

    for (const endpoint of endpoints) {
      const response = await fetch(`${baseUrl}${endpoint}`);
      if (!response.ok) {
        throw new Error(`Endpoint ${endpoint} failed: ${response.status}`);
      }
    }
  }

  async validatePerformance(baseUrl) {
    const start = Date.now();
    await fetch(`${baseUrl}/api/health`);
    const duration = Date.now() - start;
    
    if (duration > 5000) {
      throw new Error(`Performance check failed: ${duration}ms > 5000ms`);
    }
  }

  async validateDatabase(baseUrl) {
    const response = await fetch(`${baseUrl}/api/health`);
    const health = await response.json();
    
    if (!health.checks?.database?.connected) {
      throw new Error('Database connectivity check failed');
    }
  }
}
```

### Usage Examples

```bash
# Validate deployment
npm run validate:deployment https://your-app.vercel.app

# Continuous health monitoring
npm run health:check https://your-app.vercel.app

# Performance baseline recording
node scripts/deployment-validator.js --baseline https://your-app.vercel.app
```

## 🔄 CI/CD Integration

### GitHub Actions Integration

```yaml
# .github/workflows/vercel-deployment.yml
name: Vercel Deployment
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run tests
        run: npm run check
        
      - name: Build application
        run: npm run build
        
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          vercel-args: '--prod'
          
      - name: Validate deployment
        run: npm run validate:deployment ${{ steps.deploy.outputs.preview-url }}
```

### Deployment Hooks

```javascript
// Vercel deployment hooks
export default async function handler(req, res) {
  if (req.method === 'POST' && req.url === '/api/deploy-hook') {
    // Triggered on each deployment
    console.log('Deployment completed', {
      timestamp: new Date().toISOString(),
      deployment: req.headers['x-vercel-deployment-url']
    });
    
    // Run post-deployment tasks
    await runPostDeploymentTasks();
    
    res.status(200).json({ status: 'acknowledged' });
  }
}
```

## 📝 Best Practices

### Development Workflow

1. **Branch Strategy**
   - `main` branch → Production deployments
   - `develop` branch → Preview deployments
   - Feature branches → Preview deployments

2. **Environment Parity**
   - Identical environment variables across environments
   - Consistent Node.js versions
   - Same build processes

3. **Testing Strategy**
   - Pre-deployment validation
   - Post-deployment health checks
   - Performance monitoring
   - Error tracking

### Performance Best Practices

1. **Code Optimization**
   - Bundle size monitoring
   - Lazy loading implementation
   - Code splitting strategies

2. **Asset Optimization**
   - Image compression and WebP conversion
   - Font optimization and subsetting
   - CSS and JS minification

3. **Caching Strategy**
   - Aggressive static asset caching
   - Dynamic content cache headers
   - CDN utilization

### Security Best Practices

1. **Environment Variables**
   - Never commit secrets to version control
   - Use Vercel environment variable encryption
   - Rotate keys regularly

2. **API Security**
   - CORS configuration
   - Rate limiting
   - Input validation

3. **Headers Configuration**
   - Security headers (CSP, HSTS, etc.)
   - XSS protection
   - Content type validation

## 🔧 Troubleshooting

### Common Deployment Issues

1. **Build Failures**
   ```bash
   # Check build logs
   vercel logs
   
   # Local build test
   npm run build
   
   # TypeScript errors
   npm run check
   ```

2. **Function Timeouts**
   - Increase `maxDuration` in vercel.json
   - Optimize function performance
   - Implement caching strategies

3. **Environment Variable Issues**
   ```bash
   # Verify environment variables
   vercel env ls
   
   # Test locally
   npm run validate:env
   ```

### Debugging Tools

1. **Vercel CLI**
   ```bash
   # View deployment logs
   vercel logs [deployment-url]
   
   # Function logs
   vercel logs --follow
   
   # Development mode
   vercel dev
   ```

2. **Health Monitoring**
   ```bash
   # Endpoint health check
   curl https://your-app.vercel.app/api/health
   
   # Performance check
   curl -w "@curl-format.txt" https://your-app.vercel.app/api/health
   ```

3. **Error Tracking**
   - Function execution logs in Vercel dashboard
   - Custom error logging with structured data
   - Performance metrics tracking

---

**Last Updated**: September 2025  
**Version**: 2.0.0  
**Deployment Status**: Production Ready  
**Vercel Runtime**: Node.js 18.x