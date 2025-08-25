import { serverlessApp } from "../server/serverless-app";
import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel Serverless Function Handler
 * 
 * This handler uses a robust ServerlessApplication class that provides:
 * - Singleton pattern for efficient cold starts
 * - Comprehensive error handling and monitoring
 * - Database connection pooling with timeouts
 * - Security middleware and request validation
 * - Health check endpoints with detailed metrics
 * - Request timeout protection
 * 
 * Critical Success Metrics:
 * - Uptime: 99.9% availability target
 * - Response Time: <500ms for API calls
 * - Error Rate: <1% of requests should fail
 * - Database Connectivity: 99.95% successful connections
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Add security headers
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  try {
    // Use the robust serverless application handler
    await serverlessApp.handleRequest(req, res);
  } catch (error) {
    console.error('Critical handler error:', error);
    
    // Final fallback error response
    if (!res.headersSent) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'The server encountered an unexpected error',
        timestamp: new Date().toISOString(),
        requestId: Math.random().toString(36).substr(2, 9)
      });
    }
  }
}