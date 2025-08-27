
import { connectionPool } from './database/connection-pool.js';
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
} from '../shared/schema';

/**
 * Database Connection Manager
 * 
 * This module provides a robust database connection using a connection pool
 * optimized for serverless environments with:
 * 
 * - Connection pooling with retry logic
 * - Health monitoring and automatic reconnection
 * - Performance metrics tracking
 * - Graceful error handling and recovery
 * - Optimal configuration for Vercel serverless functions
 */

// Get database instance through connection pool
export const getDb = async () => {
  return connectionPool.getDatabase();
};

// Legacy compatibility - create a Proxy to maintain existing API
export const db = new Proxy({} as any, {
  get(target, prop) {
    // For any property access, return a function that gets the db and calls the method
    return async (...args: any[]) => {
      const database = await getDb();
      const method = database[prop];
      if (typeof method === 'function') {
        return method.apply(database, args);
      }
      return method;
    };
  },
  
  // Handle property checks
  has(target, prop) {
    return true; // Allow all property checks to pass
  }
});

// Database health check function
export const checkDatabaseHealth = async () => {
  try {
    const healthStatus = await connectionPool.healthCheck();
    return healthStatus;
  } catch (error) {
    console.error('Database health check failed:', error);
    return {
      status: 'unhealthy' as const,
      error: error instanceof Error ? error.message : 'Unknown error',
      lastHealthCheck: new Date()
    };
  }
};

// Get connection pool metrics
export const getDatabaseMetrics = () => {
  return connectionPool.getMetrics();
};

// Test database connection
export const testDatabaseConnection = async () => {
  try {
    const database = await getDb();
    const result = await database.select().from(users).limit(1);
    return {
      success: true,
      message: 'Database connection successful',
      recordCount: result.length
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Database connection test failed:', errorMessage);
    return {
      success: false,
      error: errorMessage,
      message: 'Database connection failed'
    };
  }
};

// Export schema for use in other files
export {
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
};

// Export connection pool for advanced usage
export { connectionPool };
