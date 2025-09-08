import { logger } from "../services/logger.service.js";

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  recoveryTimeMs: number;
  monitoringPeriodMs: number;
  expectedFailureRate: number;
}

export class CircuitBreakerError extends Error {
  constructor(message: string, public state: CircuitBreakerState) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

export class DatabaseCircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private lastSuccessTime = Date.now();
  private requestCount = 0;
  private options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = {
      failureThreshold: 10, // Reasonable threshold - not too aggressive
      recoveryTimeMs: 60000, // 1 minute recovery time for proper database recovery
      monitoringPeriodMs: 300000, // 5 minutes monitoring window for stability
      expectedFailureRate: 0.5, // 50% failure rate threshold - reasonable for database issues
      ...options
    };
    
    // Grace period during startup - disable circuit breaker for first 60 seconds
    this.startupGracePeriod = 60000;
    this.startupTime = Date.now();
  }
  
  private startupGracePeriod: number;
  private startupTime: number;

  async execute<T>(operation: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    // During startup grace period, allow all requests
    if (Date.now() - this.startupTime < this.startupGracePeriod) {
      try {
        return await operation();
      } catch (error) {
        console.log('⚠️ Startup grace period - ignoring failure for circuit breaker');
        throw error;
      }
    }
    
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitBreakerState.HALF_OPEN;
        console.log('Circuit breaker moved to HALF_OPEN state - attempting recovery');
      } else {
        if (fallback) {
          console.log('Circuit breaker OPEN - using fallback');
          return await fallback();
        }
        throw new CircuitBreakerError(
          `Circuit breaker is OPEN. Service unavailable. Will retry after ${Math.ceil((this.lastFailureTime + this.options.recoveryTimeMs - Date.now()) / 1000)}s`,
          this.state
        );
      }
    }

    this.requestCount++;
    
    try {
      const result = await this.executeWithTimeout(operation, 10000); // 10 second timeout
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      
      if (fallback && this.state === CircuitBreakerState.OPEN) {
        console.log('Circuit breaker opened due to failure - using fallback');
        return await fallback();
      }
      
      throw error;
    }
  }

  private async executeWithTimeout<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Operation timeout')), timeoutMs);
    });

    return Promise.race([operation(), timeoutPromise]);
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.lastSuccessTime = Date.now();
    
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      console.log('Circuit breaker recovered - moving to CLOSED state');
      this.state = CircuitBreakerState.CLOSED;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      console.log('Circuit breaker failure during recovery - moving back to OPEN state');
      this.state = CircuitBreakerState.OPEN;
      return;
    }

    if (this.shouldOpenCircuit()) {
      console.log(`Circuit breaker opening due to ${this.failureCount} failures`);
      this.state = CircuitBreakerState.OPEN;
    }
  }

  private shouldOpenCircuit(): boolean {
    if (this.failureCount >= this.options.failureThreshold) {
      return true;
    }

    // Also consider failure rate over time
    const now = Date.now();
    const timeSinceLastSuccess = now - this.lastSuccessTime;
    
    if (timeSinceLastSuccess > this.options.monitoringPeriodMs && this.requestCount > 10) {
      const failureRate = this.failureCount / this.requestCount;
      return failureRate > this.options.expectedFailureRate;
    }

    return false;
  }

  private shouldAttemptReset(): boolean {
    const now = Date.now();
    return now - this.lastFailureTime >= this.options.recoveryTimeMs;
  }

  public getStatus() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      requestCount: this.requestCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextRetryTime: this.state === CircuitBreakerState.OPEN 
        ? this.lastFailureTime + this.options.recoveryTimeMs 
        : null
    };
  }

  public reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.requestCount = 0;
    this.lastSuccessTime = Date.now();
    console.log('Circuit breaker manually reset');
  }
}

// Global circuit breaker instance for database operations
export const databaseCircuitBreaker = new DatabaseCircuitBreaker({
  failureThreshold: 10, // Not too aggressive - allow some transient failures
  recoveryTimeMs: 60000, // 1 minute recovery time for proper database recovery
  monitoringPeriodMs: 300000, // 5 minutes monitoring window for better stability
  expectedFailureRate: 0.5 // 50% failure rate before opening - reasonable for database issues
});