import { Request, Response, NextFunction } from 'express';
import { startupSequencer } from '../services/startup-sequencer.service.js';

/**
 * Readiness Gate Middleware
 * 
 * Blocks API requests until all services are fully initialized.
 * Prevents race conditions and undefined behavior during startup.
 */
export function createReadinessGate(options: {
  excludePaths?: string[];
  gracePeriodMs?: number;
} = {}) {
  const {
    excludePaths = ['/health', '/ready', '/circuit-breaker'],
    gracePeriodMs = 30000 // 30 seconds grace period
  } = options;

  let gracePeriodExpired = false;
  
  // Set grace period timeout
  setTimeout(() => {
    gracePeriodExpired = true;
    if (!startupSequencer.areServicesReady()) {
      console.warn('⚠️ Grace period expired - services still not ready, allowing requests anyway');
    }
  }, gracePeriodMs);

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip readiness check for excluded paths
    if (excludePaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Skip for non-API requests (frontend serving)
    if (!req.path.startsWith('/api')) {
      return next();
    }

    // Check if services are ready
    if (startupSequencer.areServicesReady()) {
      return next();
    }

    // Allow requests after grace period expires (degraded mode)
    if (gracePeriodExpired) {
      // Add warning header
      res.set('X-Service-Status', 'degraded');
      return next();
    }

    // Block request until services are ready
    console.log(`🚫 Blocking request to ${req.path} - services not ready`);
    
    res.status(503).json({
      error: 'Service Unavailable',
      message: 'Services are still initializing, please retry in a moment',
      ready: false,
      services: startupSequencer.getServiceStatus(),
      retryAfter: 5 // seconds
    });
  };
}

/**
 * Middleware to add readiness status to responses
 */
export function addReadinessHeaders(req: Request, res: Response, next: NextFunction) {
  if (req.path.startsWith('/api')) {
    const ready = startupSequencer.areServicesReady();
    res.set('X-Service-Ready', ready.toString());
    
    if (!ready) {
      res.set('X-Service-Status', 'initializing');
    }
  }
  
  next();
}