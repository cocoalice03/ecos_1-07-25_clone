// DEPRECATED: This connection pool has been replaced by UnifiedDatabaseService
// This file is kept for reference but should not be used
console.warn('⚠️ connection-pool.ts is DEPRECATED - use UnifiedDatabaseService instead');

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import { 
  users, 
  sessions, 
  exchanges, 
  dailyCounters, 
  ecosScenarios, 
  ecosSessions, 
  ecosMessages, 
  ecosEvaluations,
  trainingSessions,
  trainingSessionStudents,
  trainingSessionScenarios
} from '../../shared/schema';

interface ConnectionConfig {
  maxConnections: number;
  idleTimeout: number;
  connectTimeout: number;
  acquireTimeout: number;
  retryAttempts: number;
  retryDelay: number;
}

interface HealthMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  totalQueries: number;
  failedQueries: number;
  avgResponseTime: number;
  lastHealthCheck: Date;
  connectionErrors: number;
}

class ServerlessConnectionPool {
  private client: Sql<{}> | null = null;
  private db: any = null;
  private isConnected = false;
  private connectionPromise: Promise<void> | null = null;
  private config: ConnectionConfig;
  private metrics: HealthMetrics;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<ConnectionConfig>) {
    this.config = {
      maxConnections: 5, // Conservative for serverless
      idleTimeout: 30, // 30 seconds
      connectTimeout: 15, // 15 seconds
      acquireTimeout: 10, // 10 seconds
      retryAttempts: 3,
      retryDelay: 1000, // 1 second
      ...config
    };

    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      totalQueries: 0,
      failedQueries: 0,
      avgResponseTime: 0,
      lastHealthCheck: new Date(),
      connectionErrors: 0
    };

    this.startHealthChecking();
  }

  private validateEnvironment(): void {
    if (!process.env.DATABASE_URL) {
      console.warn('DATABASE_URL environment variable not found - database features will be disabled');
      throw new Error('DATABASE_URL environment variable is required');
    }

    // Validate URL format
    try {
      new URL(process.env.DATABASE_URL);
    } catch (error) {
      console.error('Invalid DATABASE_URL format:', process.env.DATABASE_URL);
      throw new Error('DATABASE_URL is not a valid URL');
    }
  }

  private createConnection(): Sql<{}> {
    this.validateEnvironment();

    console.log('🔗 Creating new PostgreSQL connection for serverless environment...');

    const client = postgres(process.env.DATABASE_URL!, {
      // Connection pool settings optimized for serverless
      max: this.config.maxConnections,
      idle_timeout: this.config.idleTimeout,
      connect_timeout: this.config.connectTimeout,
      
      // SSL configuration for Supabase (required for all environments)
      ssl: { rejectUnauthorized: false },
      
      // Performance optimizations
      prepare: false, // Disable prepared statements for better serverless performance
      transform: postgres.camel, // Convert snake_case to camelCase
      
      // Connection lifecycle hooks for metrics (suppress notices while tracking connections)
      onnotice: () => {
        this.metrics.totalConnections++;
        this.metrics.activeConnections++;
        console.log('✅ Database connection established');
      }
    });

    return client;
  }

  private async testConnection(): Promise<void> {
    if (!this.client) {
      throw new Error('No database client available');
    }

    const startTime = Date.now();
    try {
      await this.client`SELECT 1 as test`;
      const responseTime = Date.now() - startTime;
      this.updateResponseTimeMetrics(responseTime);
      console.log(`✅ Database connection test successful (${responseTime}ms)`);
    } catch (error) {
      this.metrics.failedQueries++;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Database connection test failed:', errorMessage);
      throw error;
    }
  }

  private updateResponseTimeMetrics(responseTime: number): void {
    this.metrics.totalQueries++;
    this.metrics.avgResponseTime = 
      (this.metrics.avgResponseTime * (this.metrics.totalQueries - 1) + responseTime) / 
      this.metrics.totalQueries;
  }

  private startHealthChecking(): void {
    // Run health checks every 30 seconds in serverless environment
    this.healthCheckInterval = setInterval(async () => {
      try {
        if (this.isConnected && this.client) {
          await this.testConnection();
          this.metrics.lastHealthCheck = new Date();
        }
      } catch (error) {
        console.warn('Health check failed, will reconnect on next request');
        this.isConnected = false;
        this.client = null;
        this.db = null;
      }
    }, 30000);
  }

  async connect(): Promise<void> {
    if (this.isConnected && this.client && this.db) {
      return;
    }

    // If connection is already in progress, wait for it
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this.performConnection();
    return this.connectionPromise;
  }

  private async performConnection(): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        console.log(`🔄 Database connection attempt ${attempt}/${this.config.retryAttempts}`);
        
        // Create new client
        this.client = this.createConnection();
        
        // Test the connection
        await this.testConnection();
        
        // Create Drizzle instance
        this.db = drizzle(this.client, {
          schema: {
            users,
            sessions,
            exchanges,
            dailyCounters,
            ecosScenarios,
            ecosSessions,
            ecosMessages,
            ecosEvaluations,
            trainingSessions,
            trainingSessionStudents,
            trainingSessionScenarios
          }
        });

        this.isConnected = true;
        this.connectionPromise = null;
        
        console.log('✅ Database connection pool initialized successfully');
        return;
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown connection error');
        console.error(`❌ Connection attempt ${attempt} failed:`, lastError.message);
        
        // Clean up failed connection
        if (this.client) {
          try {
            await this.client.end();
          } catch (endError) {
            console.warn('Error closing failed connection:', endError);
          }
        }
        
        this.client = null;
        this.db = null;
        this.isConnected = false;

        // Exponential backoff with jitter for better retry distribution
        if (attempt < this.config.retryAttempts) {
          const baseDelay = this.config.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          const jitter = Math.random() * 1000; // Add up to 1 second jitter
          const delay = baseDelay + jitter;
          
          console.log(`⏳ Retrying connection in ${Math.round(delay)}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    this.connectionPromise = null;
    throw lastError || new Error('Failed to establish database connection');
  }

  async getDatabase(): Promise<any> {
    try {
      await this.connect();
      
      if (!this.db) {
        throw new Error('Database not initialized after connection attempt');
      }
      
      return this.db;
    } catch (error) {
      this.metrics.connectionErrors++;
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      
      console.error('Failed to get database connection:', errorMessage);
      
      // Reset connection state on failure to allow recovery
      this.isConnected = false;
      this.client = null;
      this.db = null;
      this.connectionPromise = null;
      
      throw new Error(`Database unavailable: ${errorMessage}`);
    }
  }

  async healthCheck(): Promise<HealthMetrics & { status: 'healthy' | 'unhealthy' }> {
    try {
      if (this.isConnected && this.client) {
        await this.testConnection();
        return {
          ...this.metrics,
          status: 'healthy' as const
        };
      } else {
        return {
          ...this.metrics,
          status: 'unhealthy' as const
        };
      }
    } catch (error) {
      return {
        ...this.metrics,
        status: 'unhealthy' as const
      };
    }
  }

  async gracefulShutdown(): Promise<void> {
    console.log('🔄 Initiating graceful database shutdown...');
    
    // Stop health checking
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Close database connection
    if (this.client) {
      try {
        await this.client.end();
        console.log('✅ Database connection closed successfully');
      } catch (error) {
        console.error('❌ Error closing database connection:', error);
      }
    }

    // Reset state
    this.client = null;
    this.db = null;
    this.isConnected = false;
    this.connectionPromise = null;
  }

  getMetrics(): HealthMetrics {
    return { ...this.metrics };
  }

  isHealthy(): boolean {
    return this.isConnected && this.client !== null && this.db !== null;
  }
}

// Create singleton instance
const connectionPool = new ServerlessConnectionPool({
  maxConnections: 5, // Conservative for serverless
  idleTimeout: 30,
  connectTimeout: 15,
  retryAttempts: 3,
  retryDelay: 1000
});

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await connectionPool.gracefulShutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await connectionPool.gracefulShutdown();
  process.exit(0);
});

export { connectionPool, ServerlessConnectionPool };
export type { ConnectionConfig, HealthMetrics };