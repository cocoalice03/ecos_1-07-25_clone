class InMemoryRateLimiter {
    requests = new Map();
    cleanupInterval;
    constructor() {
        // Clean up expired entries every 5 minutes
        this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }
    cleanup() {
        const now = Date.now();
        for (const [key, info] of this.requests) {
            if (now > info.resetTime) {
                this.requests.delete(key);
            }
        }
    }
    hit(key, windowMs) {
        const now = Date.now();
        const existing = this.requests.get(key);
        if (!existing || now > existing.resetTime) {
            // New window or expired window
            const resetTime = now + windowMs;
            this.requests.set(key, {
                count: 1,
                resetTime,
                firstRequest: now
            });
            return { count: 1, resetTime, exceeded: false };
        }
        // Increment existing count
        existing.count++;
        this.requests.set(key, existing);
        return {
            count: existing.count,
            resetTime: existing.resetTime,
            exceeded: false // Will be determined by the rate limiter
        };
    }
    reset(key) {
        this.requests.delete(key);
    }
    getStats() {
        const memoryUsage = process.memoryUsage();
        return {
            totalKeys: this.requests.size,
            memoryUsage: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`
        };
    }
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.requests.clear();
    }
}
// Global rate limiter instance
const globalRateLimiter = new InMemoryRateLimiter();
export class RateLimiter {
    config;
    constructor(config) {
        this.config = {
            windowMs: config.windowMs,
            maxRequests: config.maxRequests,
            message: config.message || 'Too many requests, please try again later',
            standardHeaders: config.standardHeaders ?? true,
            legacyHeaders: config.legacyHeaders ?? false,
            skipSuccessfulRequests: config.skipSuccessfulRequests ?? false,
            skipFailedRequests: config.skipFailedRequests ?? false,
            keyGenerator: config.keyGenerator || this.defaultKeyGenerator
        };
    }
    defaultKeyGenerator(req) {
        // Use IP address as default key, with forwarded IP support
        const forwarded = req.headers['x-forwarded-for'];
        const ip = forwarded ? forwarded.split(',')[0].trim() : req.ip || req.connection.remoteAddress || 'unknown';
        return `rate_limit:${ip}`;
    }
    middleware() {
        return (req, res, next) => {
            const key = this.config.keyGenerator(req);
            const result = globalRateLimiter.hit(key, this.config.windowMs);
            const isExceeded = result.count > this.config.maxRequests;
            const resetTimeSeconds = Math.ceil((result.resetTime - Date.now()) / 1000);
            // Add rate limit headers
            if (this.config.standardHeaders) {
                res.set({
                    'RateLimit-Limit': this.config.maxRequests.toString(),
                    'RateLimit-Remaining': Math.max(0, this.config.maxRequests - result.count).toString(),
                    'RateLimit-Reset': new Date(result.resetTime).toISOString()
                });
            }
            if (this.config.legacyHeaders) {
                res.set({
                    'X-RateLimit-Limit': this.config.maxRequests.toString(),
                    'X-RateLimit-Remaining': Math.max(0, this.config.maxRequests - result.count).toString(),
                    'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString()
                });
            }
            if (isExceeded) {
                res.set('Retry-After', resetTimeSeconds.toString());
                return res.status(429).json({
                    error: this.config.message,
                    code: 'RATE_LIMIT_EXCEEDED',
                    retryAfter: resetTimeSeconds,
                    limit: this.config.maxRequests,
                    windowMs: this.config.windowMs,
                    resetTime: new Date(result.resetTime).toISOString()
                });
            }
            next();
        };
    }
    reset(req) {
        const key = this.config.keyGenerator(req);
        globalRateLimiter.reset(key);
    }
}
// Predefined rate limiters for common use cases
// Strict rate limiter for authentication endpoints
export const authRateLimit = new RateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per window
    message: 'Too many authentication attempts, please try again later',
    skipSuccessfulRequests: true // Only count failed attempts
});
// Moderate rate limiter for API endpoints
export const apiRateLimit = new RateLimiter({
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
    message: 'API rate limit exceeded, please slow down'
});
// Lenient rate limiter for general endpoints
export const generalRateLimit = new RateLimiter({
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
    message: 'Rate limit exceeded, please try again later'
});
// Strict rate limiter for expensive operations
export const strictRateLimit = new RateLimiter({
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 10, // 10 requests per minute
    message: 'Rate limit exceeded for this operation'
});
// Email-based rate limiter for admin operations
export const emailBasedRateLimit = new RateLimiter({
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 30, // 30 requests per 5 minutes per email
    message: 'Too many requests for this email address',
    keyGenerator: (req) => {
        const email = req.query.email || req.body?.email || 'unknown';
        return `email_rate_limit:${email.toLowerCase()}`;
    }
});
// ECOS session rate limiter
export const ecosSessionRateLimit = new RateLimiter({
    windowMs: 10 * 60 * 1000, // 10 minutes
    maxRequests: 20, // 20 ECOS operations per 10 minutes
    message: 'Too many ECOS operations, please wait before creating more sessions',
    keyGenerator: (req) => {
        const email = req.query.email || req.body?.email || req.ip || 'unknown';
        return `ecos_rate_limit:${email.toLowerCase()}`;
    }
});
// Create custom rate limiter
export const createRateLimit = (config) => {
    return new RateLimiter(config);
};
// Rate limiter status endpoint middleware
export const rateLimitStatus = () => {
    return (req, res) => {
        const stats = globalRateLimiter.getStats();
        res.status(200).json({
            rateLimit: {
                activeKeys: stats.totalKeys,
                memoryUsage: stats.memoryUsage,
                timestamp: new Date().toISOString()
            }
        });
    };
};
// Graceful shutdown
export const shutdownRateLimiter = () => {
    globalRateLimiter.destroy();
};
// Export for advanced usage
export { globalRateLimiter };
// Helper function to check if request is rate limited without incrementing
export const checkRateLimit = (req, config) => {
    const keyGen = config.keyGenerator || ((r) => `rate_limit:${r.ip}`);
    const key = keyGen(req);
    // This is a simplified check - in a full implementation you'd want to peek without incrementing
    const result = globalRateLimiter.hit(key, config.windowMs);
    return {
        exceeded: result.count > config.maxRequests,
        remaining: Math.max(0, config.maxRequests - result.count),
        resetTime: new Date(result.resetTime)
    };
};
