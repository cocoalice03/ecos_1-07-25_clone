
import { unifiedDb } from './services/unified-database.service.js';
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
 * Database Connection Manager - SIMPLIFIED
 * 
 * Now uses UnifiedDatabaseService for all operations.
 * No more connection pooling conflicts or race conditions.
 */

// Legacy compatibility - redirect to unified service
export const getDb = async () => {
  throw new Error('getDb() is deprecated - use unifiedDb directly');
};

// Legacy db proxy - deprecated, will throw errors to force migration
export const db = new Proxy({} as any, {
  get(target, prop) {
    return async (...args: any[]) => {
      throw new Error(`db.${String(prop)}() is deprecated - use unifiedDb methods directly`);
    };
  },
  
  has(target, prop) {
    return true;
  }
});

// Database health check using unified service
export const checkDatabaseHealth = async () => {
  try {
    const health = await unifiedDb.healthCheck();
    return {
      healthStatus: health.status === 'healthy' ? 'healthy' as const : 'unhealthy' as const,
      ...health
    };
  } catch (error) {
    console.error('Database health check failed:', error);
    return {
      status: 'unhealthy' as const,
      error: error instanceof Error ? error.message : 'Unknown error',
      lastHealthCheck: new Date()
    };
  }
};

// Get database metrics from unified service
export const getDatabaseMetrics = () => {
  return unifiedDb.getMetrics();
};

// Test database connection using unified service
export const testDatabaseConnection = async () => {
  try {
    await unifiedDb.initialize();
    const scenarios = await unifiedDb.getScenarios();
    return {
      success: true,
      message: 'Database connection successful',
      recordCount: scenarios.length
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

// Export unified database for advanced usage
export { unifiedDb };
